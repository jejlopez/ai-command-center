// email_drafter — Phase B: creates draft replies for action_needed/urgent emails.
// Reads triage results, generates replies using memory context, creates Gmail drafts.
// Never sends — drafts sit until you approve.

import { db } from "../db/db.js";
import { createDraft } from "../lib/providers/gmail_actions.js";
import { listMessages } from "../lib/providers/gmail_actions.js";
import { resetRunLimits } from "../lib/limits.js";
import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "email_drafter",
  title: "Email Drafter",
  description: "Draft replies for urgent and action-needed emails. Creates Gmail drafts for your review — never sends.",
  version: "0.1.0",
  scopes: ["gmail.read", "llm.cloud", "memory.read"],
  routerHint: "chat",
  triggers: [{ kind: "manual" }],
  inputs: [
    { name: "categories", type: "string", required: false, default: "urgent,action_needed", description: "Comma-separated categories to draft for" },
    { name: "maxDrafts", type: "number", required: false, default: 3, description: "Max drafts to create this run" },
    { name: "tone", type: "string", required: false, default: "professional", description: "Tone: professional, friendly, brief" },
  ],
};

export const emailDrafter: Skill = {
  manifest: { ...manifest, costTier: "standard", maxRetries: 0 } as any,

  async run(ctx) {
    resetRunLimits("gmail");

    const categories = String(ctx.inputs["categories"] ?? "urgent,action_needed").split(",").map(s => s.trim());
    const maxDrafts = Number(ctx.inputs["maxDrafts"] ?? 3);
    const tone = String(ctx.inputs["tone"] ?? "professional");

    // Get triaged emails that need replies and don't have drafts yet
    const placeholders = categories.map(() => "?").join(",");
    const triaged = db.prepare(
      `SELECT * FROM email_triage
       WHERE category IN (${placeholders})
       AND draft_id IS NULL
       AND action_taken = 0
       ORDER BY created_at DESC LIMIT ?`
    ).all(...categories, maxDrafts) as any[];

    if (triaged.length === 0) {
      return { draftsCreated: 0, message: "No emails need drafting" };
    }

    // Fetch full message bodies for context
    let fullMessages: any[] = [];
    try {
      fullMessages = await listMessages(50, "is:unread");
    } catch (err: any) {
      return { error: `Gmail read failed: ${err.message}` };
    }

    const messageMap = new Map(fullMessages.map(m => [m.id, m]));
    const draftsCreated: Array<{ to: string; subject: string; draftId: string }> = [];

    for (const item of triaged) {
      const fullMsg = messageMap.get(item.message_id);
      if (!fullMsg) continue;

      // Get memory context about this sender
      let memoryContext = "";
      try {
        const recalled = await ctx.memory.recall({ q: `${item.from_addr} ${item.subject}`, limit: 3 });
        memoryContext = recalled.compiled || "";
      } catch { /* best effort */ }

      // Generate draft reply
      const prompt = [
        `Draft a ${tone} reply to this email:`,
        "",
        `From: ${fullMsg.from}`,
        `Subject: ${fullMsg.subject}`,
        `Body: ${fullMsg.body?.slice(0, 2000) || fullMsg.snippet}`,
        "",
        memoryContext ? `Context from memory about this person/topic:\n${memoryContext}\n` : "",
        "Write ONLY the reply body. No subject line, no greeting preamble like 'Here\'s a draft'. Just the actual email text ready to send.",
        `Tone: ${tone}. Be concise.`,
      ].filter(Boolean).join("\n");

      let draftBody: string;
      try {
        const out = await ctx.callModel({
          kind: "chat",
          system: "You are drafting an email reply on behalf of the user. Write naturally, match the requested tone. Output only the reply text.",
          prompt,
          maxTokens: 400,
        });
        draftBody = out.text.trim();
      } catch (err: any) {
        ctx.log("email_drafter.model_fail", { error: err.message, messageId: item.message_id });
        continue;
      }

      // Create Gmail draft
      const replySubject = fullMsg.subject.startsWith("Re:") ? fullMsg.subject : `Re: ${fullMsg.subject}`;
      try {
        const gmail = await createDraft(fullMsg.from, replySubject, draftBody, fullMsg.threadId);

        // Store in our drafts table
        const draftId = crypto.randomUUID();
        db.prepare(
          `INSERT INTO email_drafts(id, gmail_draft_id, thread_id, to_addr, subject, body_original, status)
           VALUES (?, ?, ?, ?, ?, ?, 'review_needed')`
        ).run(draftId, gmail.draftId, fullMsg.threadId, fullMsg.from, replySubject, draftBody);

        // Link triage entry to draft
        db.prepare("UPDATE email_triage SET draft_id = ? WHERE id = ?").run(draftId, item.id);

        draftsCreated.push({ to: fullMsg.from, subject: replySubject, draftId });
        ctx.log("email_drafter.draft_created", { to: fullMsg.from, subject: replySubject });
      } catch (err: any) {
        ctx.log("email_drafter.draft_fail", { error: err.message, to: fullMsg.from });
      }
    }

    return {
      draftsCreated: draftsCreated.length,
      drafts: draftsCreated,
      categoriesChecked: categories,
      tone,
    };
  },
};
