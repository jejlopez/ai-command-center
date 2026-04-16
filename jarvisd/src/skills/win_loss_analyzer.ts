// win_loss_analyzer — weekly analysis of closed deals (won + lost) to find patterns,
// update rate_optimizer, and surface lessons for future deals.

import { db } from "../db/db.js";
import { audit } from "../lib/audit.js";
import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "win_loss_analyzer",
  title: "Win/Loss Analyzer",
  description: "Analyze closed deals from last 30 days. Find win/loss patterns, pricing insights, competitor trends. Feeds rate_optimizer.",
  version: "1.0.0",
  scopes: ["llm.cloud", "memory.read", "memory.write"],
  routerHint: "chat",
  triggers: [
    { kind: "cron", expr: "0 7 * * 1" }, // Monday 7am
    { kind: "manual" },
  ],
  inputs: [
    { name: "days", type: "number", required: false, description: "Look-back period in days (default 30)" },
  ],
};

export const winLossAnalyzer: Skill = {
  manifest: { ...manifest, costTier: "standard" } as any,

  async run(ctx) {
    const days = Number(ctx.inputs["days"] ?? 30);
    ctx.log("win_loss_analyzer.start", { days });

    // Pull closed deals from SQLite
    const closedDeals = db.prepare(`
      SELECT * FROM crm_deals
      WHERE status IN ('won', 'lost')
        AND updated_at >= datetime('now', '-${days} days')
      ORDER BY updated_at DESC
    `).all() as any[];

    if (closedDeals.length === 0) {
      return { message: `No closed deals in the last ${days} days` };
    }

    const won = closedDeals.filter((d: any) => d.status === "won");
    const lost = closedDeals.filter((d: any) => d.status === "lost");

    // Gather notes for each deal
    const dealSummaries = closedDeals.map((d: any) => {
      const notes = db.prepare("SELECT content FROM crm_notes WHERE deal_id = ? LIMIT 3").all(d.id) as any[];
      const noteText = notes.map((n: any) => (n.content || "").replace(/<[^>]*>/g, "").slice(0, 200)).join(" | ");
      return `[${d.status.toUpperCase()}] ${d.org_name || d.title} — $${(d.value || 0).toLocaleString()} — Stage: ${d.stage} — ${d.lost_reason || ""}\nNotes: ${noteText || "none"}`;
    }).join("\n\n");

    const result = await ctx.callModel({
      kind: "chat",
      system: "You are a sales analytics expert for a 3PL logistics company. Analyze win/loss patterns with data-driven insights.",
      prompt: `Analyze these ${closedDeals.length} closed deals from the last ${days} days.

${dealSummaries}

Return a JSON object:
{
  "summary": "<3 sentence executive summary>",
  "win_rate": <percentage>,
  "avg_deal_size_won": <number>,
  "avg_deal_size_lost": <number>,
  "patterns": {
    "why_we_win": ["<pattern 1>", "<pattern 2>"],
    "why_we_lose": ["<pattern 1>", "<pattern 2>"],
    "competitor_mentions": ["<competitor — context>"],
    "pricing_insights": "<what pricing worked vs didn't>",
    "stage_where_deals_die": "<most common stage for losses>"
  },
  "recommendations": ["<action 1>", "<action 2>", "<action 3>"],
  "rate_optimizer_update": {
    "adjust_storage": "<up | down | hold>",
    "adjust_pick_pack": "<up | down | hold>",
    "reason": "<why>"
  }
}`,
      maxTokens: 600,
    });

    let analysis: any;
    try {
      analysis = JSON.parse(result.text.trim().replace(/```json?\n?/g, "").replace(/```/g, ""));
    } catch {
      analysis = { summary: result.text.trim() };
    }

    // Store analysis
    db.prepare(`
      INSERT INTO jarvis_outputs(id, kind, title, body, created_at, skill)
      VALUES (?, 'analysis', ?, ?, datetime('now'), 'win_loss_analyzer')
    `).run(crypto.randomUUID(), `Win/Loss Analysis — ${days}d`, JSON.stringify(analysis));

    audit({
      actor: "jarvis",
      action: "win_loss.analyzed",
      metadata: { won: won.length, lost: lost.length, winRate: analysis.win_rate },
    });

    return {
      deals: { won: won.length, lost: lost.length, total: closedDeals.length },
      ...analysis,
    };
  },
};
