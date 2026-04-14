// crm_deal_playbook — generates stage-specific action checklists when deals move stages.
// Runs every 30 min during business hours, checks for recently updated deals.

import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";
import { supaFetch, supaInsert } from "../lib/supabase_client.js";

const manifest: SkillManifest = {
  name: "crm_deal_playbook",
  title: "CRM Deal Playbook",
  description: "Generates stage-specific action checklist when a deal moves stages",
  version: "0.1.0",
  scopes: ["memory.read"],
  routerHint: "summary",
  triggers: [
    { kind: "cron", expr: "*/30 8-18 * * 1-5" },
    { kind: "manual" },
  ],
};

const STAGE_PLAYBOOKS: Record<string, string[]> = {
  prospect: [
    "Research company — size, shipping volume, current 3PL provider",
    "Find decision maker — logistics/ops director or VP of Supply Chain",
    "Send initial outreach email — personalized to their pain points",
    "Qualify need — annual shipping spend, key lanes, pain with current provider",
    "Schedule discovery call",
  ],
  quoted: [
    "Send formal proposal with lane-specific rates",
    "Schedule proposal review call within 48 hours",
    "Prepare competitive analysis — why our rates/service beat current provider",
    "Identify potential objections and prepare responses",
    "Set follow-up reminder for 3 business days if no response",
  ],
  negotiating: [
    "Document all open objections and pricing concerns",
    "Get leadership alignment on any discount thresholds",
    "Prepare final terms sheet / rate card",
    "Request legal review if custom contract terms needed",
    "Schedule 'close call' with decision maker and economic buyer",
    "Set hard deadline for decision",
  ],
  closed_won: [
    "Send signed contract and welcome packet",
    "Introduce customer to Operations / Account Management team",
    "Schedule onboarding kickoff within 5 business days",
    "Create 30-day check-in reminder",
    "Request referral or case study after 60 days",
  ],
};

export const crmDealPlaybook: Skill = {
  manifest,
  async run(ctx) {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const recentlyUpdated = await supaFetch('deals', `updated_at=gte.${thirtyMinAgo}&select=*`);

    if (recentlyUpdated.length === 0) {
      ctx.log("crm_deal_playbook.no_changes");
      return { skipped: true, reason: "no deals updated in last 30 minutes" };
    }

    const created: any[] = [];

    for (const deal of recentlyUpdated) {
      const stage = deal.stage as string;
      const items = STAGE_PLAYBOOKS[stage];
      if (!items) continue;

      const dealId = deal.id;
      const company = deal.company_name ?? deal.company ?? 'Unknown';

      // Check if checklist already exists for this deal+stage
      const existing = await supaFetch('onboarding_checklists', `deal_id=eq.${dealId}&stage=eq.${stage}&limit=1`);
      if (existing.length > 0) continue;

      const checklistItems = items.map((item, i) => ({
        order: i + 1,
        text: item,
        completed: false,
      }));

      await supaInsert('onboarding_checklists', {
        deal_id: dealId,
        company: company,
        stage: stage,
        items: checklistItems,
        created_at: new Date().toISOString(),
      });

      created.push({ deal: company, stage, itemCount: items.length });
      ctx.log("crm_deal_playbook.created", { deal: company, stage });
    }

    return { createdCount: created.length, checklists: created };
  },
};
