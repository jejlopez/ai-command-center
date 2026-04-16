// first_principles_analyzer — Elon framework: ignore history, just do the math.
// Analyzes pipeline from scratch: close rates by industry, deal velocity by stage,
// time waste by category. Outputs what to stop and what to double down on.

import { db } from "../db/db.js";
import { audit } from "../lib/audit.js";
import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "first_principles_analyzer",
  title: "First Principles Analyzer",
  description: "Sunday pipeline analysis from scratch: close rates, deal velocity, time waste. Top 3 stop / top 3 double-down.",
  version: "1.0.0",
  scopes: ["llm.cloud", "memory.read"],
  routerHint: "chat",
  triggers: [
    { kind: "cron", expr: "0 19 * * 0" }, // Sunday 7pm
    { kind: "manual" },
  ],
  inputs: [],
};

export const firstPrinciplesAnalyzer: Skill = {
  manifest: { ...manifest, costTier: "standard" } as any,

  async run(ctx) {
    ctx.log("first_principles_analyzer.start");

    // Pull ALL deals — ignore names, focus on numbers
    const allDeals = db.prepare("SELECT * FROM crm_deals ORDER BY created_at DESC").all() as any[];
    const wonDeals = allDeals.filter((d: any) => d.status === "won");
    const lostDeals = allDeals.filter((d: any) => d.status === "lost");
    const openDeals = allDeals.filter((d: any) => d.status === "open");

    // Calculate stage velocity — avg days deals spend in each stage
    const stageGroups: Record<string, { count: number; totalDays: number; values: number[] }> = {};
    for (const d of allDeals) {
      const stage = d.stage || "unknown";
      if (!stageGroups[stage]) stageGroups[stage] = { count: 0, totalDays: 0, values: [] };
      stageGroups[stage].count++;
      stageGroups[stage].totalDays += d.days_in_stage || 0;
      stageGroups[stage].values.push(d.value || 0);
    }

    const stageStats = Object.entries(stageGroups).map(([stage, data]) => ({
      stage,
      count: data.count,
      avgDays: data.count > 0 ? Math.round(data.totalDays / data.count) : 0,
      avgValue: data.count > 0 ? Math.round(data.values.reduce((a, b) => a + b, 0) / data.count) : 0,
      totalValue: data.values.reduce((a, b) => a + b, 0),
    }));

    // Close rates
    const totalClosed = wonDeals.length + lostDeals.length;
    const closeRate = totalClosed > 0 ? Math.round((wonDeals.length / totalClosed) * 100) : 0;
    const avgWonValue = wonDeals.length > 0 ? Math.round(wonDeals.reduce((s: number, d: any) => s + (d.value || 0), 0) / wonDeals.length) : 0;
    const avgLostValue = lostDeals.length > 0 ? Math.round(lostDeals.reduce((s: number, d: any) => s + (d.value || 0), 0) / lostDeals.length) : 0;

    // Activity analysis — where is time being spent?
    const activities = db.prepare("SELECT type, COUNT(*) as cnt FROM crm_activities GROUP BY type").all() as any[];

    // Build raw data block for LLM — no narratives, just numbers
    const dataBlock = `
PIPELINE RAW DATA (ignore names, just math):

Deals: ${allDeals.length} total | ${openDeals.length} open | ${wonDeals.length} won | ${lostDeals.length} lost
Close rate: ${closeRate}%
Avg won deal: $${avgWonValue.toLocaleString()} | Avg lost deal: $${avgLostValue.toLocaleString()}

STAGE VELOCITY:
${stageStats.map(s => `  ${s.stage}: ${s.count} deals, avg ${s.avgDays} days, avg $${s.avgValue.toLocaleString()}, total $${s.totalValue.toLocaleString()}`).join("\n")}

ACTIVITY DISTRIBUTION:
${activities.map((a: any) => `  ${a.type}: ${a.cnt} activities`).join("\n")}

OPEN DEALS BY AGE:
${openDeals.slice(0, 20).map((d: any) => {
  const age = Math.floor((Date.now() - new Date(d.created_at || d.updated_at).getTime()) / 86400000);
  return `  ${age}d old | stage=${d.stage} | $${(d.value || 0).toLocaleString()} | activities=${d.total_activities || 0}`;
}).join("\n")}`;

    const result = await ctx.callModel({
      kind: "chat",
      system: "You are a first-principles analyst. Ignore stories, names, relationships. Only math matters. Be brutally honest.",
      prompt: `Analyze this 3PL sales pipeline from first principles. No history, no context, just the numbers.

${dataBlock}

Return a JSON object:
{
  "close_rate_analysis": "<is ${closeRate}% good/bad for 3PL? benchmark comparison>",
  "biggest_time_waste": "<where is the most time spent with least return>",
  "velocity_bottleneck": "<which stage has the worst days-to-value ratio>",
  "stop_doing": [
    {"action": "<specific thing to stop>", "why": "<math-based reason>", "time_saved_weekly": "<estimate>"},
    {"action": "<specific thing to stop>", "why": "<math-based reason>", "time_saved_weekly": "<estimate>"},
    {"action": "<specific thing to stop>", "why": "<math-based reason>", "time_saved_weekly": "<estimate>"}
  ],
  "double_down": [
    {"action": "<specific thing to do more>", "why": "<math-based reason>", "expected_impact": "<estimate>"},
    {"action": "<specific thing to do more>", "why": "<math-based reason>", "expected_impact": "<estimate>"},
    {"action": "<specific thing to do more>", "why": "<math-based reason>", "expected_impact": "<estimate>"}
  ],
  "one_sentence_verdict": "<the single most important insight from this data>"
}`,
      maxTokens: 600,
    });

    let analysis: any;
    try {
      analysis = JSON.parse(result.text.trim().replace(/```json?\n?/g, "").replace(/```/g, ""));
    } catch {
      analysis = { raw: result.text.trim() };
    }

    db.prepare(`
      INSERT INTO jarvis_outputs(id, kind, title, body, created_at, skill)
      VALUES (?, 'analysis', ?, ?, datetime('now'), 'first_principles_analyzer')
    `).run(crypto.randomUUID(), "First Principles Analysis", JSON.stringify(analysis));

    audit({
      actor: "jarvis",
      action: "first_principles.analyzed",
      metadata: { deals: allDeals.length, closeRate, stages: stageStats.length },
    });

    return { pipeline: { total: allDeals.length, open: openDeals.length, won: wonDeals.length, lost: lostDeals.length, closeRate }, ...analysis };
  },
};
