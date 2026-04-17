// email_draft — AI-powered email drafting for deals.
// POST /email/ai-draft   — draft an email for a deal using LLM + style samples
// POST /email/style-learn — record before/after edits so JARVIS learns the user's voice
// Sends ALWAYS go through the approval gateway — this route only produces drafts.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { callModel } from "../lib/skills.js";
import { supaFetch, supaInsert } from "../lib/supabase_client.js";
import { audit } from "../lib/audit.js";
import { db } from "../db/db.js";

const DraftBody = z.object({
  deal_id: z.string().uuid().nullable().optional(),
  type: z.enum(["follow_up", "intro", "proposal_send", "thank_you", "check_in", "reply"]).default("follow_up"),
  context: z.union([z.string(), z.record(z.any())]).optional(),
});

export async function emailDraftRoutes(app: FastifyInstance) {
  // POST /email/ai-draft — JARVIS drafts an email for a deal
  app.post("/email/ai-draft", async (req, reply) => {
    const parsed = DraftBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.message };
    }

    const { deal_id, type, context } = parsed.data;

    // Parse context — may be string or object (for replies)
    const ctx = typeof context === "object" ? context as any : { note: context };

    // Fetch deal if available
    let deal: any = null;
    let contactEmail = '';
    let contactName = '';
    if (deal_id) {
      const deals = await supaFetch('deals', `select=*&id=eq.${deal_id}`);
      deal = deals[0] ?? null;
      if (deal) {
        contactName = deal.contact_name ?? deal.company ?? '';
        if (deal.contact_id) {
          const contacts = await supaFetch('contacts', `select=*&id=eq.${deal.contact_id}`);
          if (contacts[0]) {
            contactEmail = contacts[0].email ?? '';
            contactName = contacts[0].name ?? contactName;
          }
        }
      }
    }

    // Fetch style samples (always — not deal-specific)
    const styleSamples = await supaFetch('email_style', `select=edited_draft,context&order=created_at.desc&limit=3`);

    const styleNote = styleSamples.length > 0
      ? `\n\nExamples of how Samuel writes (match this tone and style exactly):\n${styleSamples.map((s: any) => `---\n${s.edited_draft}\n---`).join('\n')}`
      : '';

    // Fetch recent comms if we have a deal
    let commHistory = '';
    if (deal_id) {
      const comms = await supaFetch('communications', `select=type,subject,body,occurred_at&deal_id=eq.${deal_id}&order=occurred_at.desc&limit=5`);
      if (comms.length > 0) {
        commHistory = `\n\nRecent communications with this contact:\n${comms.map((c: any) => `[${c.type}] ${c.subject ?? ''}: ${(c.body ?? '').slice(0, 200)}`).join('\n')}`;
      }
    }

    // Load Samuel's learned style profile if available
    let styleProfileNote = '';
    try {
      const profile = db.prepare("SELECT profile FROM jarvis_style_profile WHERE id = 'current'").get() as any;
      if (profile?.profile) {
        const p = JSON.parse(profile.profile);
        styleProfileNote = `\n\nSAMUEL'S WRITING STYLE (learned from ${p.email_count || "many"} emails):
- Tone: ${p.tone || "direct and warm"}
- Greetings: ${(p.greeting_patterns || []).join(", ") || "varies"}
- Sign-offs: ${(p.sign_off_patterns || []).join(", ") || "Samuel Eddi"}
- Avg length: ${p.avg_length_words || 80} words
- Key phrases: ${(p.key_phrases || []).slice(0, 5).join(", ") || "none captured"}
- Do NOT: ${(p.do_not || []).join(", ") || "no restrictions"}
Match this style exactly.`;
      }
    } catch {}

    // Build prompt based on type
    let prompt: string;

    if (type === "reply" && ctx.originalSnippet) {
      // Reply mode — draft is based on the actual email content
      prompt = `You are Samuel Eddi, VP of Sales at 3PL Center LLC (warehousing, fulfillment, shipping — NJ + CA).
You are replying to an email. Read the original carefully and draft a specific, contextual reply.

FROM: ${ctx.originalFrom ?? "unknown sender"}
SUBJECT: ${ctx.originalSubject ?? ""}
ORIGINAL EMAIL:
${ctx.originalSnippet}
${deal ? `\nDEAL CONTEXT: ${deal.company ?? deal.company_name} — Stage: ${deal.stage} — $${((deal.value_usd ?? deal.value ?? 0)).toLocaleString()}` : ''}${commHistory}${styleNote}${styleProfileNote}

INSTRUCTIONS:
- Read the email above and identify what the sender is asking or communicating.
- Draft a reply that directly addresses their specific points.
- If the email mentions shipping, warehousing, invoices, scheduling, or logistics — tailor your reply to that context with relevant 3PL expertise.
- If it's a meeting confirmation — confirm your attendance and mention anything you want to discuss.
- If it's a question — answer it directly.
- If it's an update request — provide the update or say what you'll follow up on.
- Be professional, concise, and actionable. One clear next step.
- Under 120 words. No markdown. No fluff.
- Sign off as: Samuel Eddi, VP Sales | 3PL Center

At the very end on a new line, add the subject line prefixed exactly with "SUBJECT: "`;
    } else {
      // Outbound/follow-up mode
      prompt = `You are Samuel Eddi, VP of Sales at 3PL Center LLC (warehousing, fulfillment, shipping — NJ + CA).

Deal: ${deal ? `${deal.company ?? deal.company_name ?? 'Unknown'} — Stage: ${deal.stage} — $${((deal.value_usd ?? deal.value ?? 0)).toLocaleString()}` : 'No deal linked'}
Contact: ${contactName || ctx.originalFrom || 'Unknown'}
Email type: ${type}${ctx.note ? `\nAdditional context: ${ctx.note}` : ''}${commHistory}${styleNote}${styleProfileNote}

Write a professional, concise email. Be direct and warm but not overly casual.
Include one clear call-to-action.
Keep it under 150 words.
Do NOT include a subject line in the body.
Do NOT use markdown.
Sign off as: Samuel Eddi, VP Sales | 3PL Center

At the very end on a new line, add the subject line prefixed exactly with "SUBJECT: "`;
    }

    try {
      const result = await callModel(
        { kind: "complex_reasoning", privacy: "personal", prompt },
        { skill: "email_draft" }
      );

      // Split body and subject
      let body = result.text.trim();
      let subject = '';
      const subjectMatch = body.match(/^SUBJECT:\s*(.+)$/m);
      if (subjectMatch) {
        subject = subjectMatch[1].trim();
        body = body.replace(/^SUBJECT:\s*.+$/m, '').trim();
      }

      audit({
        actor: "route:email_draft",
        action: "email.draft.created",
        subject: deal_id ?? "no-deal",
        metadata: { type, company: deal?.company ?? deal?.company_name ?? ctx.originalFrom },
      });

      return {
        to: contactEmail || "",
        subject,
        body,
        deal_id: deal_id ?? null,
        contact_name: contactName || ctx.originalFrom || "",
        company: deal?.company ?? deal?.company_name ?? "",
        type,
      };
    } catch (e: any) {
      reply.code(500);
      return { error: e.message };
    }
  });

  // POST /email/style-learn — record when user edits a JARVIS draft
  app.post("/email/style-learn", async (req, reply) => {
    const { original, edited, deal_id, contact_id, context } = req.body as any;
    if (!original || !edited) {
      reply.code(400);
      return { ok: false, error: "original and edited required" };
    }

    await supaInsert('email_style', {
      original_draft: original,
      edited_draft: edited,
      deal_id: deal_id ?? null,
      contact_id: contact_id ?? null,
      context: context ?? 'follow_up',
    });

    audit({
      actor: "user",
      action: "email.style.learned",
      subject: deal_id ?? "unknown",
      metadata: { context: context ?? 'follow_up', originalLen: original.length, editedLen: edited.length },
    });

    return { ok: true, message: "Style preference recorded — JARVIS is learning your voice" };
  });
}
