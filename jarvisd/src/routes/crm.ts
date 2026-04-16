// CRM routes — pipeline, deals, leads, sync.

import type { FastifyInstance } from "fastify";
import {
  syncDeals, syncLeads, getDeals, getDeal, getLeads,
  getDealsByStage, getPipelineStats, isPipedriveConnected
} from "../lib/providers/pipedrive.js";
import { db } from "../db/db.js";
import { supaFetch, supaUpdate } from "../lib/supabase_client.js";
import { callModel } from "../lib/skills.js";
import { audit } from "../lib/audit.js";

export async function crmRoutes(app: FastifyInstance) {
  // Status
  app.get("/crm/status", async () => ({
    connected: isPipedriveConnected(),
    stats: isPipedriveConnected() ? getPipelineStats() : null,
  }));

  // Sync from Pipedrive
  app.post("/crm/sync", async (_req, reply) => {
    if (!isPipedriveConnected()) {
      return reply.code(400).send({ error: "Pipedrive not connected" });
    }
    try {
      const [deals, leads] = await Promise.all([syncDeals(), syncLeads()]);
      return { ok: true, deals, leads };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // Pipeline view (deals grouped by stage)
  app.get("/crm/pipeline", async () => getDealsByStage());

  // Pipeline stats
  app.get("/crm/stats", async () => getPipelineStats());

  // All deals
  app.get("/crm/deals", async (req) => {
    const { pipeline, status } = req.query as any;
    return getDeals(pipeline ?? "New pipeline", status ?? "open");
  });

  // Single deal
  app.get<{ Params: { id: string } }>("/crm/deals/:id", async (req, reply) => {
    const deal = getDeal((req.params as any).id);
    if (!deal) return reply.code(404).send({ error: "Deal not found" });

    // Also get related emails, notes, proposals
    const emails = db.prepare(
      "SELECT * FROM email_triage WHERE from_addr LIKE ? OR from_addr LIKE ? ORDER BY created_at DESC LIMIT 10"
    ).all(`%${deal.contact_email?.split("@")[1] ?? "NOMATCH"}%`, `%${deal.contact_name ?? "NOMATCH"}%`);

    const drafts = db.prepare(
      "SELECT * FROM email_drafts WHERE to_addr LIKE ? ORDER BY created_at DESC LIMIT 5"
    ).all(`%${deal.contact_email ?? "NOMATCH"}%`);

    const proposals = db.prepare(
      "SELECT * FROM proposals WHERE client_email = ? OR client_name = ? ORDER BY created_at DESC LIMIT 5"
    ).all(deal.contact_email ?? "", deal.org_name ?? "");

    return { ...deal, emails, drafts, proposals };
  });

  // Update deal fields (engagement, notes, operating model)
  app.patch<{ Params: { id: string } }>("/crm/deals/:id", async (req, reply) => {
    const deal = getDeal((req.params as any).id);
    if (!deal) return reply.code(404).send({ error: "Deal not found" });

    const body = req.body as any;
    const updates: string[] = [];
    const values: any[] = [];

    for (const field of ["engagement", "operating_model", "pricing_model", "notes_summary", "jarvis_score"]) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(typeof body[field] === "object" ? JSON.stringify(body[field]) : body[field]);
      }
    }

    if (updates.length > 0) {
      values.push(deal.id);
      db.prepare(`UPDATE crm_deals SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    }

    return { ok: true };
  });

  // All leads
  app.get("/crm/leads", async (req) => {
    const { status } = req.query as any;
    return getLeads(status ?? "active");
  });

  // Command briefing — today's actions
  app.get("/crm/command", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const deals = getDeals("New pipeline", "open");

    const overdue = deals.filter((d: any) => d.next_activity && d.next_activity < today);
    const dueToday = deals.filter((d: any) => d.next_activity?.startsWith(today));
    const hot = deals.filter((d: any) => d.engagement === "hot" || d.value > 50000);
    const recentlyViewed = deals.filter((d: any) => d.pandadoc_viewed);

    return {
      date: today,
      doNow: overdue.slice(0, 5).map((d: any) => ({
        id: d.id, title: d.title, value: d.value, stage: d.stage,
        reason: `Overdue since ${d.next_activity}`,
      })),
      doToday: dueToday.map((d: any) => ({
        id: d.id, title: d.title, value: d.value, stage: d.stage,
        reason: `Due today`,
      })),
      hotDeals: hot.slice(0, 5).map((d: any) => ({
        id: d.id, title: d.title, value: d.value, stage: d.stage,
      })),
      proposalViewed: recentlyViewed.map((d: any) => ({
        id: d.id, title: d.title, value: d.value,
        viewedAt: d.pandadoc_viewed_at,
      })),
      stats: getPipelineStats(),
    };
  });

  // --- Deal value estimator — estimate value for $0 deals ---

  app.post("/crm/estimate-values", async (_req, reply) => {
    // Fetch all deals with $0 or null value
    const deals = await supaFetch("deals", "select=id,company,stage,value_usd,contact_name,notes&or=(value_usd.eq.0,value_usd.is.null)&limit=50");
    if (deals.length === 0) return { ok: true, updated: 0, message: "No $0 deals found" };

    const results: any[] = [];

    for (const deal of deals) {
      // Gather context: comms, activities, proposals
      const [comms, activities, proposals] = await Promise.all([
        supaFetch("communications", `select=subject,body,type&deal_id=eq.${deal.id}&order=occurred_at.desc&limit=5`),
        supaFetch("activities", `select=subject,body,type&deal_id=eq.${deal.id}&order=occurred_at.desc&limit=5`),
        supaFetch("proposals", `select=pricing,executive_summary&deal_id=eq.${deal.id}&limit=1`),
      ]);

      const commText = comms.map((c: any) => `[${c.type}] ${c.subject || ""}: ${(c.body || "").slice(0, 200)}`).join("\n");
      const actText = activities.map((a: any) => `[${a.type}] ${a.subject || ""}: ${(a.body || "").slice(0, 200)}`).join("\n");
      const proposalText = proposals[0]?.pricing
        ? `Proposal pricing: ${JSON.stringify(proposals[0].pricing)}`
        : proposals[0]?.executive_summary
        ? `Proposal summary: ${proposals[0].executive_summary}`
        : "";

      const context = [
        `Company: ${deal.company}`,
        `Stage: ${deal.stage}`,
        `Contact: ${deal.contact_name || "unknown"}`,
        deal.notes ? `Notes: ${(deal.notes as string).slice(0, 500)}` : "",
        commText ? `Communications:\n${commText}` : "",
        actText ? `Activities:\n${actText}` : "",
        proposalText,
      ].filter(Boolean).join("\n");

      if (!context || context.length < 30) {
        results.push({ id: deal.id, company: deal.company, skipped: true, reason: "insufficient context" });
        continue;
      }

      try {
        const result = await callModel({
          kind: "summary",
          privacy: "personal",
          prompt: `Estimate the annual deal value for this 3PL/logistics deal based on the context below.

${context}

Think about typical 3PL pricing:
- Storage: $15-30/pallet/month
- Pick & pack: $2-5/order
- Receiving: $25-50/pallet
- Shipping: varies by volume

Return ONLY a JSON object: {"value_usd": <number>, "confidence": "high"|"medium"|"low", "reasoning": "<one sentence>"}
No other text.`,
        }, { skill: "deal_value_estimator" });

        const parsed = JSON.parse(result.text.trim().replace(/```json?\n?/g, "").replace(/```/g, ""));
        const value = Math.round(Number(parsed.value_usd) || 0);

        if (value > 0) {
          await supaUpdate("deals", `id=eq.${deal.id}`, { value_usd: value, updated_at: new Date().toISOString() });
          audit({
            actor: "jarvis",
            action: "deal.value_estimated",
            subject: deal.id,
            metadata: { company: deal.company, value, confidence: parsed.confidence, reasoning: parsed.reasoning },
          });
          results.push({ id: deal.id, company: deal.company, value, confidence: parsed.confidence, reasoning: parsed.reasoning });
        } else {
          results.push({ id: deal.id, company: deal.company, skipped: true, reason: "could not estimate" });
        }
      } catch (err: any) {
        results.push({ id: deal.id, company: deal.company, skipped: true, reason: err.message });
      }
    }

    return { ok: true, updated: results.filter(r => !r.skipped).length, total: deals.length, results };
  });
}
