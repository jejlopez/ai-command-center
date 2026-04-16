// crm_meeting_prep — generates pre-meeting briefs for upcoming calendar events.
// Runs every 15 min during business hours, weekdays only.

import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";
import { supaFetch, supaInsert } from "../lib/supabase_client.js";

const manifest: SkillManifest = {
  name: "crm_meeting_prep",
  title: "CRM Meeting Prep",
  description: "Pre-meeting briefing — pulls all context for upcoming meetings",
  version: "0.1.0",
  scopes: ["memory.read"],
  routerHint: "summary",
  triggers: [
    { kind: "cron", expr: "0 8,10,12,14,16 * * 1-5" },  // every 2hrs business hours — checks for meetings in next 2hrs
    { kind: "manual" },
  ],
};

function parseJsonFromLLM(text: string): any {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(cleaned);
}

export const crmMeetingPrep: Skill = {
  manifest,
  async run(ctx) {
    const today = new Date().toISOString().slice(0, 10);
    const now = Date.now();
    const twoHours = 2 * 60 * 60 * 1000;

    // Fetch today's calendar events via apple provider
    let events: any[] = [];
    try {
      const calStatus = await ctx.apple.calendarStatus();
      if (calStatus.available) {
        events = await ctx.apple.getTodayEvents();
      }
    } catch (err: any) {
      ctx.log("crm_meeting_prep.calendar_fail", { error: err?.message ?? String(err) });
    }

    // Filter to events starting in the next 2 hours
    const upcoming = events.filter((e: any) => {
      const start = new Date(e.start).getTime();
      return start > now && start <= now + twoHours;
    });

    if (upcoming.length === 0) {
      ctx.log("crm_meeting_prep.no_upcoming");
      return { skipped: true, reason: "no meetings in next 2 hours" };
    }

    const results: any[] = [];

    for (const event of upcoming) {
      const meetingKey = `${today}_${event.start}_${event.title}`;

      // Check if prep already exists for this meeting today
      const existing = await supaFetch('jarvis_suggestions', `type=eq.meeting_prep&metadata->>meeting_key=eq.${encodeURIComponent(meetingKey)}&limit=1`);
      if (existing.length > 0) continue;

      // Search contacts by event title words
      const titleWords = (event.title ?? '').split(/\s+/).filter((w: string) => w.length > 2);
      let contact: any = null;
      let deal: any = null;
      let comms: any[] = [];
      let followUps: any[] = [];

      // Try to find a matching contact
      for (const word of titleWords) {
        const matches = await supaFetch('contacts', `name=ilike.*${encodeURIComponent(word)}*&select=*&limit=3`);
        if (matches.length > 0) {
          contact = matches[0];
          break;
        }
      }

      if (contact) {
        [deal, comms, followUps] = await Promise.all([
          supaFetch('deals', `contact_id=eq.${contact.id}&select=*&order=created_at.desc&limit=1`).then((r) => r[0] ?? null),
          supaFetch('communications', `contact_id=eq.${contact.id}&select=*&order=created_at.desc&limit=10`),
          supaFetch('follow_ups', `contact_id=eq.${contact.id}&completed_at=is.null&select=*&order=due_date.asc&limit=5`),
        ]);
      }

      const dealContext = deal
        ? `Deal: ${deal.company_name ?? deal.company ?? 'Unknown'} — ${deal.stage} — $${deal.value ?? 0}`
        : '(no linked deal found)';

      const lastComm = comms[0];
      const lastInteraction = lastComm
        ? `Last interaction: ${(lastComm.created_at ?? '').slice(0, 10)} — ${(lastComm.body ?? lastComm.summary ?? '').slice(0, 200)}`
        : '(no prior communications found)';

      const openItems = followUps.length
        ? followUps.map((f: any) => `- ${f.action ?? f.title}`).join('\n')
        : '(no open follow-ups)';

      const recentCommsText = comms.slice(0, 5).map((c: any) => `- ${(c.created_at ?? '').slice(0, 10)}: ${(c.body ?? c.summary ?? '').slice(0, 150)}`).join('\n') || '(none)';

      const prompt = `You are JARVIS. Generate a concise meeting prep brief.

Meeting: ${event.title}
Time: ${event.start}
Contact: ${contact?.name ?? 'unknown'} at ${contact?.company ?? 'unknown company'}

Context:
${dealContext}
${lastInteraction}
Open items:
${openItems}

Recent communications:
${recentCommsText}

Generate a meeting prep brief with:
1. Key context (2-3 sentences on relationship/deal status)
2. Key points to cover (3-5 bullets based on open items and recent comms)
3. One recommended ask or outcome for this meeting

Format as JSON with no markdown:
{
  "contact": "name",
  "company": "company",
  "deal_stage": "stage",
  "key_context": "...",
  "points_to_cover": ["...", "..."],
  "recommended_ask": "..."
}`;

      try {
        const out = await ctx.callModel({
          kind: "summary",
          system: "You are JARVIS, a sharp sales AI. Return only valid JSON, no markdown fences.",
          prompt,
          maxTokens: 600,
        });

        let brief: any;
        try {
          brief = parseJsonFromLLM(out.text);
        } catch {
          brief = { raw: out.text };
        }

        await supaInsert('jarvis_suggestions', {
          type: 'meeting_prep',
          title: `Meeting Prep: ${event.title} at ${(event.start ?? '').slice(11, 16)}`,
          body: brief.key_context ?? out.text.slice(0, 300),
          metadata: { ...brief, meeting_key: meetingKey, event_start: event.start },
          created_at: new Date().toISOString(),
          date: today,
        });

        results.push({ event: event.title, ...brief });
        ctx.log("crm_meeting_prep.generated", { event: event.title });
      } catch (err: any) {
        ctx.log("crm_meeting_prep.model_fail", { event: event.title, error: err?.message ?? String(err) });
      }
    }

    return { preparedCount: results.length, results };
  },
};
