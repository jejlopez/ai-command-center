// deal_stage_automation — detects recent stage changes and auto-suggests next steps.
// Runs every 15 min during business hours on weekdays.

import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";
import { supaFetch, supaInsert } from "../lib/supabase_client.js";

const manifest: SkillManifest = {
  name: "deal_stage_automation",
  title: "Deal Stage Automations",
  description: "Auto-suggests next steps when deals change stage",
  version: "0.1.0",
  scopes: ["memory.read"],
  routerHint: "summary",
  triggers: [
    { kind: "cron", expr: "*/15 8-18 * * 1-5" },
    { kind: "manual" },
  ],
};

type Suggestion = {
  type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  created_at: string;
  date: string;
};

export const dealStageAutomation: Skill = {
  manifest,
  async run(ctx) {
    const since = new Date(Date.now() - 20 * 60 * 1000).toISOString(); // last 20 min
    const today = new Date().toISOString().slice(0, 10);

    const recentDeals = await supaFetch(
      'deals',
      `updated_at=gte.${since}&select=id,company_name,company,stage,value,probability,notes`
    );

    if (recentDeals.length === 0) {
      return { skipped: true, reason: "no recent deal changes" };
    }

    // Check existing suggestions for these deals today to avoid duplicates
    const dealIds = recentDeals.map((d: any) => d.id);
    const existingSuggestions = await supaFetch(
      'jarvis_suggestions',
      `date=eq.${today}&type=in.(deal_automation_quoted,deal_automation_negotiating,deal_automation_won,deal_automation_lost)&select=metadata`
    );
    const alreadyHandled = new Set(
      existingSuggestions.map((s: any) => s.metadata?.deal_id).filter(Boolean)
    );

    const rows: Suggestion[] = [];

    for (const deal of recentDeals as any[]) {
      const id = deal.id;
      if (alreadyHandled.has(id)) continue;

      const company = deal.company_name ?? deal.company ?? 'Unknown';
      const stage = deal.stage;
      const now = new Date().toISOString();

      if (stage === 'quoted' || stage === 'proposal') {
        rows.push({
          type: 'deal_automation_quoted',
          title: `${company} moved to Quoted — create a proposal`,
          body: `${company} is in the quoted stage. Create and send a detailed proposal to keep momentum going.`,
          metadata: { deal_id: id, company, stage, trigger: 'stage_quoted' },
          created_at: now,
          date: today,
        });
      } else if (stage === 'negotiating' || stage === 'negotiation') {
        rows.push({
          type: 'deal_automation_negotiating',
          title: `${company} in Negotiation — start follow-up sequence`,
          body: `${company} has entered negotiation. Start a structured follow-up sequence to close within 2 weeks.`,
          metadata: { deal_id: id, company, stage, trigger: 'stage_negotiating' },
          created_at: now,
          date: today,
        });
      } else if (stage === 'closed_won') {
        rows.push({
          type: 'deal_automation_won',
          title: `${company} WON — capture win reason + start onboarding`,
          body: `Congrats! ${company} is marked as closed won. Capture the win reason and kick off the onboarding checklist.`,
          metadata: { deal_id: id, company, stage, trigger: 'stage_won' },
          created_at: now,
          date: today,
        });
      } else if (stage === 'closed_lost') {
        rows.push({
          type: 'deal_automation_lost',
          title: `${company} marked as Lost — capture loss reason`,
          body: `${company} is marked closed lost. Capture why to improve future win rates.`,
          metadata: { deal_id: id, company, stage, trigger: 'stage_lost' },
          created_at: now,
          date: today,
        });
      }
    }

    if (rows.length > 0) {
      await supaInsert('jarvis_suggestions', rows);
    }

    ctx.log("deal_stage_automation.done", { checked: recentDeals.length, suggestions: rows.length });
    return { deals_checked: recentDeals.length, suggestions_created: rows.length };
  },
};
