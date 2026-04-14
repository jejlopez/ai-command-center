// email_draft — AI-powered email drafting for deals.
// POST /email/ai-draft   — draft an email for a deal using LLM + style samples
// POST /email/style-learn — record before/after edits so JARVIS learns the user's voice
// Sends ALWAYS go through the approval gateway — this route only produces drafts.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { callModel } from "../lib/skills.js";
import { supaFetch, supaInsert } from "../lib/supabase_client.js";
import { audit } from "../lib/audit.js";

const DraftBody = z.object({
  deal_id: z.string().uuid(),
  type: z.enum(["follow_up", "intro", "proposal_send", "thank_you", "check_in"]).default("follow_up"),
  context: z.string().optional(),
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

    // Fetch deal
    const deals = await supaFetch('deals', `select=*&id=eq.${deal_id}`);
    const deal = deals[0];
    if (!deal) {
      reply.code(404);
      return { error: "Deal not found" };
    }

    // Fetch contact
    let contactEmail = '';
    let contactName: string = deal.contact_name ?? deal.company ?? '';
    if (deal.contact_id) {
      const contacts = await supaFetch('contacts', `select=*&id=eq.${deal.contact_id}`);
      if (contacts[0]) {
        contactEmail = contacts[0].email ?? '';
        contactName = contacts[0].name ?? contactName;
      }
    }

    // Fetch recent comms + style samples in parallel
    const [comms, styleSamples] = await Promise.all([
      supaFetch('communications', `select=type,subject,body,occurred_at&deal_id=eq.${deal_id}&order=occurred_at.desc&limit=5`),
      supaFetch('email_style', `select=edited_draft,context&order=created_at.desc&limit=3`),
    ]);

    const styleNote = styleSamples.length > 0
      ? `\n\nExamples of how the user writes (match this tone and style exactly):\n${styleSamples.map((s: any) => `---\n${s.edited_draft}\n---`).join('\n')}`
      : '';

    const commHistory = comms.length > 0
      ? `\n\nRecent communications with this contact:\n${comms.map((c: any) => `[${c.type}] ${c.subject ?? ''}: ${(c.body ?? '').slice(0, 200)}`).join('\n')}`
      : '';

    const prompt = `You are drafting an email for a VP of Sales at a 3PL/shipping company.

Deal: ${deal.company ?? deal.company_name ?? 'Unknown'} — Stage: ${deal.stage} — $${((deal.value_usd ?? deal.value ?? 0)).toLocaleString()}
Contact: ${contactName}
Email type: ${type}${context ? `\nAdditional context: ${context}` : ''}
${commHistory}
${styleNote}

Write a professional, concise email. Be direct and warm but not overly casual.
Include one clear call-to-action.
Keep it under 150 words.
Do NOT include a subject line in the body.
Do NOT use markdown.
Use a generic professional sign-off (not a specific name).

At the very end on a new line, add the subject line prefixed exactly with "SUBJECT: "`;

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
        subject: deal_id,
        metadata: { type, company: deal.company ?? deal.company_name },
      });

      return {
        to: contactEmail,
        subject,
        body,
        deal_id,
        contact_name: contactName,
        company: deal.company ?? deal.company_name ?? '',
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
