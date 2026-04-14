// email_cleanup — daily email triage at 7:30am weekdays.
// Reads unread email from Apple Mail, asks Claude to categorize,
// and drops suggestions into jarvis_suggestions. Never archives or deletes
// anything automatically — JARVIS only suggests.

import type { Skill } from "../lib/skills.js";
import { supaInsert } from "../lib/supabase_client.js";
import type { SkillManifest } from "../../../shared/types.js";

export const emailCleanup: Skill = {
  manifest: {
    name: "email_cleanup",
    title: "Email Cleanup",
    description: "Daily email triage — categorize and surface cleanup suggestions",
    version: "0.1.0",
    scopes: ["memory.read"],
    routerHint: "complex_reasoning",
    triggers: [{ kind: "cron", expr: "30 7 * * 1-5" }],
    inputs: [],
  } as unknown as SkillManifest,

  async run(ctx) {
    ctx.log("email_cleanup.start");

    const port = process.env.JARVIS_PORT ?? 8787;
    let unread: any[] = [];
    try {
      const res = await fetch(`http://127.0.0.1:${port}/connectors/apple/mail/unread?limit=30`);
      if (res.ok) unread = await res.json();
    } catch {
      // Apple Mail connector not available — skip silently
    }

    if (!Array.isArray(unread) || unread.length === 0) {
      ctx.log("email_cleanup.no_unread");
      return { triaged: 0 };
    }

    const emailList = unread.map((e: any, i: number) =>
      `${i + 1}. From: ${e.from ?? 'unknown'} | Subject: ${e.subject ?? '(no subject)'} | Preview: ${(e.preview ?? '').slice(0, 100)}`
    ).join('\n');

    const out = await ctx.callModel({
      kind: "complex_reasoning",
      privacy: "personal",
      system: "You are a sharp email triage assistant. Return only valid JSON arrays, no markdown.",
      prompt: `You are triaging emails for a VP of Sales at a 3PL/shipping company.

Here are ${unread.length} unread emails:

${emailList}

Categorize each email as exactly one of:
- URGENT: needs immediate response (clients, active deals, time-sensitive)
- RESPOND: needs a reply but not urgent
- READ: informational, no action needed
- ARCHIVE: newsletters, marketing, notifications — safe to archive
- DELETE: spam, irrelevant promotions

Return JSON array only:
[{"index":1,"category":"URGENT","reason":"Client asking about pricing","suggested_action":"Reply with rates from latest quote"}]`,
    });

    let triaged: any[] = [];
    try {
      const jsonMatch = out.text.match(/\[[\s\S]*\]/);
      if (jsonMatch) triaged = JSON.parse(jsonMatch[0]);
    } catch {
      ctx.log("email_cleanup.parse_fail", { raw: out.text.slice(0, 200) });
    }

    const urgent    = triaged.filter((t: any) => t.category === 'URGENT');
    const archive   = triaged.filter((t: any) => t.category === 'ARCHIVE');
    const deletable = triaged.filter((t: any) => t.category === 'DELETE');
    const respond   = triaged.filter((t: any) => t.category === 'RESPOND');
    const read      = triaged.filter((t: any) => t.category === 'READ');

    if (urgent.length > 0) {
      await supaInsert('jarvis_suggestions', {
        type: 'email_urgent',
        suggestion: `${urgent.length} urgent email${urgent.length > 1 ? 's' : ''} need your attention: ${urgent.map((u: any) => u.reason).join(', ')}`,
        context: { urgent, total: unread.length },
      });
    }

    if (archive.length + deletable.length > 0) {
      await supaInsert('jarvis_suggestions', {
        type: 'email_cleanup',
        suggestion: `Inbox cleanup ready: ${archive.length} to archive, ${deletable.length} to delete, ${respond.length + read.length + urgent.length} worth keeping.`,
        context: { archive: archive.length, delete: deletable.length, keep: unread.length - archive.length - deletable.length },
      });
    }

    ctx.log("email_cleanup.done", {
      total: unread.length,
      urgent: urgent.length,
      respond: respond.length,
      read: read.length,
      archive: archive.length,
      delete: deletable.length,
    });

    return {
      total: unread.length,
      urgent: urgent.length,
      respond: respond.length,
      read: read.length,
      archive: archive.length,
      delete: deletable.length,
      details: triaged,
    };
  },
};
