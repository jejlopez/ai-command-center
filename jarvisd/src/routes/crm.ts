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

// 3PL Center rate card — from proposal_generator.ts
const RATE_CARD = {
  storage_per_pallet: 17.50,
  receiving_per_pallet: 12.50,
  outbound_per_pallet: 12.50,
  order_processing: 1.75,
  pick_fee: 0.45,
  picks_per_order: 3,
  admin_fee: 199,
  bol_fee: 4.50,
  handling_minimum: 2500,
  storage_minimum: 1000,
};

// Volume buckets — estimate from context clues
interface VolumeBucket {
  label: string;
  pallets: number;
  orders: number;
  palletsIn: number;
}

const VOLUME_BUCKETS: Record<string, VolumeBucket> = {
  tiny:   { label: "Tiny (startup/test)",    pallets: 5,   orders: 100,  palletsIn: 3 },
  small:  { label: "Small (early stage)",    pallets: 15,  orders: 300,  palletsIn: 8 },
  medium: { label: "Medium (growing)",       pallets: 50,  orders: 1000, palletsIn: 20 },
  large:  { label: "Large (established)",    pallets: 150, orders: 3000, palletsIn: 50 },
  xlarge: { label: "XL (high volume)",       pallets: 500, orders: 10000,palletsIn: 150 },
};

