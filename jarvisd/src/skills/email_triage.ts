// email_triage — Phase A: reads inbox, classifies, stores results.
// Runs every 15 minutes via cron. Uses Haiku (cheap).
// Never takes action — only classifies and stores.

import { db } from "../db/db.js";
import { resetRunLimits } from "../lib/limits.js";
import { listMessages, type GmailMessage } from "../lib/providers/gmail_actions.js";
import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "email_triage",
  title: "Email Triage",
  description: "Scan inbox, classify emails (urgent/action/fyi/junk/billing), store for review.",
  version: "0.1.0",
  scopes: ["gmail.read", "llm.cloud"],
  routerHint: "chat",
  triggers: [
    { kind: "cron", expr: "*/15 * * * *" },  // every 15 min — needs cron upgrade to support */N
    { kind: "manual" },
  ],
  inputs: [
    { name: "maxMessages", type: "number", required: false, default: 20, description: "Max messages to scan" },
  ],
};

const CATEGORIES = ["urgent", "action_needed", "fyi", "junk", "newsletter", "billing", "personal"] as const;

export const emailTriage: Skill = {
  manifest: { ...manifest, costTier: "cheap", maxRetries: 0 } as any,

  async run(ctx) {
    // Reset per-run limits at start
    resetRunLimits("gmail");

    const max = Number(ctx.inputs["maxMessages"] ?? 20);

    let messages: GmailMessage[];
    try {
      messages = await listMessages(max, "is:unread");
    } catch (err: any) {
      return { error: `Gmail read failed: ${err.message}`, step: "read" };
    }

    if (messages.length === 0) {
      return { scanned: 0, classified: 0, message: "No unread messages" };
    }

    // Skip already-triaged messages
    const existingIds = new Set(
      (db.prepare("SELECT message_id FROM email_triage").all() as any[]).map(r => r.message_id)
    );

    const newMessages = messages.filter(m => !existingIds.has(m.id));

    if (newMessages.length === 0) {
      return { scanned: messages.length, classified: 0, message: "All messages already triaged" };
    }

    // Classify in batch using LLM
    const batch = newMessages.slice(0, 20).map((m, i) => (
      `[${i + 1}] From: ${m.from}\nSubject: ${m.subject}\nSnippet: ${m.snippet.slice(0, 150)}`
    )).join("\n\n");

    const prompt = [
      "Classify each email into ONE category: urgent, action_needed, fyi, junk, newsletter, billing, personal",
      "Also rate confidence 0.0-1.0",
      "",
      "Output format (one per line):",
      "1|category|confidence",
      "2|category|confidence",
      "",
      "Emails:",
      batch,
    ].join("\n");

    let classifications: Array<{ index: number; category: string; confidence: number }> = [];

    try {
      const out = await ctx.callModel({
        kind: "chat",
        privacy: "personal",
        system: "Classify emails precisely. Output ONLY the numbered format. No explanations.",
        prompt,
        maxTokens: 200,
      });

      // Parse response
      for (const line of out.text.split("\n")) {
        const match = line.match(/^(\d+)\|(\w+)\|([\d.]+)/);
        if (match) {
          const cat = match[2].toLowerCase();
          if (CATEGORIES.includes(cat as any)) {
            classifications.push({
              index: parseInt(match[1]) - 1,
              category: cat,
              confidence: parseFloat(match[3]),
            });
          }
        }
      }
    } catch (err: any) {
      ctx.log("email_triage.classify_fail", { error: err.message });
      // Fallback: mark all as "fyi" with low confidence
      classifications = newMessages.map((_, i) => ({ index: i, category: "fyi", confidence: 0.3 }));
    }

    // Store results
    const insert = db.prepare(
      `INSERT OR IGNORE INTO email_triage(id, message_id, thread_id, from_addr, subject, snippet, category, confidence, auto_action)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'none')`
    );

    let classified = 0;
    for (const c of classifications) {
      const msg = newMessages[c.index];
      if (!msg) continue;

      insert.run(
        crypto.randomUUID(),
        msg.id,
        msg.threadId,
        msg.from,
        msg.subject,
        msg.snippet,
        c.category,
        c.confidence,
      );
      classified++;
    }

    ctx.log("email_triage.complete", {
      scanned: messages.length,
      new: newMessages.length,
      classified,
    });

    return {
      scanned: messages.length,
      newMessages: newMessages.length,
      classified,
      categories: classifications.reduce((acc, c) => {
        acc[c.category] = (acc[c.category] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  },
};
