// crm_followup_sequences — auto-creates follow-up sequences for new deals.
// Runs at 8am weekdays. Creates a standard 4-touch sequence for deals with no follow-ups.

import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";
import { supaFetch, supaInsert } from "../lib/supabase_client.js";

const manifest: SkillManifest = {
  name: "crm_followup_sequences",
  title: "CRM Follow-up Sequences",
  description: "Auto-creates follow-up sequences for new deals",
  version: "0.1.0",
  scopes: ["memory.read"],
  routerHint: "summary",
  triggers: [
    { kind: "cron", expr: "0 8 * * 1-5" },
    { kind: "manual" },
  ],
};

function addDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const crmFollowupSequences: Skill = {
  manifest,
  async run(ctx) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Fetch deals created in the last 24 hours
    const newDeals = await supaFetch('deals', `created_at=gte.${oneDayAgo}&select=*`);

    if (newDeals.length === 0) {
      ctx.log("crm_followup_sequences.no_new_deals");
      return { skipped: true, reason: "no new deals in last 24 hours" };
    }

    const created: any[] = [];

    for (const deal of newDeals) {
      const dealId = deal.id;
      const company = deal.company_name ?? deal.company ?? 'Unknown';
      const contactId = deal.contact_id ?? null;

      // Check if follow-ups already exist for this deal
      const existing = await supaFetch('follow_ups', `deal_id=eq.${dealId}&limit=1`);
      if (existing.length > 0) continue;

      const contactName = contactId ? `contact ${contactId}` : company;
      const now = new Date();

      const sequence = [
        {
          deal_id: dealId,
          contact_id: contactId,
          action: `Initial outreach to ${contactName} at ${company}`,
          due_date: addDays(now, 0),
          priority: 'high',
          completed_at: null,
          created_at: new Date().toISOString(),
        },
        {
          deal_id: dealId,
          contact_id: contactId,
          action: `Follow up if no response from ${contactName}`,
          due_date: addDays(now, 3),
          priority: 'normal',
          completed_at: null,
          created_at: new Date().toISOString(),
        },
        {
          deal_id: dealId,
          contact_id: contactId,
          action: `Second follow-up or try different contact at ${company}`,
          due_date: addDays(now, 7),
          priority: 'normal',
          completed_at: null,
          created_at: new Date().toISOString(),
        },
        {
          deal_id: dealId,
          contact_id: contactId,
          action: `Final attempt — escalate or close as lost if no response from ${company}`,
          due_date: addDays(now, 14),
          priority: 'low',
          completed_at: null,
          created_at: new Date().toISOString(),
        },
      ];

      await supaInsert('follow_ups', sequence);
      created.push({ deal: company, touchpoints: sequence.length });
      ctx.log("crm_followup_sequences.created", { deal: company, touchpoints: sequence.length });
    }

    return { createdSequences: created.length, details: created };
  },
};
