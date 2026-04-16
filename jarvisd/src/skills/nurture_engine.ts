// nurture_engine — keeps relationships warm after deals close or go quiet.
// Schedules touchpoint sequences, drafts personal messages, queues approvals.

import { db } from "../db/db.js";
import { audit } from "../lib/audit.js";
import { approvals } from "../lib/approvals.js";
import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "nurture_engine",
  title: "Nurture Engine",
  description: "Keep relationships warm: schedule touchpoints for won deals and re-engage quiet prospects. Drafts personal messages, queues for approval.",
  version: "1.0.0",
  scopes: ["llm.cloud", "memory.read"],
  routerHint: "summary",
  triggers: [
    { kind: "cron", expr: "0 9 * * 1-5" }, // weekday 9am
    { kind: "manual" },
  ],
  inputs: [
    { name: "mode", type: "string", required: false, description: "nurture_won | re_engage | both" },
    { name: "quietDays", type: "number", required: false, description: "Days of silence before re-engaging (default 30)" },
  ],
};

export const nurtureEngine: Skill = {
  manifest: { ...manifest, costTier: "cheap" } as any,

  async run(ctx) {
    const mode = String(ctx.inputs["mode"] ?? "both");
    const quietDays = Number(ctx.inputs["quietDays"] ?? 30);
    ctx.log("nurture_engine.start", { mode, quietDays });

    const results: any = { nurtured: [], reEngaged: [] };

    // ── Nurture won deals ────────────────────────────────────────
    if (mode === "nurture_won" || mode === "both") {
      const wonDeals = db.prepare(`
        SELECT * FROM crm_deals
        WHERE status = 'won'
          AND won_time >= datetime('now', '-90 days')
          AND last_activity <= datetime('now', '-14 days')
        ORDER BY value DESC LIMIT 10
      `).all() as any[];

      for (const deal of wonDeals) {
        const daysSinceTouch = Math.floor((Date.now() - new Date(deal.last_activity || deal.won_time || deal.updated_at).getTime()) / 86400000);

        // Determine touchpoint type based on time since last contact
        let touchType: string;
        if (daysSinceTouch < 30) touchType = "check_in";
        else if (daysSinceTouch < 60) touchType = "value_add";
        else touchType = "quarterly_review";

        const draftResult = await ctx.callModel({
          kind: "summary",
          prompt: `Draft a ${touchType} message for a won 3PL client.

Client: ${deal.org_name || deal.title}
Contact: ${deal.contact_name || ""}
Deal value: $${(deal.value || 0).toLocaleString()}
Won: ${deal.won_time || "recently"}
Days since last contact: ${daysSinceTouch}

${touchType === "check_in" ? "Ask how their fulfillment is going. Offer to review their setup." :
  touchType === "value_add" ? "Share a relevant tip about optimizing 3PL operations. Reference their specific setup." :
  "Suggest a quarterly business review to discuss volume trends and optimization opportunities."}

Keep under 80 words. Warm and personal, not corporate. Sign off as Samuel.`,
          maxTokens: 150,
        });

        approvals.enqueue({
          title: `Nurture: ${deal.org_name || deal.title} — ${touchType.replace(/_/g, " ")}`,
          reason: `${daysSinceTouch} days since last contact with won client ($${(deal.value || 0).toLocaleString()})`,
          skill: "nurture_engine",
          riskLevel: "low",
          payload: {
            deal_id: deal.id,
            company: deal.org_name || deal.title,
            contact: deal.contact_name,
            email: deal.contact_email,
            touchType,
            daysSinceTouch,
            message: draftResult.text.trim(),
          },
        });

        results.nurtured.push({ company: deal.org_name || deal.title, touchType, daysSinceTouch });
      }
    }

    // ── Re-engage quiet prospects ────────────────────────────────
    if (mode === "re_engage" || mode === "both") {
      const quietDeals = db.prepare(`
        SELECT * FROM crm_deals
        WHERE status = 'open'
          AND updated_at <= datetime('now', '-${quietDays} days')
        ORDER BY value DESC LIMIT 10
      `).all() as any[];

      for (const deal of quietDeals) {
        const daysSilent = Math.floor((Date.now() - new Date(deal.updated_at || deal.created_at).getTime()) / 86400000);

        const draftResult = await ctx.callModel({
          kind: "summary",
          prompt: `Draft a re-engagement email for a prospect that's gone quiet.

Company: ${deal.org_name || deal.title}
Contact: ${deal.contact_name || ""}
Stage: ${deal.stage}
Days silent: ${daysSilent}
Last known value: $${(deal.value || 0).toLocaleString()}

The email should:
- Acknowledge the gap without being pushy
- Mention something specific about their business if possible
- Offer a low-commitment next step (quick call, updated quote)
- Under 80 words. Sign off as Samuel Eddi.`,
          maxTokens: 150,
        });

        approvals.enqueue({
          title: `Re-engage: ${deal.org_name || deal.title} — ${daysSilent}d silent`,
          reason: `Deal in ${deal.stage} has been silent for ${daysSilent} days`,
          skill: "nurture_engine",
          riskLevel: "low",
          payload: {
            deal_id: deal.id,
            company: deal.org_name || deal.title,
            contact: deal.contact_name,
            email: deal.contact_email,
            stage: deal.stage,
            daysSilent,
            message: draftResult.text.trim(),
          },
        });

        results.reEngaged.push({ company: deal.org_name || deal.title, daysSilent, stage: deal.stage });
      }
    }

    audit({
      actor: "jarvis",
      action: "nurture.completed",
      metadata: { nurtured: results.nurtured.length, reEngaged: results.reEngaged.length },
    });

    return results;
  },
};
