// proposal_followup — auto follow-up intelligence for sent proposals.
// Cron: 9am weekdays.
// - Proposal sent, not viewed in 48h → nudge suggestion
// - Proposal viewed, not signed in 72h → follow-up suggestion
// - Auto-drafts nudge email copy via Claude

import { audit } from "../lib/audit.js";
import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "proposal_followup",
  title: "Proposal Follow-up",
  description: "Monitors sent proposals for view and sign activity. Generates follow-up nudges when prospects go cold.",
  version: "0.1.0",
  scopes: ["llm.cloud", "memory.read", "memory.write"],
  routerHint: "chat",
  triggers: [{ kind: "cron", expr: "0 9 * * 1-5" }],
  inputs: [],
};

interface Proposal {
  id: string;
  user_id: string;
  company_name: string;
  client_name: string | null;
  client_email: string | null;
  status: string;
  created_at: string;
  viewed_at: string | null;
  executed_at: string | null;
  deal_id: string | null;
}

async function supabaseFetch(url: string, serviceKey: string, path: string, opts: RequestInit = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${path}: ${res.status}`);
  return res.json();
}

// unused helper kept for reference
async function _insertSuggestion(url: string, key: string, payload: object) {
  await fetch(`${url}/rest/v1/jarvis_suggestions`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  });
}

export const proposalFollowup: Skill = {
  manifest: { ...manifest, costTier: "standard" } as any,

  async run(ctx) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return { error: "Supabase env not configured" };

    const now = new Date();
    const h48ago = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const h72ago = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();

    // Sent but not viewed in 48h
    const notViewed: Proposal[] = await supabaseFetch(
      supabaseUrl,
      serviceKey,
      `proposals?status=eq.sent&viewed_at=is.null&created_at=lt.${h48ago}&executed_at=is.null&select=id,user_id,company_name,client_name,client_email,status,created_at,viewed_at,executed_at,deal_id`
    );

    // Viewed but not signed in 72h
    const notSigned: Proposal[] = await supabaseFetch(
      supabaseUrl,
      serviceKey,
      `proposals?status=eq.sent&viewed_at=not.is.null&viewed_at=lt.${h72ago}&executed_at=is.null&select=id,user_id,company_name,client_name,client_email,status,created_at,viewed_at,executed_at,deal_id`
    );

    let nudgesCreated = 0;
    let followupsCreated = 0;

    // ── Not viewed nudges ──────────────────────────────────────────────────
    for (const p of notViewed) {
      const daysSent = Math.round((now.getTime() - new Date(p.created_at).getTime()) / 86400000);

      let emailDraft = "";
      try {
        const out = await ctx.callModel({
          kind: "chat",
          system: "You write concise, professional 3PL sales follow-up emails. Keep it under 4 sentences. No filler.",
          prompt: `Draft a brief follow-up email to ${p.client_name || p.company_name} (${p.client_email || "the client"}) checking in on our warehousing agreement proposal sent ${daysSent} day${daysSent !== 1 ? "s" : ""} ago. Sender: 3PL Center LLC team. Subject line included.`,
          maxTokens: 150,
        });
        emailDraft = out.text.trim();
      } catch {
        emailDraft = `Subject: Following up on your 3PL Center warehousing proposal\n\nHi ${p.client_name || "there"},\n\nJust checking in on the warehousing agreement we sent over ${daysSent} days ago. Let us know if you have any questions. We'd love to get started.\n\nBest, 3PL Center LLC`;
      }

      await fetch(`${supabaseUrl}/rest/v1/jarvis_suggestions`, {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          user_id: p.user_id,
          type: "proposal_followup",
          suggestion: `Proposal for ${p.company_name} hasn't been viewed in ${daysSent} days — send a nudge?`,
          context: {
            proposal_id: p.id,
            deal_id: p.deal_id,
            followup_type: "not_viewed",
            days_since_sent: daysSent,
            email_draft: emailDraft,
          },
        }),
      });

      nudgesCreated++;
    }

    // ── Viewed but not signed ─────────────────────────────────────────────
    for (const p of notSigned) {
      const viewedAt = p.viewed_at ? new Date(p.viewed_at) : now;
      const hoursViewed = Math.round((now.getTime() - viewedAt.getTime()) / 3600000);

      let emailDraft = "";
      try {
        const out = await ctx.callModel({
          kind: "chat",
          system: "You write concise, professional 3PL sales follow-up emails. Keep it under 4 sentences. No filler.",
          prompt: `Draft a brief follow-up email to ${p.client_name || p.company_name} (${p.client_email || "the client"}) who viewed our warehousing agreement ${hoursViewed} hours ago but hasn't signed yet. Address common hesitations. Sender: 3PL Center LLC. Subject line included.`,
          maxTokens: 150,
        });
        emailDraft = out.text.trim();
      } catch {
        emailDraft = `Subject: Any questions on the 3PL Center agreement?\n\nHi ${p.client_name || "there"},\n\nWe noticed you reviewed our warehousing agreement — happy to answer any questions before you sign. Just reply here or call us directly.\n\nBest, 3PL Center LLC`;
      }

      await fetch(`${supabaseUrl}/rest/v1/jarvis_suggestions`, {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          user_id: p.user_id,
          type: "proposal_followup",
          suggestion: `${p.company_name} viewed your proposal but hasn't signed after ${Math.round(hoursViewed / 24)} days — follow up?`,
          context: {
            proposal_id: p.id,
            deal_id: p.deal_id,
            followup_type: "viewed_not_signed",
            hours_since_viewed: hoursViewed,
            email_draft: emailDraft,
          },
        }),
      });

      followupsCreated++;
    }

    audit({
      actor: "jarvis",
      action: "proposal_followup.ran",
      metadata: {
        not_viewed_checked: notViewed.length,
        not_signed_checked: notSigned.length,
        nudges_created: nudgesCreated,
        followups_created: followupsCreated,
      },
    });

    return {
      nudgesCreated,
      followupsCreated,
      notViewedCount: notViewed.length,
      notSignedCount: notSigned.length,
    };
  },
};
