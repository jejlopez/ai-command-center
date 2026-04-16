// deal_quality_scorer — Buffett framework: not all revenue is equal.
// Calculates TRUE deal value: contract + expansion + referral + strategic.
// Scores quality and flags mismatches between quality and time invested.

import { db } from "../db/db.js";
import { audit } from "../lib/audit.js";
import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "deal_quality_scorer",
  title: "Deal Quality Scorer",
  description: "Calculate TRUE deal value (contract + expansion + referral + strategic). Flag quality/effort mismatches.",
  version: "1.0.0",
  scopes: ["llm.cloud", "memory.read"],
  routerHint: "chat",
  triggers: [
    { kind: "event", event: "crm.updated" },
    { kind: "manual" },
  ],
  inputs: [
    { name: "dealId", type: "string", required: false, description: "Score a specific deal" },
  ],
};

export const dealQualityScorer: Skill = {
  manifest: { ...manifest, costTier: "standard" } as any,

  async run(ctx) {
    const specificDealId = ctx.inputs["dealId"] ? String(ctx.inputs["dealId"]) : undefined;
    ctx.log("deal_quality_scorer.start", { dealId: specificDealId });

    // Get deals to score
    let deals: any[];
    if (specificDealId) {
      const deal = db.prepare("SELECT * FROM crm_deals WHERE id = ?").get(specificDealId);
      deals = deal ? [deal] : [];
    } else {
      deals = db.prepare("SELECT * FROM crm_deals WHERE status = 'open' ORDER BY value DESC LIMIT 30").all() as any[];
    }

    if (deals.length === 0) return { message: "No deals to score" };

    const scored: any[] = [];
    const mismatches: any[] = [];

    for (const deal of deals) {
      const activities = deal.total_activities || 0;
      const value = deal.value || 0;
      const daysSinceCreated = Math.floor((Date.now() - new Date(deal.created_at || deal.updated_at).getTime()) / 86400000);
      const daysInStage = deal.days_in_stage || 0;
      const stage = (deal.stage || "").toLowerCase();
      const notes = deal.notes_summary || "";

      // ── Contract Value (what we'd bill) ──
      const contractValue = value;

      // ── Expansion Probability ──
      // Higher if: e-commerce (grows with them), mentions "growing", "expanding", multiple SKUs
      let expansionMultiplier = 1.0;
      if (/growing|expanding|scaling|launch|new product/i.test(notes)) { expansionMultiplier = 1.5; }
      if (/ecommerce|e-commerce|shopify|dtc|subscription/i.test(notes)) { expansionMultiplier *= 1.3; }
      const expansionValue = Math.round(contractValue * (expansionMultiplier - 1));

      // ── Referral Value ──
      // Higher for well-connected contacts, industry leaders
      let referralMultiplier = 0.1; // default 10% chance of referral
      if (activities > 15) referralMultiplier = 0.2;
      if (/referral|referred|recommend|partner/i.test(notes)) referralMultiplier = 0.3;
      const referralValue = Math.round(contractValue * referralMultiplier);

      // ── Strategic Value ──
      // Logo value, market positioning, case study potential
      let strategicValue = 0;
      if (/enterprise|fortune|brand|well-known/i.test(notes) || value > 100000) strategicValue = Math.round(contractValue * 0.2);

      const trueValue = contractValue + expansionValue + referralValue + strategicValue;

      // ── Quality Score (0-100) ──
      let qualityScore = 50; // baseline

      // Close probability based on stage
      if (stage.includes("negotiat") || stage.includes("signing")) qualityScore += 20;
      else if (stage.includes("proposal") || stage.includes("follow up")) qualityScore += 10;
      else if (stage.includes("demo") || stage.includes("site visit")) qualityScore += 5;

      // Time efficiency
      if (daysInStage < 7) qualityScore += 10;
      else if (daysInStage > 30) qualityScore -= 10;
      else if (daysInStage > 60) qualityScore -= 20;

      // Engagement quality
      if (deal.engagement === "hot") qualityScore += 10;
      else if (deal.engagement === "cold") qualityScore -= 15;

      // Value-to-effort ratio
      const valuePerActivity = activities > 0 ? value / activities : 0;
      if (valuePerActivity > 10000) qualityScore += 10;
      else if (valuePerActivity < 1000 && activities > 10) qualityScore -= 10;

      qualityScore = Math.max(0, Math.min(100, qualityScore));

      // ── Mismatch Detection ──
      // High effort + low quality = problem
      const effortLevel = activities > 15 ? "high" : activities > 5 ? "medium" : "low";
      const isMismatch = (effortLevel === "high" && qualityScore < 40) ||
                          (effortLevel === "high" && trueValue < 20000) ||
                          (qualityScore > 70 && effortLevel === "low" && trueValue > 50000);

      const result = {
        dealId: deal.id,
        company: deal.org_name || deal.title,
        stage: deal.stage,
        contractValue,
        expansionValue,
        referralValue,
        strategicValue,
        trueValue,
        qualityScore,
        activities,
        daysInStage,
        effortLevel,
        mismatch: isMismatch,
        mismatchReason: isMismatch
          ? effortLevel === "high" && qualityScore < 40
            ? `High effort (${activities} activities) on low-quality deal (score ${qualityScore}). Consider deprioritizing.`
            : qualityScore > 70 && effortLevel === "low"
            ? `High-quality deal (score ${qualityScore}, $${trueValue.toLocaleString()}) getting insufficient attention. Prioritize.`
            : `${activities} activities for only $${trueValue.toLocaleString()} true value. ROI concern.`
          : null,
      };

      scored.push(result);
      if (isMismatch) mismatches.push(result);

      // Update deal with quality score
      db.prepare("UPDATE crm_deals SET jarvis_score = ? WHERE id = ?")
        .run(qualityScore, deal.id);
    }

    scored.sort((a, b) => b.trueValue - a.trueValue);

    db.prepare(`
      INSERT INTO jarvis_outputs(id, kind, title, body, created_at, skill)
      VALUES (?, 'quality_score', ?, ?, datetime('now'), 'deal_quality_scorer')
    `).run(
      crypto.randomUUID(),
      `Deal Quality — ${scored.length} scored, ${mismatches.length} mismatches`,
      JSON.stringify({ scored: scored.slice(0, 10), mismatches }),
    );

    audit({
      actor: "jarvis",
      action: "deal_quality.scored",
      metadata: { deals: scored.length, mismatches: mismatches.length, avgScore: Math.round(scored.reduce((s, d) => s + d.qualityScore, 0) / scored.length) },
    });

    return {
      dealsScored: scored.length,
      avgQualityScore: Math.round(scored.reduce((s, d) => s + d.qualityScore, 0) / scored.length),
      topByTrueValue: scored.slice(0, 5).map(d => ({ company: d.company, trueValue: d.trueValue, quality: d.qualityScore })),
      mismatches: mismatches.map(d => ({ company: d.company, quality: d.qualityScore, effort: d.effortLevel, reason: d.mismatchReason })),
    };
  },
};
