// crm_eod_recap — end of day CRM recap: what happened, lessons, tomorrow's plan.
// Runs at 5pm, weekdays only.

import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";
import { supaFetch, supaInsert } from "../lib/supabase_client.js";

const manifest: SkillManifest = {
  name: "crm_eod_recap",
  title: "CRM End of Day Recap",
  description: "End of day CRM recap — what happened, what to learn, tomorrow's plan",
  version: "0.1.0",
  scopes: ["memory.read"],
  routerHint: "complex_reasoning",
  triggers: [
    { kind: "cron", expr: "0 17 * * 1-5" },
    { kind: "manual" },
  ],
};

function parseJsonFromLLM(text: string): any {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(cleaned);
}

export const crmEodRecap: Skill = {
  manifest,
  async run(ctx) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const since = todayStart.toISOString();
    const today = new Date().toISOString().slice(0, 10);

    const [dealsToday, commsToday, fuCompleted, fuPending] = await Promise.all([
      supaFetch('deals', `updated_at=gte.${since}&stage=neq.closed_lost&stage=neq.closed_won&select=*`),
      supaFetch('communications', `created_at=gte.${since}&select=*&order=created_at.desc&limit=30`),
      supaFetch('follow_ups', `completed_at=gte.${since}&select=*`),
      supaFetch('follow_ups', `completed_at=is.null&due_date=lte.${today}&select=*`),
    ]);

    const dealLines = dealsToday.length
      ? dealsToday.map((d: any) => `- ${d.company_name ?? d.company ?? 'Unknown'} | Stage: ${d.stage} | Value: $${d.value ?? 0}`).join('\n')
      : '(no deals touched today)';

    const commLines = commsToday.length
      ? commsToday.map((c: any) => `- ${c.type ?? 'note'} | ${(c.created_at ?? '').slice(0, 16)} | ${(c.body ?? c.summary ?? '').slice(0, 150)}`).join('\n')
      : '(none logged today)';

    const fuDoneLines = fuCompleted.length
      ? fuCompleted.map((f: any) => `- ${f.action ?? f.title}`).join('\n')
      : '(none completed today)';

    const fuPendingLines = fuPending.length
      ? fuPending.map((f: any) => `- ${f.action ?? f.title} | Due: ${(f.due_date ?? '').slice(0, 10)}`).join('\n')
      : '(none overdue)';

    const prompt = `You are JARVIS. It's end of day. Review today's CRM activity.

Deals touched today:
${dealLines}

Communications logged today:
${commLines}

Follow-ups completed today:
${fuDoneLines}

Follow-ups still pending:
${fuPendingLines}

Generate:
1. DAY SUMMARY — What happened today in 3-4 sentences
2. WINS — What went well
3. LESSONS — What could be done better
4. TOMORROW'S TOP 3 — The three most important things for tomorrow
5. PIPELINE DELTA — How did the pipeline change today (value added/lost, deals moved)

Format as JSON with no markdown:
{
  "summary": "...",
  "wins": ["..."],
  "lessons": ["..."],
  "tomorrow_top3": [{"action": "...", "deal": "...", "reason": "..."}],
  "pipeline_delta": {"added": 0, "lost": 0, "moved": 0}
}`;

    try {
      const out = await ctx.callModel({
        kind: "complex_reasoning",
        system: "You are JARVIS, a sharp sales AI. Return only valid JSON, no markdown fences.",
        prompt,
        maxTokens: 1000,
      });

      let result: any;
      try {
        result = parseJsonFromLLM(out.text);
      } catch {
        ctx.log("crm_eod_recap.parse_fail", { raw: out.text.slice(0, 200) });
        return { raw: out.text, parseError: true };
      }

      // Store tomorrow's top 3 as suggestions
      const rows = (result.tomorrow_top3 ?? []).map((a: any) => ({
        type: 'tomorrow_action',
        title: `[TOMORROW] ${a.deal}: ${a.action}`,
        body: a.reason ?? '',
        metadata: a,
        created_at: new Date().toISOString(),
        date: today,
      }));
      if (rows.length) await supaInsert('jarvis_suggestions', rows);

      ctx.memory.remember({
        kind: "event",
        label: "CRM EOD Recap",
        body: JSON.stringify(result),
      });

      ctx.log("crm_eod_recap.done", { wins: result.wins?.length ?? 0, lessons: result.lessons?.length ?? 0 });
      return { ...result, model: out.model, costUsd: out.costUsd };
    } catch (err: any) {
      ctx.log("crm_eod_recap.fail", { error: err?.message ?? String(err) });
      return { error: err?.message ?? String(err) };
    }
  },
};
