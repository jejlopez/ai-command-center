// auto_daily_snapshot — captures daily metrics at 9pm every day.
// Covers deals, trading, meetings, AI spend, and completed follow-ups.

import type { Skill } from "../lib/skills.js";
import { supaFetch, supaUpsert } from "../lib/supabase_client.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "auto_daily_snapshot",
  title: "Auto Daily Snapshot",
  description: "Auto-capture daily metrics — deals, trading, meetings, costs",
  version: "0.1.0",
  scopes: ["memory.read"],
  routerHint: "summary",
  triggers: [
    { kind: "cron", expr: "0 21 * * *" }, // 9pm daily
    { kind: "manual" },
  ],
  inputs: [],
};

export const autoDailySnapshot: Skill = {
  manifest,

  async run(ctx) {
    const today = new Date().toISOString().slice(0, 10);

    // Deals
    const deals = await supaFetch(
      "deals",
      "select=id,value_usd,stage,last_touch,updated_at"
    );
    const activeDeals = deals.filter(
      (d: any) => !["closed_won", "closed_lost"].includes(d.stage)
    );
    const touchedToday = deals.filter(
      (d: any) =>
        d.last_touch?.startsWith(today) || d.updated_at?.startsWith(today)
    );
    const pipelineValue = activeDeals.reduce(
      (s: number, d: any) => s + (d.value_usd ?? 0),
      0
    );

    // Trading
    const journal = await supaFetch(
      "trade_journal",
      `select=pnl_usd,wins,losses&date=eq.${today}`
    );
    const tj = journal[0];

    // Comms (proxy for meetings)
    const comms = await supaFetch(
      "communications",
      `select=id,type&occurred_at=gte.${today}T00:00:00Z&occurred_at=lte.${today}T23:59:59Z`
    );
    const meetings = comms.filter((c: any) =>
      ["meeting", "call", "discovery_call"].includes(c.type)
    );

    // AI spend from cost endpoint
    let aiSpend = 0;
    try {
      const costRes = await fetch(
        `http://127.0.0.1:${process.env.JARVIS_PORT ?? 8787}/cost/today`
      );
      if (costRes.ok) {
        const cost = await costRes.json();
        aiSpend = cost.spentUsd ?? 0;
      }
    } catch {
      // Cost endpoint unavailable — skip
    }

    // Follow-ups completed today
    const completedFu = await supaFetch(
      "follow_ups",
      `select=id&status=eq.done&completed_at=gte.${today}T00:00:00Z`
    );

    await supaUpsert(
      "daily_snapshot",
      {
        date: today,
        open_deals: activeDeals.length,
        pipeline_value: pipelineValue,
        deals_touched: touchedToday.length,
        trading_pnl: tj?.pnl_usd ?? 0,
        trades_taken: (tj?.wins ?? 0) + (tj?.losses ?? 0),
        meetings_count: meetings.length,
        tasks_completed: completedFu.length,
        ai_spend_usd: aiSpend,
      },
      "user_id,date"
    );

    ctx.log(
      `Daily snapshot captured: ${activeDeals.length} deals, ${meetings.length} meetings, $${pipelineValue.toLocaleString()} pipeline`
    );
    return { captured: true };
  },
};
