// compounding_revenue_tracker — Buffett framework: compound interest in relationships.
// For every active client: initial value, current value, growth rate, referrals,
// lifetime value projection. Flag expansion opportunities and flat clients.

import { db } from "../db/db.js";
import { audit } from "../lib/audit.js";
import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "compounding_revenue_tracker",
  title: "Compounding Revenue Tracker",
  description: "Monthly client value analysis: growth rates, lifetime projections, expansion opportunities, flat client alerts.",
  version: "1.0.0",
  scopes: ["llm.cloud", "memory.read"],
  routerHint: "chat",
  triggers: [
    { kind: "cron", expr: "0 10 1 * *" }, // 1st of every month 10am
    { kind: "manual" },
  ],
  inputs: [],
};

export const compoundingRevenueTracker: Skill = {
  manifest: { ...manifest, costTier: "standard" } as any,

  async run(ctx) {
    ctx.log("compounding_revenue_tracker.start");

    // Pull all won deals (active clients)
    const clients = db.prepare(`
      SELECT * FROM crm_deals
      WHERE status = 'won'
      ORDER BY value DESC
    `).all() as any[];

    if (clients.length === 0) return { message: "No won clients to analyze" };

    // Analyze each client
    const analysis: any[] = [];

    for (const client of clients) {
      const initialValue = client.value || 0;
      const wonDate = client.won_time || client.updated_at || client.created_at;
      const monthsActive = wonDate
        ? Math.max(1, Math.floor((Date.now() - new Date(wonDate).getTime()) / (30.44 * 86400000)))
        : 1;

      // Check for expansion signals in notes
      const notes = (client.notes_summary || "").toLowerCase();
      const hasExpansionSignals = /expand|grow|additional|more volume|new product|second location|scaling/i.test(notes);
      const hasFrustration = /issue|problem|complaint|delay|concern|unhappy/i.test(notes);

      // Activity trend — are interactions increasing or decreasing?
      const recentActivities = db.prepare(`
        SELECT COUNT(*) as cnt FROM crm_activities
        WHERE deal_id = ? AND synced_at >= datetime('now', '-30 days')
      `).get(client.id) as any;
      const olderActivities = db.prepare(`
        SELECT COUNT(*) as cnt FROM crm_activities
        WHERE deal_id = ? AND synced_at >= datetime('now', '-90 days') AND synced_at < datetime('now', '-30 days')
      `).get(client.id) as any;

      const recentCount = recentActivities?.cnt || 0;
      const olderCount = olderActivities?.cnt || 0;
      const activityTrend = olderCount > 0 ? (recentCount - olderCount / 2) / Math.max(olderCount / 2, 1) : 0;

      // Growth classification
      let growthRate = 0; // annual growth rate estimate
      let category: "compounding" | "stable" | "flat" | "declining";

      if (hasExpansionSignals && activityTrend > 0) {
        growthRate = 0.3; // 30% estimated growth
        category = "compounding";
      } else if (activityTrend > 0 && !hasFrustration) {
        growthRate = 0.1;
        category = "stable";
      } else if (hasFrustration || activityTrend < -0.3) {
        growthRate = -0.1;
        category = "declining";
      } else {
        growthRate = 0;
        category = "flat";
      }

      // Lifetime value projection (3-year)
      const year1 = initialValue;
      const year2 = Math.round(initialValue * (1 + growthRate));
      const year3 = Math.round(initialValue * Math.pow(1 + growthRate, 2));
      const ltv3yr = year1 + year2 + year3;

      // Referral value (estimated from referral mentions)
      const hasReferrals = /referr|recommend|intro/i.test(notes);
      const referralValue = hasReferrals ? Math.round(initialValue * 0.5) : 0;

      analysis.push({
        company: client.org_name || client.title,
        contact: client.contact_name,
        initialValue,
        currentValue: initialValue, // would need billing data for actual
        monthsActive,
        growthRate: Math.round(growthRate * 100),
        category,
        ltv3yr,
        referralValue,
        totalProjectedValue: ltv3yr + referralValue,
        expansionSignals: hasExpansionSignals,
        frustrationSignals: hasFrustration,
        activityTrend: activityTrend > 0.2 ? "increasing" : activityTrend < -0.2 ? "decreasing" : "steady",
        recentActivities: recentCount,
      });
    }

    analysis.sort((a, b) => b.totalProjectedValue - a.totalProjectedValue);

    const compounding = analysis.filter(a => a.category === "compounding");
    const flat = analysis.filter(a => a.category === "flat");
    const declining = analysis.filter(a => a.category === "declining");

    // Total portfolio metrics
    const totalCurrentRevenue = analysis.reduce((s, a) => s + a.initialValue, 0);
    const totalLTV = analysis.reduce((s, a) => s + a.ltv3yr, 0);
    const expansionOpportunities = analysis.filter(a => a.expansionSignals);

    // Use LLM for strategic summary
    const result = await ctx.callModel({
      kind: "chat",
      prompt: `Analyze this client portfolio for a 3PL company and provide strategic recommendations.

PORTFOLIO:
${analysis.slice(0, 15).map(a =>
  `${a.company}: $${a.initialValue.toLocaleString()}/yr | ${a.category} | Growth: ${a.growthRate}% | LTV: $${a.ltv3yr.toLocaleString()} | Activities: ${a.recentActivities}/mo`
).join("\n")}

SUMMARY:
Clients: ${clients.length} | Revenue: $${totalCurrentRevenue.toLocaleString()}/yr
Compounding: ${compounding.length} | Flat: ${flat.length} | Declining: ${declining.length}
3yr LTV projection: $${totalLTV.toLocaleString()}
Expansion opportunities: ${expansionOpportunities.length}

Return JSON:
{
  "portfolio_health": "<one sentence assessment>",
  "top_expansion": [{"company": "<name>", "action": "<specific expansion play>"}],
  "at_risk": [{"company": "<name>", "action": "<retention play>"}],
  "recommendation": "<single most impactful action for revenue growth>"
}`,
      maxTokens: 400,
    });

    let strategic: any;
    try {
      strategic = JSON.parse(result.text.trim().replace(/```json?\n?/g, "").replace(/```/g, ""));
    } catch {
      strategic = { portfolio_health: result.text.trim() };
    }

    db.prepare(`
      INSERT INTO jarvis_outputs(id, kind, title, body, created_at, skill)
      VALUES (?, 'revenue', ?, ?, datetime('now'), 'compounding_revenue_tracker')
    `).run(
      crypto.randomUUID(),
      `Revenue Compounding — $${totalCurrentRevenue.toLocaleString()} → $${totalLTV.toLocaleString()} (3yr)`,
      JSON.stringify({ analysis: analysis.slice(0, 10), strategic, totals: { current: totalCurrentRevenue, ltv: totalLTV, compounding: compounding.length, flat: flat.length, declining: declining.length } }),
    );

    audit({
      actor: "jarvis",
      action: "revenue.analyzed",
      metadata: { clients: clients.length, current: totalCurrentRevenue, ltv3yr: totalLTV },
    });

    return {
      clients: clients.length,
      totalRevenue: totalCurrentRevenue,
      ltv3yr: totalLTV,
      compounding: compounding.length,
      flat: flat.length,
      declining: declining.length,
      topClients: analysis.slice(0, 5).map(a => ({ company: a.company, value: a.initialValue, category: a.category, ltv: a.ltv3yr })),
      ...strategic,
    };
  },
};
