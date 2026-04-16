// master_email_agent — unified email skill: triage classification, draft replies,
// cleanup suggestions, and style-aware composition. Replaces email_drafter,
// draft_reply, and email_cleanup.

import { db } from "../db/db.js";
import { audit } from "../lib/audit.js";
import { createDraft } from "../lib/providers/gmail_actions.js";
import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "master_email_agent",
  title: "Master Email Agent",
  description: "Unified email skill: drafts replies with context, classifies urgency, handles cleanup. Uses deal history and style learning.",
  version: "1.0.0",
  scopes: ["net.out", "llm.cloud", "gmail.read", "memory.read"],
  routerHint: "chat",
  triggers: [
    { kind: "manual" },
    { kind: "cron", expr: "30 7 * * 1-5" }, // weekday 7:30am — morning email pass
  ],
  inputs: [
    { name: "mode", type: "string", required: false, description: "draft_reply | cleanup | batch_draft" },
    { name: "messageId", type: "string", required: false, description: "Gmail message ID to reply to" },
    { name: "dealId", type: "string", required: false, description: "Deal ID for context" },
    { name: "contactName", type: "string", required: false, description: "Recipient name" },
    { name: "contactEmail", type: "string", required: false, description: "Recipient email" },
    { name: "context", type: "string", required: false, description: "Additional context or email type" },
    { name: "tone", type: "string", required: false, description: "professional | friendly | brief" },
  ],
};

