// follow_up_suggest — scans recent memory for stale threads that need a follow-up.

import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "follow_up_suggest",
  title: "Follow-up Suggestions",
  description: "Scan memory for items that may need a follow-up action.",
  version: "0.1.0",
  scopes: ["memory.read", "llm.cloud"],
  routerHint: "summary",
  triggers: [
    { kind: "manual" },
    { kind: "cron", expr: "0 10 * * *" },
  ],
  inputs: [
    { name: "days", type: "number", required: false, default: 7, description: "Look back N days" },
  ],
};

export const followUpSuggest: Skill = {
  manifest,
  async run(ctx) {
    const days = Number(ctx.inputs["days"] ?? 7);
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const nodes = ctx.memory.list("task", 30);
    const events = ctx.memory.list("event", 20);
    const people = ctx.memory.list("person", 15);

    if (nodes.length === 0 && events.length === 0) {
      return { suggestions: [], message: "No recent activity to review." };
    }

    const items = [
      ...nodes.map((n: any) => `[task] ${n.label}: ${n.body ?? "(no detail)"}`),
      ...events.map((n: any) => `[event] ${n.label}: ${n.body ?? "(no detail)"}`),
      ...people.map((n: any) => `[person] ${n.label}`),
    ].join("\n");

    const prompt = [
      `Review these recent items from the last ${days} days and suggest which need follow-up:`,
      "",
      items,
      "",
      "For each suggestion, provide:",
      "- WHO or WHAT needs follow-up",
      "- WHY (what might be stale or pending)",
      "- SUGGESTED ACTION (one sentence)",
      "",
      "Return as a numbered list. If nothing needs follow-up, say so.",
    ].join("\n");

    try {
      const out = await ctx.callModel({
        kind: "summary",
        system: "You are JARVIS, the user's chief of staff. Identify items that need follow-up. Be specific and actionable.",
        prompt,
        maxTokens: 500,
      });
      return {
        suggestions: out.text.trim(),
        itemsReviewed: nodes.length + events.length + people.length,
        days,
        model: out.model,
        costUsd: out.costUsd,
      };
    } catch (err: any) {
      return {
        suggestions: `Could not reach model. ${nodes.length + events.length} items found in the last ${days} days.`,
        fallback: true,
      };
    }
  },
};
