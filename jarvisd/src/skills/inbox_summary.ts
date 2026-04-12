// inbox_summary — summarizes recent Gmail messages into a crisp 3-bullet summary.

import { listRecentMessages, gmailStatus } from "../lib/providers/gmail.js";
import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

export interface InboxSummary {
  generatedAt: string;
  count: number;
  text: string;
  messages: Array<{ from?: string; subject?: string; snippet: string }>;
  model: string;
  costUsd: number;
}

const manifest: SkillManifest = {
  name: "inbox_summary",
  title: "Inbox Summary",
  description: "Summarize recent Gmail messages into 3 bullets.",
  version: "0.2.0",
  scopes: ["gmail.read", "llm.cloud"],
  routerHint: "summary",
  triggers: [{ kind: "manual" }],
  inputs: [
    { name: "max", type: "number", required: false, default: 10, description: "Max messages to scan" },
  ],
};

export const inboxSummarySkill: Skill = {
  manifest,
  async run(ctx) {
    const status = gmailStatus();
    if (!status.linked) {
      return { error: "Gmail not linked. Connect it in Settings > Connectors.", text: null };
    }

    const max = Number(ctx.inputs["max"] ?? 10);
    const messages = await listRecentMessages(max);
    const condensed = messages.map((m) => ({
      from: m.from,
      subject: m.subject,
      snippet: m.snippet,
    }));

    if (messages.length === 0) {
      return { text: "No recent messages found.", count: 0 };
    }

    const prompt = condensed
      .map((m, i) => `[${i + 1}] From: ${m.from}\nSubject: ${m.subject}\nSnippet: ${m.snippet}`)
      .join("\n\n");

    try {
      const out = await ctx.callModel({
        kind: "summary",
        system: "You are JARVIS. Give the user a crisp, 3-bullet summary of their inbox. No preamble.",
        prompt,
        maxTokens: 300,
      });
      return {
        text: out.text.trim(),
        count: messages.length,
        messages: condensed,
        model: out.model,
        costUsd: out.costUsd,
      };
    } catch (err: any) {
      ctx.log("inbox_summary.model.fail", { error: err?.message ?? String(err) });
      return {
        text: `${messages.length} unread messages. Model unavailable for summary.`,
        count: messages.length,
        messages: condensed,
        fallback: true,
      };
    }
  },
};

// Backward compat — old code imported summarizeInbox directly.
export async function summarizeInbox(max = 10): Promise<InboxSummary> {
  // This is a thin shim; new code should use the skill registry.
  const status = gmailStatus();
  if (!status.linked) throw new Error(status.error ?? "gmail not linked");
  const messages = await listRecentMessages(max);
  return {
    generatedAt: new Date().toISOString(),
    count: messages.length,
    text: `${messages.length} messages found. Run the inbox_summary skill for a full summary.`,
    messages: messages.map((m) => ({ from: m.from, subject: m.subject, snippet: m.snippet })),
    model: "none",
    costUsd: 0,
  };
}