export const masterEmailAgent: Skill = {
  manifest: { ...manifest, costTier: "standard" } as any,

  async run(ctx) {
    const mode = String(ctx.inputs["mode"] ?? "draft_reply");
    const messageId = ctx.inputs["messageId"] ? String(ctx.inputs["messageId"]) : undefined;
    const dealId = ctx.inputs["dealId"] ? String(ctx.inputs["dealId"]) : undefined;
    const contactName = ctx.inputs["contactName"] ? String(ctx.inputs["contactName"]) : "";
    const contactEmail = ctx.inputs["contactEmail"] ? String(ctx.inputs["contactEmail"]) : "";
    const extraContext = ctx.inputs["context"] ? String(ctx.inputs["context"]) : "";
    const tone = String(ctx.inputs["tone"] ?? "professional");

    ctx.log("master_email_agent.start", { mode });

    // Gather style samples for voice matching
    const styleSamples = db.prepare(
      "SELECT edited_draft, context FROM email_style ORDER BY created_at DESC LIMIT 3"
    ).all() as any[];
    const styleNote = styleSamples.length > 0
      ? `\n\nExamples of how the user writes (match this voice):\n${styleSamples.map((s: any) => `---\n${s.edited_draft}\n---`).join("\n")}`
      : "";

    // Gather deal context if available
    let dealContext = "";
    if (dealId) {
      const deal = db.prepare("SELECT * FROM crm_deals WHERE id = ?").get(dealId) as any;
      if (deal) {
        dealContext = `\nDeal: ${deal.org_name || deal.title} — Stage: ${deal.stage} — $${(deal.value || 0).toLocaleString()}`;
        dealContext += `\nContact: ${deal.contact_name || contactName}`;
      }
    }

    // Gather memory context about the contact
    let memoryContext = "";
    if (contactName || contactEmail) {
      try {
        const recalled = await ctx.memory.recall({ q: contactName || contactEmail, limit: 3 });
        if (recalled?.nodes?.length) {
          memoryContext = `\n\nWhat Jarvis knows about this person:\n${recalled.nodes.map((m: any) => m.body?.slice(0, 200)).join("\n")}`;
        }
      } catch {}
    }

    if (mode === "draft_reply") {
      // Draft a reply to a specific email or general outreach
      const prompt = `You are Samuel Eddi, VP of Sales at 3PL Center LLC (warehousing, fulfillment, shipping — NJ + CA).

Draft a ${tone} email reply.
${dealContext}
To: ${contactName} <${contactEmail}>
${extraContext ? `Context: ${extraContext}` : ""}
${memoryContext}${styleNote}

Rules:
- Be direct, warm, professional. Under 120 words.
- Reference specific details from the context.
- Include one clear call-to-action.
- Sign off as: Samuel Eddi, VP Sales | 3PL Center
- No markdown. No subject line in body.
- End with SUBJECT: <subject line>`;

      const result = await ctx.callModel({ kind: "chat", prompt, maxTokens: 300 });
      let body = result.text.trim();
      let subject = "";
      const subjectMatch = body.match(/^SUBJECT:\s*(.+)$/m);
      if (subjectMatch) {
        subject = subjectMatch[1].trim();
        body = body.replace(/^SUBJECT:\s*.+$/m, "").trim();
      }

      // Create Gmail draft if we have an email
      let draftResult: any = null;
      if (contactEmail && contactEmail.includes("@")) {
        try {
          draftResult = await createDraft(contactEmail, subject || `Following up — 3PL Center`, body);
          db.prepare(
            `INSERT INTO email_drafts(id, gmail_draft_id, to_addr, subject, body_original, status)
             VALUES (?, ?, ?, ?, ?, 'review_needed')`
          ).run(crypto.randomUUID(), draftResult.draftId, contactEmail, subject, body);
          ctx.log("master_email_agent.draft_created", { to: contactEmail });
        } catch (err: any) {
          ctx.log("master_email_agent.draft_fail", { error: err.message });
        }
      }

      audit({ actor: "jarvis", action: "email.draft.created", subject: dealId ?? contactEmail, metadata: { mode, to: contactEmail } });

      return { draft: { to: contactEmail, subject, body }, gmailDraft: draftResult };

    } else if (mode === "cleanup") {
      // Morning email cleanup pass — classify and suggest actions
      const triaged = db.prepare(
        "SELECT * FROM email_triage WHERE action_taken = 0 ORDER BY created_at DESC LIMIT 30"
      ).all() as any[];

      if (triaged.length === 0) return { message: "Inbox clean — no unprocessed emails" };

      const urgent = triaged.filter((e: any) => e.category === "urgent");
      const actionNeeded = triaged.filter((e: any) => e.category === "action_needed");
      const archivable = triaged.filter((e: any) => ["junk", "newsletter"].includes(e.category));

      // Draft replies for urgent ones
      const draftsCreated: any[] = [];
      for (const email of urgent.slice(0, 3)) {
        try {
          const result = await ctx.callModel({
            kind: "chat",
            prompt: `Draft a brief, professional reply to this urgent email.
From: ${email.from_addr}
Subject: ${email.subject}
Preview: ${email.snippet}
${styleNote}
Keep under 80 words. Sign off as Samuel Eddi. No markdown.`,
            maxTokens: 200,
          });
          draftsCreated.push({ from: email.from_addr, subject: email.subject, draft: result.text.trim() });
        } catch {}
      }

      audit({ actor: "jarvis", action: "email.cleanup.completed", metadata: { urgent: urgent.length, action: actionNeeded.length, archivable: archivable.length, drafted: draftsCreated.length } });

      return {
        summary: { urgent: urgent.length, actionNeeded: actionNeeded.length, archivable: archivable.length },
        drafts: draftsCreated,
        suggestions: archivable.length > 0 ? `${archivable.length} emails can be archived (junk/newsletter)` : "Nothing to archive",
      };

    } else if (mode === "batch_draft") {
      // Batch draft replies for all action_needed emails
      const emails = db.prepare(
        "SELECT * FROM email_triage WHERE category IN ('urgent', 'action_needed') AND draft_id IS NULL ORDER BY created_at DESC LIMIT 5"
      ).all() as any[];

      const results: any[] = [];
      for (const email of emails) {
        try {
          const result = await ctx.callModel({
            kind: "chat",
            prompt: `Draft a professional reply.
From: ${email.from_addr}
Subject: ${email.subject}
Preview: ${email.snippet}
${styleNote}
Under 100 words. Sign off as Samuel Eddi. No markdown.`,
            maxTokens: 200,
          });

          const draftId = crypto.randomUUID();
          db.prepare(
            `INSERT INTO email_drafts(id, thread_id, to_addr, subject, body_original, status)
             VALUES (?, ?, ?, ?, ?, 'review_needed')`
          ).run(draftId, email.thread_id, email.from_addr, `Re: ${email.subject}`, result.text.trim());

          db.prepare("UPDATE email_triage SET draft_id = ? WHERE id = ?").run(draftId, email.id);

          results.push({ from: email.from_addr, subject: email.subject, draftId });
        } catch {}
      }

      audit({ actor: "jarvis", action: "email.batch_draft", metadata: { processed: emails.length, drafted: results.length } });

      return { drafted: results.length, total: emails.length, results };
    }

    return { error: `Unknown mode: ${mode}` };
  },
};
