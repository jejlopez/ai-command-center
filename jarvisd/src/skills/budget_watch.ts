// budget_watch — watches today's LLM spend against the daily budget.
// Runs at 9am daily, on the cost.budget_threshold event, or manually.
// Uses the local model (privacy: secret) for any prompt it composes so
// budget data never leaves the machine.

import { episodic } from "../lib/episodic.js";
import { spentTodayUsd, dailyBudgetUsd } from "../lib/cost.js";
import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "budget_watch",
  title: "Budget Watch",
  description:
    "Checks daily LLM spend vs. budget and warns when it crosses 80%. Uses local model only.",
  version: "0.1.0",
  scopes: ["memory.read", "llm.local"],
  routerHint: "classification",
  triggers: [
    { kind: "cron", expr: "0 9 * * *" },
    { kind: "event", event: "cost.budget_threshold" },
    { kind: "manual" },
  ],
};

export const budgetWatch: Skill = {
  manifest,
  async run(ctx) {
    const spent = Number(spentTodayUsd().toFixed(4));
    const budget = dailyBudgetUsd();
    const ratio = budget > 0 ? spent / budget : 0;
    const threshold = 0.8;
    const over = ratio >= threshold;

    if (!over) {
      return {
        status: "ok",
        spentUsd: spent,
        budgetUsd: budget,
        ratio: Number(ratio.toFixed(3)),
      };
    }

    // Generate a brief, local-only warning line for the episodic log.
    let warningText = `Budget warning: spent $${spent.toFixed(2)} of $${budget.toFixed(2)} (${Math.round(ratio * 100)}%).`;
    try {
      const out = await ctx.callModel({
        kind: "classification",
        privacy: "secret",
        system: "Write a one-sentence budget warning. Direct, no preamble.",
        prompt: `Spent $${spent.toFixed(2)} of $${budget.toFixed(2)} today (${Math.round(ratio * 100)}%). Warn the user.`,
        maxTokens: 80,
      });
      if (out.text.trim()) warningText = out.text.trim();
    } catch (err: any) {
      ctx.log("budget.model.fail", { error: err?.message ?? String(err) });
    }

    episodic.snapshot({
      kind: "custom",
      title: "Budget threshold crossed",
      body: { warning: warningText, spent, budget, ratio },
      actor: "skill:budget_watch",
    });

    return {
      status: "warning",
      spentUsd: spent,
      budgetUsd: budget,
      ratio: Number(ratio.toFixed(3)),
      warning: warningText,
    };
  },
};
