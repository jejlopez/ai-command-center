// crm_pipeline_gap — weekly pipeline gap analysis, Monday 8am.
// Checks if current pipeline coverage is on track for monthly targets.

import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";
import { supaFetch, supaInsert } from "../lib/supabase_client.js";

const manifest: SkillManifest = {
  name: "crm_pipeline_gap",
  title: "CRM Pipeline Gap Analysis",
  description: "Daily pipeline gap analysis — are you on track for targets",
  version: "0.1.0",
  scopes: ["memory.read"],
  routerHint: "summary",
  triggers: [
    { kind: "cron", expr: "0 8 * * 1" },
    { kind: "manual" },
  ],
};

// Default monthly target — can be overridden by config in the future
const MONTHLY_TARGET_USD = 150_000;

function parseJsonFromLLM(text: string): any {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(cleaned);
}

export const crmPipelineGap: Skill = {
  manifest,
  async run(ctx) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const today = new Date().toISOString().slice(0, 10);

    const [closedDeals, activeDeals] = await Promise.all([
      supaFetch('deals', `stage=in.(closed_won)&updated_at=gte.${thirtyDaysAgo}&select=value,company_name,company`),
      supaFetch('deals', `stage=neq.closed_lost&stage=neq.closed_won&select=value,probability,stage,company_name,company`),
    ]);

    // Compute monthly run rate from closed deals
    const closedValue = closedDeals.reduce((sum: number, d: any) => sum + (Number(d.value) || 0), 0);
    const runRate = closedValue; // last 30 days = 1 month

    // Weighted pipeline value
    const weightedPipeline = activeDeals.reduce((sum: number, d: any) => {
      const prob = (Number(d.probability) || 20) / 100;
      return sum + (Number(d.value) || 0) * prob;
    }, 0);

    const totalPipelineValue = activeDeals.reduce((sum: number, d: any) => sum + (Number(d.value) || 0), 0);
    const coverageRatio = MONTHLY_TARGET_USD > 0 ? weightedPipeline / MONTHLY_TARGET_USD : 0;
    const gap = Math.max(0, MONTHLY_TARGET_USD - (runRate + weightedPipeline));

    const dealsNeeded = gap > 0 ? Math.ceil(gap / 25000) : 0; // assume avg deal $25k
    const hasGap = gap > 0;

    const activeLines = activeDeals.map((d: any) => {
      const prob = Number(d.probability) || 20;
      const val = Number(d.value) || 0;
      return `- ${d.company_name ?? d.company ?? 'Unknown'} | Stage: ${d.stage} | Value: $${val.toLocaleString()} | Prob: ${prob}% | Weighted: $${Math.round(val * prob / 100).toLocaleString()}`;
    }).join('\n') || '(no active deals)';

    const prompt = `You are JARVIS analyzing pipeline health for a VP of Sales at a 3PL company.

Monthly target: $${MONTHLY_TARGET_USD.toLocaleString()}
Closed last 30 days: $${closedValue.toLocaleString()} (${closedDeals.length} deals)
Active pipeline (total): $${totalPipelineValue.toLocaleString()}
Weighted pipeline: $${Math.round(weightedPipeline).toLocaleString()}
Coverage ratio: ${(coverageRatio * 100).toFixed(0)}%
Gap to target: $${Math.round(gap).toLocaleString()}

Active deals:
${activeLines}

Write a 2-3 sentence pipeline health assessment. Be direct. If there's a gap, specify what needs to happen this week to close it.`;

    try {
      const out = await ctx.callModel({
        kind: "summary",
        system: "You are JARVIS, a sharp sales AI. Be direct and specific.",
        prompt,
        maxTokens: 300,
      });

      const assessment = out.text.trim();

      const suggestionTitle = hasGap
        ? `Pipeline Gap Alert: Need ${dealsNeeded} more deals worth $${Math.round(gap).toLocaleString()} this month`
        : `Pipeline on track: ${(coverageRatio * 100).toFixed(0)}% coverage of $${MONTHLY_TARGET_USD.toLocaleString()} target`;

      await supaInsert('jarvis_suggestions', {
        type: 'pipeline_gap',
        title: suggestionTitle,
        body: assessment,
        metadata: {
          monthly_target: MONTHLY_TARGET_USD,
          run_rate: closedValue,
          weighted_pipeline: Math.round(weightedPipeline),
          coverage_ratio: Math.round(coverageRatio * 100),
          gap: Math.round(gap),
          deals_needed: dealsNeeded,
          active_deal_count: activeDeals.length,
          closed_deal_count_30d: closedDeals.length,
        },
        created_at: new Date().toISOString(),
        date: today,
      });

      ctx.memory.remember({
        kind: "event",
        label: "CRM Pipeline Gap Analysis",
        body: assessment,
      });

      ctx.log("crm_pipeline_gap.done", { coveragePct: Math.round(coverageRatio * 100), gap: Math.round(gap) });
      return {
        assessment,
        monthly_target: MONTHLY_TARGET_USD,
        run_rate: closedValue,
        weighted_pipeline: Math.round(weightedPipeline),
        coverage_ratio_pct: Math.round(coverageRatio * 100),
        gap: Math.round(gap),
        has_gap: hasGap,
        model: out.model,
        costUsd: out.costUsd,
      };
    } catch (err: any) {
      ctx.log("crm_pipeline_gap.fail", { error: err?.message ?? String(err) });
      return { error: err?.message ?? String(err) };
    }
  },
};
