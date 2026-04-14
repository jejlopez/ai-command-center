// crm_morning_brief — analyzes active deals and generates smart actions every morning.
// Runs at 7am daily.

import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";
import { supaFetch, supaInsert } from "../lib/supabase_client.js";

const manifest: SkillManifest = {
  name: "crm_morning_brief",
  title: "CRM Morning Brief",
  description: "Morning CRM brief — analyzes all active deals and generates smart actions",
  version: "0.1.0",
  scopes: ["memory.read"],
  routerHint: "complex_reasoning",
  triggers: [
    { kind: "cron", expr: "0 7 * * *" },
    { kind: "manual" },
  ],
};

function daysSince(dateStr: string | null | undefined): number {
  if (!dateStr) return 999;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function parseJsonFromLLM(text: string): any {
  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(cleaned);
}

export const crmMorningBrief: Skill = {
  manifest,
  async run(ctx) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const today = new Date().toISOString().slice(0, 10);

    const [deals, comms, followUps, contacts] = await Promise.all([
      supaFetch('deals', 'stage=neq.closed_lost&stage=neq.closed_won&select=*'),
      supaFetch('communications', `created_at=gte.${sevenDaysAgo}&select=*&order=created_at.desc&limit=50`),
      supaFetch('follow_ups', 'completed_at=is.null&select=*&order=due_date.asc&limit=30'),
      supaFetch('contacts', 'select=id,name,company,email'),
    ]);

    if (deals.length === 0) {
      ctx.log("crm_morning_brief.no_deals");
      return { skipped: true, reason: "no active deals" };
    }

    const contactMap: Record<string, string> = {};
    for (const c of contacts) contactMap[c.id] = c.name ?? c.email ?? c.id;

    const dealLines = deals.map((d: any) => {
      const days = daysSince(d.last_touch ?? d.updated_at);
      return `- ${d.company_name ?? d.company ?? 'Unknown'} | Stage: ${d.stage} | Value: $${d.value ?? 0} | Prob: ${d.probability ?? 0}% | Last touch: ${days}d ago | Notes: ${d.notes ?? 'none'}`;
    }).join('\n');

    const commLines = comms.length
      ? comms.map((c: any) => `- ${contactMap[c.contact_id] ?? c.contact_id} | ${c.type ?? 'note'} | ${(c.created_at ?? '').slice(0, 10)} | ${(c.body ?? c.summary ?? '').slice(0, 120)}`).join('\n')
      : '(none)';

    const fuLines = followUps.length
      ? followUps.map((f: any) => `- ${f.action ?? f.title} | Due: ${(f.due_date ?? '').slice(0, 10)} | Contact: ${contactMap[f.contact_id] ?? f.contact_id ?? '?'} | Deal: ${f.deal_id ?? '?'}`).join('\n')
      : '(none)';

    const prompt = `You are JARVIS, AI assistant to a VP of Sales at a 3PL/shipping company.

Here are the active deals:
${dealLines}

Recent communications (last 7 days):
${commLines}

Pending follow-ups:
${fuLines}

Generate:
1. TOP 5 ACTIONS TODAY — specific, actionable, with context from the notes. Not generic "follow up" but "Call Alex at Acme about the pricing they requested on Thursday — they need rates by end of week."
2. DEAL HEALTH SCORES — score each active deal 1-100 with one-line reasoning
3. RISK ALERTS — any deals at risk of going cold or being lost
4. PIPELINE INSIGHT — one key observation about the overall pipeline

For any action that involves following up with a contact, also draft a brief email (2-3 sentences) that could be sent. Include it as "email_draft" in the action object.

Format as JSON with no markdown:
{
  "actions": [{"deal": "company", "action": "specific action", "reason": "why now", "urgency": "high|medium|low", "email_draft": "Hi [Name], I wanted to follow up on..."}],
  "health_scores": [{"deal": "company", "score": 85, "reason": "active engagement"}],
  "risks": [{"deal": "company", "risk": "description"}],
  "insight": "one sentence about pipeline health"
}`;

    try {
      const out = await ctx.callModel({
        kind: "complex_reasoning",
        system: "You are JARVIS, a sharp sales AI. Return only valid JSON, no markdown fences.",
        prompt,
        maxTokens: 1500,
      });

      let result: any;
      try {
        result = parseJsonFromLLM(out.text);
      } catch {
        ctx.log("crm_morning_brief.parse_fail", { raw: out.text.slice(0, 200) });
        return { raw: out.text, parseError: true };
      }

      // Store each action as a suggestion
      const rows = (result.actions ?? []).map((a: any) => ({
        type: 'morning_action',
        title: `[${a.urgency?.toUpperCase() ?? 'ACTION'}] ${a.deal}: ${a.action}`,
        body: a.reason ?? '',
        metadata: a,
        context: a.email_draft ? { email_draft: a.email_draft } : null,
        created_at: new Date().toISOString(),
        date: today,
      }));
      if (rows.length) await supaInsert('jarvis_suggestions', rows);

      // Store full brief in memory
      ctx.memory.remember({
        kind: "event",
        label: "CRM Morning Brief",
        body: JSON.stringify(result),
      });

      ctx.log("crm_morning_brief.done", { actions: result.actions?.length ?? 0, risks: result.risks?.length ?? 0 });
      return { ...result, model: out.model, costUsd: out.costUsd };
    } catch (err: any) {
      ctx.log("crm_morning_brief.fail", { error: err?.message ?? String(err) });
      return { error: err?.message ?? String(err) };
    }
  },
};
