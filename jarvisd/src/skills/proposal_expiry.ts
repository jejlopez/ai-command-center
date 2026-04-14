// proposal_expiry — checks proposals expiring within 3 days and creates JARVIS suggestions.
// Cron: 8am weekdays.

import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";
import { supaFetch, supaInsert } from "../lib/supabase_client.js";

const manifest: SkillManifest = {
  name: "proposal_expiry",
  title: "Proposal Expiry Alerts",
  description: "Alerts when proposals are expiring within 3 days",
  version: "0.1.0",
  scopes: ["memory.read"],
  routerHint: "summary",
  triggers: [
    { kind: "cron", expr: "0 8 * * 1-5" },
    { kind: "manual" },
  ],
};

export const proposalExpiry: Skill = {
  manifest,
  async run(ctx) {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const in3Days = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const proposals = await supaFetch(
      'proposals',
      `valid_until=gte.${todayStr}&valid_until=lte.${in3Days}&status=in.(draft,sent)&select=*`
    );

    if (proposals.length === 0) {
      ctx.log("proposal_expiry.none");
      return { skipped: true, reason: "no expiring proposals" };
    }

    const rows = proposals.map((p: any) => {
      const validUntil = p.valid_until;
      const daysLeft = Math.ceil(
        (new Date(validUntil).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      const dealName = p.name ?? p.company_name ?? p.company ?? "Proposal";
      return {
        type: 'proposal_expiry',
        title: `Proposal for ${dealName} expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} — follow up`,
        body: `Proposal "${p.name ?? dealName}" (${p.status ?? 'sent'}) expires on ${validUntil}. Follow up to keep it alive.`,
        metadata: {
          proposal_id: p.id,
          deal_name: dealName,
          valid_until: validUntil,
          days_left: daysLeft,
          status: p.status,
        },
        created_at: new Date().toISOString(),
        date: todayStr,
      };
    });

    await supaInsert('jarvis_suggestions', rows);

    ctx.log("proposal_expiry.done", { count: proposals.length });
    return { proposals_expiring: proposals.length, suggestions_created: rows.length };
  },
};
