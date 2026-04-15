// pipeline_snapshot — weekly pipeline state capture for trend tracking.
// Runs every Sunday at 8pm (cron).

import type { Skill } from "../lib/skills.js";
import { supaFetch, supaUpsert } from "../lib/supabase_client.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "pipeline_snapshot",
  title: "Weekly Pipeline Snapshot",
  description: "Weekly pipeline snapshot — captures pipeline state for trend tracking",
  version: "0.1.0",
  scopes: ["memory.read"],
  routerHint: "summary",
  triggers: [
    { kind: "cron", expr: "0 20 * * 0" }, // Sunday 8pm
    { kind: "manual" },
  ],
  inputs: [],
};

export const pipelineSnapshot: Skill = {
  manifest,

  async run(ctx) {
    const today = new Date().toISOString().slice(0, 10);

    const deals = await supaFetch("deals", "select=*");
    const activeDeals = deals.filter(
      (d: any) => !["closed_won", "closed_lost"].includes(d.stage)
    );
    const wonThisMonth = deals.filter(
      (d: any) =>
        d.stage === "closed_won" && d.updated_at?.startsWith(today.slice(0, 7))
    );
    const lostThisMonth = deals.filter(
      (d: any) =>
        d.stage === "closed_lost" && d.updated_at?.startsWith(today.slice(0, 7))
    );

    const pipelineValue = activeDeals.reduce(
      (s: number, d: any) => s + (d.value_usd ?? 0),
      0
    );
    const wonValue = wonThisMonth.reduce(
      (s: number, d: any) => s + (d.value_usd ?? 0),
      0
    );
    const winRate =
      wonThisMonth.length + lostThisMonth.length > 0
        ? Math.round(
            (wonThisMonth.length /
              (wonThisMonth.length + lostThisMonth.length)) *
              100
          )
        : 0;

    await supaUpsert(
      "daily_snapshot",
      {
        date: today,
        open_deals: activeDeals.length,
        pipeline_value: pipelineValue,
        deals_touched: deals.filter((d: any) => {
          const lastTouch = new Date(d.last_touch ?? d.updated_at ?? 0);
          return Date.now() - lastTouch.getTime() < 7 * 86400000;
        }).length,
        notes: `Weekly snapshot: ${activeDeals.length} active deals ($${pipelineValue.toLocaleString()}), ${wonThisMonth.length} won ($${wonValue.toLocaleString()}), ${lostThisMonth.length} lost, ${winRate}% win rate`,
      },
      "user_id,date"
    );

    ctx.log(
      `Weekly snapshot: ${activeDeals.length} deals, $${pipelineValue.toLocaleString()} pipeline`
    );
    return {
      deals: activeDeals.length,
      pipeline: pipelineValue,
      won: wonThisMonth.length,
      lost: lostThisMonth.length,
    };
  },
};
