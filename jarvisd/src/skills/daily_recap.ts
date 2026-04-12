// daily_recap — compiles today's episodic snapshots into a human recap.
// Runs at 8pm daily (cron) or on manual trigger.

import { episodic } from "../lib/episodic.js";
import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "daily_recap",
  title: "Daily Recap",
  description:
    "Summarizes today's briefs, approvals, and skill runs into a short human narrative.",
  version: "0.1.0",
  scopes: ["memory.read", "llm.cloud"],
  routerHint: "summary",
  triggers: [
    { kind: "cron", expr: "0 20 * * *" },
    { kind: "manual" },
  ],
};

export const dailyRecap: Skill = {
  manifest,
  async run(ctx) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const since = todayStart.toISOString();

    const kinds = ["brief", "approval", "skill_run"] as const;
    const snaps = kinds.flatMap((k) =>
      episodic.list({ kind: k, since, limit: 50 })
    );
    // Sort chronologically.
    snaps.sort((a, b) => a.ts.localeCompare(b.ts));

    if (snaps.length === 0) {
      return {
        text: "No activity today. Nothing to recap.",
        summarizedCount: 0,
      };
    }

    const bullets = snaps
      .slice(0, 40)
      .map((s) => `- [${s.kind}] ${s.title}`)
      .join("\n");

    const prompt = [
      "Here is today's activity log from JARVIS:",
      "",
      bullets,
      "",
      "Write a 3-4 sentence end-of-day recap for the user. Calm, direct, second person. No preamble, no bullet points, no markdown headings.",
    ].join("\n");

    try {
      const out = await ctx.callModel({
        kind: "summary",
        system:
          "You are JARVIS, the user's personal AI chief of staff. Summarize the day in a grounded, confident tone.",
        prompt,
        maxTokens: 300,
      });
      return {
        text: out.text.trim(),
        summarizedCount: snaps.length,
        model: out.model,
        costUsd: out.costUsd,
      };
    } catch (err: any) {
      ctx.log("recap.model.fail", { error: err?.message ?? String(err) });
      return {
        text: `Today: ${snaps.length} events logged across briefs, approvals, and skill runs.`,
        summarizedCount: snaps.length,
        fallback: true,
      };
    }
  },
};
