// constraint_detector — Elon framework: find THE single biggest bottleneck.
// Where do deals get stuck? What's the gap between stages? Which stage
// has lowest conversion? Output: one constraint, affected deals, fix action.

import { db } from "../db/db.js";
import { audit } from "../lib/audit.js";
import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "constraint_detector",
  title: "Constraint Detector",
  description: "Find the single biggest bottleneck in the pipeline. Which stage kills deals? What's the fix?",
  version: "1.0.0",
  scopes: ["llm.cloud", "memory.read"],
  routerHint: "chat",
  triggers: [
    { kind: "cron", expr: "0 8 * * 3" }, // Wednesday 8am
    { kind: "manual" },
  ],
  inputs: [],
};

export const constraintDetector: Skill = {
  manifest: { ...manifest, costTier: "standard" } as any,

  async run(ctx) {
    ctx.log("constraint_detector.start");

    const allDeals = db.prepare("SELECT * FROM crm_deals ORDER BY created_at DESC").all() as any[];
    const wonDeals = allDeals.filter((d: any) => d.status === "won");
    const lostDeals = allDeals.filter((d: any) => d.status === "lost");
    const openDeals = allDeals.filter((d: any) => d.status === "open");

    // Stage transition analysis
    const stages: Record<string, { open: number; won: number; lost: number; totalDays: number; stuckDeals: any[] }> = {};

    for (const d of allDeals) {
      const stage = d.stage || "unknown";
      if (!stages[stage]) stages[stage] = { open: 0, won: 0, lost: 0, totalDays: 0, stuckDeals: [] };

      if (d.status === "open") stages[stage].open++;
      else if (d.status === "won") stages[stage].won++;
      else if (d.status === "lost") stages[stage].lost++;

      stages[stage].totalDays += d.days_in_stage || 0;

      // Flag deals stuck > 14 days in this stage
      if (d.status === "open" && (d.days_in_stage || 0) > 14) {
        stages[stage].stuckDeals.push({
          company: d.org_name || d.title,
          days: d.days_in_stage,
          value: d.value || 0,
          lastActivity: d.last_activity,
        });
      }
    }

    // Calculate conversion rate per stage
    const stageAnalysis = Object.entries(stages).map(([name, data]) => {
      const total = data.open + data.won + data.lost;
      const conversionRate = total > 0 ? Math.round(((data.won) / Math.max(data.won + data.lost, 1)) * 100) : 0;
      const avgDays = total > 0 ? Math.round(data.totalDays / total) : 0;
      return {
        stage: name,
        total,
        open: data.open,
        won: data.won,
        lost: data.lost,
        conversionRate,
        avgDays,
        stuckCount: data.stuckDeals.length,
        stuckDeals: data.stuckDeals.sort((a: any, b: any) => b.days - a.days).slice(0, 5),
      };
    }).sort((a, b) => a.conversionRate - b.conversionRate);

    const dataBlock = `
STAGE-BY-STAGE ANALYSIS:
${stageAnalysis.map(s =>
  `${s.stage}:
    Total: ${s.total} | Open: ${s.open} | Won: ${s.won} | Lost: ${s.lost}
    Conversion: ${s.conversionRate}% | Avg days: ${s.avgDays}
    Stuck >14d: ${s.stuckCount} deals
    ${s.stuckDeals.length > 0 ? `Top stuck: ${s.stuckDeals.map((d: any) => `${d.company} (${d.days}d, $${d.value.toLocaleString()})`).join(", ")}` : ""}`
).join("\n\n")}

PIPELINE SUMMARY:
Total: ${allDeals.length} | Open: ${openDeals.length} | Won: ${wonDeals.length} | Lost: ${lostDeals.length}`;

    const result = await ctx.callModel({
      kind: "chat",
      system: "You are a Theory of Constraints expert. Find THE one bottleneck that, if fixed, would unlock the most pipeline value. Be specific.",
      prompt: `Find the single biggest constraint in this 3PL sales pipeline.

${dataBlock}

Return a JSON object:
{
  "constraint": "<the ONE biggest bottleneck — be specific>",
  "stage": "<which stage>",
  "evidence": "<the numbers that prove this is the bottleneck>",
  "impact": "<how much revenue is trapped behind this constraint>",
  "affected_deals": [
    {"company": "<name>", "days_stuck": <n>, "value": <n>}
  ],
  "fix": {
    "action": "<the specific action to take this week>",
    "expected_result": "<what should happen if the fix works>",
    "timeline": "<when to check if it worked>"
  }
}`,
      maxTokens: 500,
    });

    let analysis: any;
    try {
      analysis = JSON.parse(result.text.trim().replace(/```json?\n?/g, "").replace(/```/g, ""));
    } catch {
      analysis = { raw: result.text.trim() };
    }

    db.prepare(`
      INSERT INTO jarvis_outputs(id, kind, title, body, created_at, skill)
      VALUES (?, 'constraint', ?, ?, datetime('now'), 'constraint_detector')
    `).run(crypto.randomUUID(), `Constraint: ${analysis.constraint?.slice(0, 60) || "detected"}`, JSON.stringify(analysis));

    audit({
      actor: "jarvis",
      action: "constraint.detected",
      metadata: { constraint: analysis.constraint, stage: analysis.stage },
    });

    return analysis;
  },
};
