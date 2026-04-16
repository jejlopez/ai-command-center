// CRM routes — pipeline, deals, leads, sync.

import type { FastifyInstance } from "fastify";
import {
  syncDeals, syncLeads, getDeals, getDeal, getLeads,
  getDealsByStage, getPipelineStats, isPipedriveConnected
} from "../lib/providers/pipedrive.js";
import { db } from "../db/db.js";
import { callModel } from "../lib/skills.js";
import { audit } from "../lib/audit.js";
import { approvals } from "../lib/approvals.js";

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

  // --- Enrich deals with notes from Pipedrive ---

  app.post("/crm/enrich-notes", async () => {
    if (!isPipedriveConnected()) return { error: "Pipedrive not connected" };

    // Fetch all notes from Pipedrive
    const { syncDeals: _, syncLeads: __, ...rest } = await import("../lib/providers/pipedrive.js");
    const pipedrive = await import("../lib/providers/pipedrive.js");

    // Get notes via Pipedrive API directly
    const vault = (await import("../lib/vault.js")).vault;
    const token = vault.get("pipedrive_api_key") || vault.get("pipedrive_api_token");
    const domain = vault.get("pipedrive_domain") || "api";

    let enriched = 0;
    let notesFound = 0;

    // Fetch notes from Pipedrive
    const notesRes = await fetch(`https://${domain}.pipedrive.com/v1/notes?api_token=${token}&limit=200&sort=update_time+DESC`);
    if (!notesRes.ok) return { error: `Pipedrive notes API failed: ${notesRes.status}` };
    const notesJson = await notesRes.json();
    const notes = notesJson.data ?? [];
    notesFound = notes.length;

    // Group notes by deal_id
    const notesByDeal: Record<number, string[]> = {};
    for (const n of notes) {
      if (n.deal_id) {
        if (!notesByDeal[n.deal_id]) notesByDeal[n.deal_id] = [];
        const content = (n.content || "").replace(/<[^>]*>/g, "").trim();
        if (content) notesByDeal[n.deal_id].push(content);
      }
    }

    // Update each deal's notes_summary
    for (const [pdId, dealNotes] of Object.entries(notesByDeal)) {
      const combined = dealNotes.join("\n---\n").slice(0, 2000);
      const dealId = `pd-${pdId}`;
      db.prepare("UPDATE crm_deals SET notes_summary = ? WHERE id = ?").run(combined, dealId);
      enriched++;
    }

    // Also fetch activities with notes/descriptions
    const actRes = await fetch(`https://${domain}.pipedrive.com/v1/activities?api_token=${token}&limit=200&sort=update_time+DESC`);
    let activitiesEnriched = 0;
    if (actRes.ok) {
      const actJson = await actRes.json();
      const activities = actJson.data ?? [];
      for (const a of activities) {
        if (a.deal_id && (a.note || a.public_description)) {
          const noteContent = [a.note, a.public_description].filter(Boolean).join("\n").replace(/<[^>]*>/g, "").trim();
          if (noteContent) {
            const dealId = `pd-${a.deal_id}`;
            const existing = (db.prepare("SELECT notes_summary FROM crm_deals WHERE id = ?").get(dealId) as any)?.notes_summary || "";
            if (!existing.includes(noteContent.slice(0, 50))) {
              const updated = existing ? `${existing}\n---\n[${a.type}] ${noteContent}` : `[${a.type}] ${noteContent}`;
              db.prepare("UPDATE crm_deals SET notes_summary = ? WHERE id = ?").run(updated.slice(0, 3000), dealId);
              activitiesEnriched++;
            }
          }
        }
      }
    }

    return { ok: true, notesFound, dealsEnriched: enriched, activitiesEnriched };
  });

  // --- Deal value estimator — estimate value for $0 deals ---

  app.post("/crm/estimate-values", async (_req, reply) => {
    // Read deals from jarvisd SQLite (Supabase blocked by RLS without session)
    const deals = db.prepare(
      "SELECT * FROM crm_deals WHERE (value IS NULL OR value = 0) AND status = 'open' LIMIT 50"
    ).all() as any[];
    if (deals.length === 0) return { ok: true, queued: 0, total: 0, message: "No $0 deals found" };

    const results: any[] = [];

    for (const deal of deals) {
      // Gather context from SQLite: activities, notes
      const activities = db.prepare(
        "SELECT type, subject FROM crm_activities WHERE deal_id = ? ORDER BY rowid DESC LIMIT 5"
      ).all(deal.id) as any[];
      const notes = db.prepare(
        "SELECT content FROM crm_notes WHERE deal_id = ? ORDER BY rowid DESC LIMIT 3"
      ).all(deal.id) as any[];

      const actText = activities.map((a: any) => `[${a.type}] ${a.subject || ""}`).join("\n");
      const noteText = notes.map((n: any) => (n.content || "").slice(0, 300)).join("\n");
      const proposalText = "";

      // Also include notes_summary from the deal record itself
      const dealNotes = deal.notes_summary || "";

      const context = [
        `Company: ${deal.org_name || deal.title}`,
        `Stage: ${deal.stage}`,
        `Contact: ${deal.contact_name || "unknown"}`,
        deal.contact_email ? `Email: ${deal.contact_email}` : "",
        dealNotes ? `Deal Notes:\n${dealNotes.slice(0, 1000)}` : "",
        noteText ? `CRM Notes:\n${noteText}` : "",
        actText ? `Activities:\n${actText}` : "",
        proposalText,
      ].filter(Boolean).join("\n");

      if (!context || context.length < 30) {
        results.push({ id: deal.id, company: deal.org_name || deal.title, skipped: true, reason: "insufficient context" });
        continue;
      }

      // Track what data sources we have
      const dataSources: string[] = [];
      if (dealNotes) dataSources.push("deal_notes");
      if (noteText) dataSources.push("crm_notes");
      if (actText) dataSources.push("activities");
      if (deal.contact_email) dataSources.push("contact_email");
      if (deal.org_name && !deal.org_name.startsWith("Deal #")) dataSources.push("company_name");

      try {
        const result = await callModel({
          kind: "summary",
          privacy: "personal",
          prompt: `Estimate the annual deal value for this 3PL/logistics deal. Show your math.

${context}

Use these 3PL pricing benchmarks:
- Storage: $15-30/pallet/month
- Pick & pack: $2-5/order
- Receiving: $25-50/pallet
- Shipping: $5-15/package (varies by weight/zone)
- Monthly minimum: ~$1,500-3,000 for small accounts

Return ONLY a JSON object with this exact structure:
{
  "value_usd": <annual number>,
  "confidence_pct": <0-100>,
  "confidence_why": "<why this confidence level — what data was missing or present>",
  "math": [
    {"line": "<description>", "calc": "<formula>", "amount": <number>},
    {"line": "<description>", "calc": "<formula>", "amount": <number>}
  ],
  "assumptions": "<key assumptions made>"
}

Rules:
- Each math line should be a specific pricing component (storage, pick & pack, receiving, shipping)
- Use realistic volumes based on clues in the data. If no clues, state assumptions clearly.
- confidence_pct: 80-100 if volume data present, 40-60 if only company name, 60-80 if notes have some detail
- The math lines should SUM to value_usd
- No other text outside the JSON.`,
        }, { skill: "deal_value_estimator" });

        const parsed = JSON.parse(result.text.trim().replace(/```json?\n?/g, "").replace(/```/g, ""));
        const value = Math.round(Number(parsed.value_usd) || 0);

        if (value > 0) {
          // Queue as approval — do NOT write value directly
          approvals.enqueue({
            title: `Value estimate: ${deal.org_name || deal.title} — $${value.toLocaleString()}`,
            reason: parsed.assumptions || parsed.confidence_why || "",
            skill: "deal_value_estimator",
            riskLevel: "low",
            payload: {
              deal_id: deal.id,
              estimated_value: value,
              confidence_pct: parsed.confidence_pct ?? 50,
              confidence_why: parsed.confidence_why ?? "",
              math: parsed.math ?? [],
              assumptions: parsed.assumptions ?? "",
              data_sources: dataSources,
              company: deal.org_name || deal.title,
              stage: deal.stage,
              contact: deal.contact_name,
              context_summary: context.slice(0, 800),
            },
          });
          audit({
            actor: "jarvis",
            action: "deal.value_estimate_queued",
            subject: deal.id,
            metadata: { company: deal.org_name || deal.title, value, confidence: parsed.confidence },
          });
          results.push({ id: deal.id, company: deal.org_name || deal.title, value, confidence_pct: parsed.confidence_pct, queued: true });
        } else {
          results.push({ id: deal.id, company: deal.org_name || deal.title, skipped: true, reason: "could not estimate" });
        }
      } catch (err: any) {
        results.push({ id: deal.id, company: deal.org_name || deal.title, skipped: true, reason: err.message });
      }
    }

    return { ok: true, queued: results.filter(r => r.queued).length, skipped: results.filter(r => r.skipped).length, total: deals.length, results };
  });

  // --- Value estimate feedback — saves learning data, triggers recalibration ---

  app.post("/crm/value-estimate-feedback", async (req) => {
    const { deal_id, company, original_estimate, corrected_value, math, data_sources, reason, decision } = req.body as any;

    // Store feedback in SQLite
    db.prepare(`
      INSERT INTO value_estimate_feedback(id, deal_id, company, original_estimate, corrected_value, math, data_sources, reason, decision, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      crypto.randomUUID(),
      deal_id || null,
      company || "",
      original_estimate || 0,
      corrected_value || null,
      JSON.stringify(math || []),
      JSON.stringify(data_sources || []),
      reason || "",
      decision || "rejected",
    );

    audit({
      actor: "user",
      action: `deal.value_estimate.${decision}`,
      subject: deal_id || company,
      metadata: { company, original_estimate, corrected_value, reason },
    });

    // Check if we've hit 10 denials — trigger recalibration
    const denialCount = (db.prepare(
      "SELECT COUNT(*) as cnt FROM value_estimate_feedback WHERE decision = 'rejected'"
    ).get() as any)?.cnt || 0;

    let recalibrated = false;
    if (denialCount > 0 && denialCount % 10 === 0) {
      // Gather all denial feedback for recalibration
      const feedback = db.prepare(
        "SELECT company, original_estimate, corrected_value, reason FROM value_estimate_feedback WHERE decision = 'rejected' ORDER BY created_at DESC LIMIT 20"
      ).all() as any[];

      const feedbackText = feedback.map((f: any) =>
        `Company: ${f.company} | Jarvis estimated: $${f.original_estimate?.toLocaleString()} | ${f.corrected_value ? `Real value: $${f.corrected_value.toLocaleString()} |` : ""} Reason: ${f.reason}`
      ).join("\n");

      try {
        const result = await callModel({
          kind: "summary",
          privacy: "personal",
          prompt: `You are a pricing estimation system for 3PL logistics. You've received ${denialCount} corrections from the user. Analyze the pattern and output updated pricing assumptions.

CORRECTIONS:
${feedbackText}

Based on these corrections, output a JSON object with updated pricing benchmarks:
{
  "storage_per_pallet_month": {"low": <number>, "high": <number>},
  "pick_pack_per_order": {"low": <number>, "high": <number>},
  "receiving_per_pallet": {"low": <number>, "high": <number>},
  "shipping_per_package": {"low": <number>, "high": <number>},
  "bias_direction": "overestimating" | "underestimating" | "mixed",
  "key_lesson": "<one sentence about what the user keeps correcting>"
}`,
        }, { skill: "value_recalibration" });

        const recalData = JSON.parse(result.text.trim().replace(/```json?\n?/g, "").replace(/```/g, ""));
        db.prepare(`
          INSERT INTO value_estimate_calibration(id, denial_count, calibration_data, created_at)
          VALUES (?, ?, ?, datetime('now'))
        `).run(crypto.randomUUID(), denialCount, JSON.stringify(recalData));

        audit({
          actor: "jarvis",
          action: "deal.value_estimator.recalibrated",
          subject: `after_${denialCount}_denials`,
          metadata: recalData,
        });

        recalibrated = true;
      } catch {}
    }

    return { ok: true, denialCount, recalibrated };
  });
}
