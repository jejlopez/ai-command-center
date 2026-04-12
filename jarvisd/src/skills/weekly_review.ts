// weekly_review — Sunday 6pm retrospective of the past 7 days.

import { episodic } from "../lib/episodic.js";
import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "weekly_review",
  title: "Weekly review",
  description:
    "A 5-sentence Sunday review of the past week, drawn from episodic memory.",
  version: "0.2.0",
  scopes: ["memory.read", "llm.cloud"],
  routerHint: "summary",
  triggers: [
    { kind: "cron", expr: "0 18 * * 0" },  // Sunday 6pm
    { kind: "manual" },
  ],
};

export const weeklyReview: Skill = {
  manifest,
  async run(ctx) {
    const now = new Date();
    const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const snaps = episodic.list({ since, limit: 500 });

    if (snaps.length === 0) {
      return {
        text: "Nothing logged this week.",
        snapshotCount: 0,
      };
    }

    // Compile by kind.
    const byKind = new Map<string, number>();
    for (const s of snaps) {
      byKind.set(s.kind, (byKind.get(s.kind) ?? 0) + 1);
    }
    const kindLines = Array.from(byKind.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `- ${k}: ${n}`)
      .join("\n");

    const bullets = snaps
      .slice(0, 60)
      .map((s) => `- [${s.kind}] ${s.title}`)
      .join("\n");

    const prompt = [
      "Write a 5-sentence Sunday review of the week for the user.",
      "Calm, grounded, second person. No preamble, no bullet points.",
      "Highlight what actually moved, what stalled, and one thing to try next week.",
      "",
      "Activity by kind:",
      kindLines,
      "",
      "Timeline (most recent first):",
      bullets,
    ].join("\n");

    try {
      const out = await ctx.callModel({
        kind: "summary",
        system:
          "You are JARVIS writing the user's Sunday retrospective. Precise, calm, confident.",
        prompt,
        maxTokens: 400,
      });
      return {
        text: out.text.trim(),
        snapshotCount: snaps.length,
        model: out.model,
        costUsd: out.costUsd,
      };
    } catch (err: any) {
      ctx.log("weekly_review.model.fail", {
        error: err?.message ?? String(err),
      });
      return {
        text: `This week: ${snaps.length} events logged (${kindLines.replace(/\n/g, ", ")}).`,
        snapshotCount: snaps.length,
        fallback: true,
      };
    }
  },
};
