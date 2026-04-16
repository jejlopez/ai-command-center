// email_deal_sync — syncs Gmail threads into deal communications.
// Auto-links inbound/outbound emails to active deals three times a day.

import type { Skill } from "../lib/skills.js";
import { supaFetch, supaInsert } from "../lib/supabase_client.js";
import type { SkillManifest } from "../../../shared/types.js";

export const emailDealSync: Skill = {
  manifest: {
    name: "email_deal_sync",
    title: "Email → Deal Sync",
    description: "Sync Gmail threads into deal communications — auto-links emails to deals",
    version: "0.1.0",
    scopes: ["memory.read"],
    routerHint: "summary",
    triggers: [{ kind: "cron", expr: "0 7,12,17 * * 1-5" }],
    inputs: [],
  } as unknown as SkillManifest,

  async run(ctx) {
    ctx.log("email_deal_sync.start");

    // Get contacts with emails that have active deals
    const [contacts, deals] = await Promise.all([
      supaFetch('contacts', 'select=id,name,email&email=not.is.null'),
      supaFetch('deals', 'select=id,contact_id,company,stage&stage=not.in.(closed_won,closed_lost)'),
    ]);

    // Build contact → deal map
    const contactDeals = new Map<string, any>();
    for (const d of deals) {
      if (d.contact_id) contactDeals.set(d.contact_id, d);
    }

    const port = process.env.JARVIS_PORT ?? 8787;
    let synced = 0;

    for (const contact of contacts) {
      const deal = contactDeals.get(contact.id);
      if (!deal || !contact.email) continue;

      try {
        const q = `from:${contact.email} OR to:${contact.email}`;
        const res = await fetch(
          `http://127.0.0.1:${port}/email/search?q=${encodeURIComponent(q)}&max=5`
        );
        if (!res.ok) continue;

        const emails: any[] = await res.json();
        if (!Array.isArray(emails) || emails.length === 0) continue;

        // Fetch existing comms for this deal to dedup
        const existing = await supaFetch('communications',
          `select=id,occurred_at&deal_id=eq.${deal.id}&type=eq.email&order=occurred_at.desc&limit=20`
        );
        const existingDates = new Set(existing.map((e: any) => e.occurred_at));

        for (const email of emails) {
          // Parse date from RFC-2822 string or fall back to now
          let occurredAt: string;
          try {
            occurredAt = email.date ? new Date(email.date).toISOString() : new Date().toISOString();
          } catch {
            occurredAt = new Date().toISOString();
          }

          if (existingDates.has(occurredAt)) continue;

          await supaInsert('communications', {
            deal_id: deal.id,
            contact_id: contact.id,
            type: 'email',
            subject: email.subject ?? '(no subject)',
            body: (email.snippet ?? '').slice(0, 500),
            occurred_at: occurredAt,
          });
          synced++;
        }
      } catch (e: any) {
        ctx.log(`email_deal_sync.contact_fail:${contact.name ?? contact.email}`, { error: e?.message });
      }
    }

    ctx.log("email_deal_sync.done", { synced });
    return { synced };
  },
};