function calculateDealValue(bucket: VolumeBucket) {
  const storageCost = Math.max(bucket.pallets * RATE_CARD.storage_per_pallet, RATE_CARD.storage_minimum);
  const receivingCost = bucket.palletsIn * RATE_CARD.receiving_per_pallet;
  const orderCost = bucket.orders * RATE_CARD.order_processing;
  const pickCost = bucket.orders * RATE_CARD.picks_per_order * RATE_CARD.pick_fee;
  const handlingSubtotal = receivingCost + orderCost + pickCost;
  const handlingActual = Math.max(handlingSubtotal, RATE_CARD.handling_minimum);
  const monthlyTotal = storageCost + handlingActual + RATE_CARD.admin_fee;
  const annualTotal = monthlyTotal * 12;

  return {
    monthly: Math.round(monthlyTotal),
    annual: Math.round(annualTotal),
    lines: [
      {
        line: "Storage",
        calc: `${bucket.pallets} pallets × $${RATE_CARD.storage_per_pallet}/pallet${bucket.pallets * RATE_CARD.storage_per_pallet < RATE_CARD.storage_minimum ? ` (min $${RATE_CARD.storage_minimum})` : ""}`,
        monthly: Math.round(storageCost),
        amount: Math.round(storageCost * 12),
      },
      {
        line: "Receiving",
        calc: `${bucket.palletsIn} pallets/mo × $${RATE_CARD.receiving_per_pallet}`,
        monthly: Math.round(receivingCost),
        amount: Math.round(receivingCost * 12),
      },
      {
        line: "Order processing",
        calc: `${bucket.orders} orders × $${RATE_CARD.order_processing}`,
        monthly: Math.round(orderCost),
        amount: Math.round(orderCost * 12),
      },
      {
        line: "Pick fees",
        calc: `${bucket.orders * RATE_CARD.picks_per_order} picks × $${RATE_CARD.pick_fee}`,
        monthly: Math.round(pickCost),
        amount: Math.round(pickCost * 12),
      },
      {
        line: "Admin fee",
        calc: "Flat monthly",
        monthly: RATE_CARD.admin_fee,
        amount: RATE_CARD.admin_fee * 12,
      },
    ].concat(handlingSubtotal < RATE_CARD.handling_minimum ? [{
      line: "Handling minimum adjustment",
      calc: `Min $${RATE_CARD.handling_minimum} applies (subtotal was $${Math.round(handlingSubtotal)})`,
      monthly: Math.round(RATE_CARD.handling_minimum - handlingSubtotal),
      amount: Math.round((RATE_CARD.handling_minimum - handlingSubtotal) * 12),
    }] : []),
  };
}

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

      // Check for past denials on this deal
      const pastFeedback = db.prepare(
        "SELECT reason, corrected_value, original_estimate FROM value_estimate_feedback WHERE deal_id = ? ORDER BY created_at DESC LIMIT 3"
      ).all(deal.id) as any[];

      const feedbackBlock = pastFeedback.length > 0
        ? `\n\nPrevious estimates were rejected:\n${pastFeedback.map((f: any) =>
            `- Estimated $${f.original_estimate?.toLocaleString()}${f.corrected_value ? `, actual was $${f.corrected_value.toLocaleString()}` : ""}. Reason: ${f.reason}`
          ).join("\n")}\nUse these corrections to pick the right volume bucket.`
        : "";

      try {
        // Step 1: Try to extract volumes from notes/context with code first
        const allText = (context + " " + dealNotes).toLowerCase();
        let autoDetectedBucket: string | null = null;

        // Parse volume clues from text
        const palletMatch = allText.match(/(\d[\d,]*)\s*pallets?/);
        const orderMatch = allText.match(/(\d[\d,]*)\s*(orders?|shipments?|packages?|boxes?)\s*\/?\s*(mo|month|per month|monthly)/);
        const parsedPallets = palletMatch ? parseInt(palletMatch[1].replace(/,/g, "")) : 0;
        const parsedOrders = orderMatch ? parseInt(orderMatch[1].replace(/,/g, "")) : 0;

        if (parsedPallets > 200 || parsedOrders > 5000) autoDetectedBucket = "xlarge";
        else if (parsedPallets > 80 || parsedOrders > 2000) autoDetectedBucket = "large";
        else if (parsedPallets > 25 || parsedOrders > 500) autoDetectedBucket = "medium";
        else if (parsedPallets > 8 || parsedOrders > 150) autoDetectedBucket = "small";
        else if (parsedPallets > 0 || parsedOrders > 0) autoDetectedBucket = "tiny";

        // Known large companies
        const orgLower = (deal.org_name || deal.title || "").toLowerCase();
        if (/spacex|tesla|amazon|walmart|target|costco|nike/i.test(orgLower)) autoDetectedBucket = "xlarge";

        // Stage-based defaults if no volume data
        const stage = (deal.stage || "").toLowerCase();
        const isNegotiating = stage.includes("negotiat") || stage.includes("proposal") || stage.includes("follow up");
        const isNewLead = stage.includes("new lead") || stage.includes("gather info");

        let bucketKey: string;
        let confidencePct: number;
        let confidenceWhy: string;

        if (autoDetectedBucket) {
          // Code-detected volume — high confidence
          bucketKey = autoDetectedBucket;
          confidencePct = parsedPallets > 0 || parsedOrders > 0 ? 85 : 70;
          confidenceWhy = parsedPallets > 0 || parsedOrders > 0
            ? `Detected ${parsedPallets > 0 ? `${parsedPallets} pallets` : ""}${parsedPallets > 0 && parsedOrders > 0 ? " and " : ""}${parsedOrders > 0 ? `${parsedOrders} orders/mo` : ""} in deal notes`
            : `Known large company — classified as ${autoDetectedBucket}`;
        } else if (isNegotiating) {
          // Further along in pipeline, likely medium
          bucketKey = "medium";
          confidencePct = 50;
          confidenceWhy = "In negotiation/proposal stage but no volume data — estimated medium";
        } else if (isNewLead) {
          // Early stage, likely small
          bucketKey = "small";
          confidencePct = 35;
          confidenceWhy = "New lead with no volume data — defaulting to small";
        } else {
          // Use LLM as fallback only when code can't determine
          try {
            const result = await callModel({
              kind: "summary",
              privacy: "personal",
              prompt: `Classify this deal: tiny/small/medium/large/xlarge.

${context.slice(0, 500)}${feedbackBlock}

Reply ONLY: {"bucket":"<size>"}`,
            }, { skill: "deal_value_estimator" });
            const parsed = JSON.parse(result.text.trim().replace(/```json?\n?/g, "").replace(/```/g, ""));
            bucketKey = parsed.bucket || "small";
          } catch {
            bucketKey = "small";
          }
          confidencePct = 40;
          confidenceWhy = "LLM classification — limited context";
        }

        const bucket = VOLUME_BUCKETS[bucketKey] || VOLUME_BUCKETS.small;

        // Step 2: Calculate value using REAL rate card
        const calc = calculateDealValue(bucket);
        const value = calc.annual;

        if (value > 0) {
          // Queue as approval — do NOT write value directly
          approvals.enqueue({
            title: `Value estimate: ${deal.org_name || deal.title} — $${calc.monthly.toLocaleString()}/mo ($${value.toLocaleString()}/yr)`,
            reason: confidenceWhy || "",
            skill: "deal_value_estimator",
            riskLevel: "low",
            payload: {
              deal_id: deal.id,
              estimated_value: value,
              monthly_total: calc.monthly,
              confidence_pct: confidencePct,
              confidence_why: confidenceWhy,
              volume_bucket: bucketKey,
              volume_label: bucket.label,
              math: calc.lines,
              assumptions: `Volume bucket: ${bucket.label} (${bucket.pallets} pallets, ${bucket.orders} orders/mo, ${bucket.palletsIn} receiving/mo)`,
              data_sources: dataSources,
              company: deal.org_name || deal.title,
              stage: deal.stage,
              contact: deal.contact_name,
              attempt: (pastFeedback.length + 1),
            },
          });
          audit({
            actor: "jarvis",
            action: "deal.value_estimate_queued",
            subject: deal.id,
            metadata: { company: deal.org_name || deal.title, value, bucket: bucketKey, confidence: confidencePct },
          });
          results.push({ id: deal.id, company: deal.org_name || deal.title, value, bucket: bucketKey, confidence_pct: confidencePct, queued: true });
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

    // Re-estimate this specific deal with the user's feedback
    let reEstimated = false;
    if (deal_id && decision === "rejected") {
      const deal = db.prepare("SELECT * FROM crm_deals WHERE id = ?").get(deal_id) as any;
      if (deal) {
        const dealNotes = deal.notes_summary || "";
        const acts = db.prepare("SELECT type, subject FROM crm_activities WHERE deal_id = ? ORDER BY rowid DESC LIMIT 5").all(deal.id) as any[];
        const nts = db.prepare("SELECT content FROM crm_notes WHERE deal_id = ? ORDER BY rowid DESC LIMIT 3").all(deal.id) as any[];
        const actText = acts.map((a: any) => `[${a.type}] ${a.subject || ""}`).join("\n");
        const noteText = nts.map((n: any) => (n.content || "").slice(0, 300)).join("\n");

        const allFeedback = db.prepare(
          "SELECT reason, corrected_value, original_estimate FROM value_estimate_feedback WHERE deal_id = ? ORDER BY created_at DESC LIMIT 5"
        ).all(deal.id) as any[];

        const feedbackBlock = `\nPrevious estimates rejected:\n${allFeedback.map((f: any) =>
          `- Estimated $${f.original_estimate?.toLocaleString()}${f.corrected_value ? `, actual $${f.corrected_value.toLocaleString()}` : ""}. Reason: ${f.reason}`
        ).join("\n")}`;

        const ctx = [
          `Company: ${deal.org_name || deal.title}`,
          `Stage: ${deal.stage}`,
          `Contact: ${deal.contact_name || "unknown"}`,
          dealNotes ? `Notes:\n${dealNotes.slice(0, 1000)}` : "",
          noteText ? `CRM Notes:\n${noteText}` : "",
          actText ? `Activities:\n${actText}` : "",
        ].filter(Boolean).join("\n");

        const dataSrcs: string[] = ["user_feedback"];
        if (dealNotes) dataSrcs.push("deal_notes");
        if (noteText) dataSrcs.push("crm_notes");
        if (actText) dataSrcs.push("activities");

        try {
          // Use same bucket classification approach
          const result = await callModel({
            kind: "summary",
            privacy: "personal",
            prompt: `Re-classify this deal into a volume bucket. Previous estimate was WRONG.

${ctx}${feedbackBlock}

Volume buckets:
- "tiny": ~5 pallets, ~100 orders/mo. Monthly ~$3,700.
- "small": ~15 pallets, ~300 orders/mo. Monthly ~$3,500.
- "medium": ~50 pallets, ~1,000 orders/mo. Monthly ~$5,000.
- "large": ~150 pallets, ~3,000 orders/mo. Monthly ~$13,000.
- "xlarge": ~500+ pallets, ~10,000+ orders/mo. Monthly ~$35,000+.

${corrected_value ? `The user says the real value is ~$${Number(corrected_value).toLocaleString()}/yr (~$${Math.round(Number(corrected_value) / 12).toLocaleString()}/mo). Pick the bucket closest to that.` : ""}

Return ONLY: {"bucket": "tiny"|"small"|"medium"|"large"|"xlarge", "confidence_pct": <0-100>, "confidence_why": "<reason>"}`,
          }, { skill: "deal_value_estimator" });

          const parsed = JSON.parse(result.text.trim().replace(/```json?\n?/g, "").replace(/```/g, ""));
          const bucketKey = parsed.bucket || "small";
          const bucket = VOLUME_BUCKETS[bucketKey] || VOLUME_BUCKETS.small;
          const calc = calculateDealValue(bucket);

          approvals.enqueue({
            title: `Re-estimate: ${deal.org_name || deal.title} — $${calc.monthly.toLocaleString()}/mo ($${calc.annual.toLocaleString()}/yr)`,
            reason: `Revised after feedback: "${reason}"`,
            skill: "deal_value_estimator",
            riskLevel: "low",
            payload: {
              deal_id: deal.id,
              estimated_value: calc.annual,
              monthly_total: calc.monthly,
              confidence_pct: parsed.confidence_pct ?? 50,
              confidence_why: parsed.confidence_why ?? "",
              volume_bucket: bucketKey,
              volume_label: bucket.label,
              math: calc.lines,
              assumptions: `Volume bucket: ${bucket.label}. ${parsed.confidence_why || ""}`,
              data_sources: dataSrcs,
              company: deal.org_name || deal.title,
              stage: deal.stage,
              contact: deal.contact_name,
              attempt: allFeedback.length + 1,
              previous_estimate: original_estimate,
              user_correction: corrected_value,
            },
          });
          reEstimated = true;

          audit({
            actor: "jarvis",
            action: "deal.value_re_estimated",
            subject: deal.id,
            metadata: { company: deal.org_name || deal.title, bucket: bucketKey, oldValue: original_estimate, newValue: calc.annual },
          });
        } catch {}
      }
    }

    return { ok: true, denialCount, recalibrated, reEstimated };
  });
}
