// crm_midday_recap — noon check-in on deal changes since the morning brief.
// Runs at noon, weekdays only.

import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";
import { supaFetch, supaInsert } from "../lib/supabase_client.js";

const manifest: SkillManifest = {
  name: "crm_midday_recap",
  title: "CRM Midday Recap",
  description: "Midday CRM check-in — what changed since the morning brief, updated actions",
  version: "0.1.0",
  scopes: ["memory.read"],
  routerHint: "complex_reasoning",
  triggers: [
    { kind: "cron", expr: "0 12 * * 1-5" },
    { kind: "manual" },
  ],
};

function parseJsonFromLLM(text: string): any {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(cleaned);
}

export const crmMiddayRecap: Skill = {
  manifest,
  async run(ctx) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const since = todayStart.toISOString();
    const today = new Date().toISOString().slice(0, 10);

    const [deals, commsToday, followUps] = await Promise.all([
      supaFetch('deals', 'stage=neq.closed_lost&stage=neq.closed_won&select=*'),
      supaFetch('communications', `created_at=gte.${since}&select=*&order=created_at.desc&limit=20`),
      supaFetch('follow_ups', `completed_at=is.null&due_date=lte.${today}&select=*&order=due_date.asc&limit=20`),
    ]);

    // Pull morning brief from memory for comparison
    const morningBriefs = ctx.memory.list("event", 5).filter((m: any) => m.label === "CRM Morning Brief");
    const morningContext = morningBriefs.length
      ? `Morning brief summary: ${morningBriefs[0].body?.slice(0, 600) ?? '(none)'}`
      : '(No morning brief found)';

    const dealLines = deals.map((d: any) => `- ${d.company_name ?? d.company ?? 'Unknown'} | Stage: ${d.stage} | Value: $${d.value ?? 0} | Updated: ${(d.updated_at ?? '').slice(0, 16)}`).join('\n') || '(none)';

    const commLines = commsToday.length
      ? commsToday.map((c: any) => `- ${c.type ?? 'note'} | ${(c.created_at ?? '').slice(0, 16)} | ${(c.body ?? c.summary ?? '').slice(0, 120)}`).join('\n')
      : '(none logged today yet)';

    const fuLines = followUps.length
      ? followUps.map((f: any) => `- ${f.action ?? f.title} | Due: ${(f.due_date ?? '').slice(0, 10)}`).join('\n')
      : '(none overdue)';

    const prompt = `You are JARVIS, AI assistant to a VP of Sales at a 3PL/shipping company. It's midday.

${morningContext}

Active deals now:
${dealLines}

Communications logged today:
${commLines}

Overdue follow-ups:
${fuLines}

Since the morning brief, what has changed? Any deals that moved? Any new communications? What are the updated top actions for this afternoon?

Format as JSON with no markdown:
{
  "changes": ["deal X moved from Y to Z", "communication logged with ..."],
  "afternoon_actions": [{"deal": "company", "action": "specific action", "urgency": "high|medium|low"}],
  "alerts": ["any urgent items needing immediate attention"]
}`;

    try {
      const out = await ctx.callModel({
        kind: "complex_reasoning",
        system: "You are JARVIS, a sharp sales AI. Return only valid JSON, no markdown fences.",
        prompt,
        maxTokens: 800,
      });

      let result: any;
      try {
        result = parseJsonFromLLM(out.text);
      } catch {
        ctx.log("crm_midday_recap.parse_fail", { raw: out.text.slice(0, 200) });
        return { raw: out.text, parseError: true };
      }

      const rows = (result.afternoon_actions ?? []).map((a: any) => ({
        type: 'midday_action',
        title: `[MIDDAY][${a.urgency?.toUpperCase() ?? 'ACTION'}] ${a.deal}: ${a.action}`,
        body: '',
        metadata: a,
        created_at: new Date().toISOString(),
        date: today,
      }));
      if (rows.length) await supaInsert('jarvis_suggestions', rows);

      ctx.memory.remember({
        kind: "event",
        label: "CRM Midday Recap",
        body: JSON.stringify(result),
      });

      ctx.log("crm_midday_recap.done", { actions: result.afternoon_actions?.length ?? 0 });
      return { ...result, model: out.model, costUsd: out.costUsd };
    } catch (err: any) {
      ctx.log("crm_midday_recap.fail", { error: err?.message ?? String(err) });
      return { error: err?.message ?? String(err) };
    }
  },
};
