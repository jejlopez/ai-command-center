// CRM routes — pipeline, deals, leads, sync.

import type { FastifyInstance } from "fastify";
import {
  syncDeals, syncLeads, syncActivities, syncNotes, getDeals, getDeal, getLeads,
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
  // Real costs only — no minimums applied to deal value estimates
  const storageCost = bucket.pallets * RATE_CARD.storage_per_pallet;
  const receivingCost = bucket.palletsIn * RATE_CARD.receiving_per_pallet;
  const orderCost = bucket.orders * RATE_CARD.order_processing;
  const pickCost = bucket.orders * RATE_CARD.picks_per_order * RATE_CARD.pick_fee;
  const monthlyTotal = storageCost + receivingCost + orderCost + pickCost + RATE_CARD.admin_fee;
  const annualTotal = monthlyTotal * 12;

  return {
    monthly: Math.round(monthlyTotal),
    annual: Math.round(annualTotal),
    lines: [
      {
        line: "Storage",
        calc: `${bucket.pallets} pallets × $${RATE_CARD.storage_per_pallet}/pallet`,
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
    ],
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
      const [deals, leads, activities, notes] = await Promise.all([
        syncDeals(), syncLeads(), syncActivities(), syncNotes(),
      ]);
      // Log to sync_log
      try {
        db.prepare(`INSERT INTO sync_log(synced_at, deals_synced, deals_total, leads_synced, activities_synced, notes_synced)
          VALUES (datetime('now'), ?, ?, ?, ?, ?)`).run(
          (deals as any).synced ?? 0, (deals as any).total ?? 0,
          (leads as any).synced ?? 0, (activities as any).synced ?? 0, (notes as any).synced ?? 0
        );
      } catch {}
      return { ok: true, deals, leads, activities, notes };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // Pipeline view (deals grouped by stage)
  app.get("/crm/pipeline", async () => getDealsByStage());

  // ── Action feed — real unified feed from all data sources ──────────────────

  app.get("/crm/action-feed", async () => {
    const LEAD_STAGES = ["new lead", "new leads", "pipedrive leads", "gather info"];
    const allDeals = getDeals(undefined, "open");
    const activeDeals = allDeals.filter((d: any) =>
      (d.pipeline || "").trim() === "New pipeline" &&
      !LEAD_STAGES.some(ls => (d.stage || "").toLowerCase().includes(ls))
    );

    const now = Date.now();
    const dayMs = 86400000;
    const items: any[] = [];

    // 1. EMAILS — pull ALL non-Samuel emails, classify into sections
    const allEmails = db.prepare(`
      SELECT * FROM email_triage
      WHERE LOWER(from_addr) NOT LIKE '%3plcenter%'
        AND LOWER(from_addr) NOT LIKE '%samuel%'
        AND action_taken = 0
        AND created_at >= datetime('now', '-7 days')
      ORDER BY created_at DESC
      LIMIT 100
    `).all() as any[];

    // System/automated sender patterns
    const SYSTEM_SENDERS = /noreply|no-reply|notifications?@|mailer-daemon|scheduler|info@pipedrive|linkedin|google\.com|beehiiv|helpdesk|support@|billing@|team@|hello@.*\.io|updates@|olimp|donotreply/i;
    const SYSTEM_SUBJECTS = /unsubscribe|order number|your receipt|payment confirmation|password reset|verify your|welcome to|getting started|weekly digest|daily summary|newsletter/i;
    // Quick reply: ONLY when the subject itself IS the acknowledgment (not containing business topics)
    const QUICK_REPLY_PATTERN = /^(re:\s*)?(thanks?|thank you|confirmed?|accepted|approved|sounds good|works for me|see you|looking forward|noted|got it|perfect|great|ok|will do)\s*$/i;

    // Classify each email into a section
    const emails: any[] = [];   // section 1: needs action
    const quickReplies: any[] = []; // section 2
    const fyiEmails: any[] = []; // section 3
    const systemEmails: any[] = []; // section 4

    for (const e of allEmails) {
      const from = (e.from_addr || "").toLowerCase();
      const subj = (e.subject || "").toLowerCase();
      const snippet = (e.snippet || "").toLowerCase();

      // Section 4: System/automated
      if (SYSTEM_SENDERS.test(from) || SYSTEM_SUBJECTS.test(subj)) {
        systemEmails.push(e);
        continue;
      }

      // Section 2: Quick replies — only when the entire subject is an acknowledgment
      if (QUICK_REPLY_PATTERN.test(subj.trim())) {
        quickReplies.push(e);
        continue;
      }

      // Section 1: Needs action — classified as urgent/action, has business keywords, or linked to a deal
      const isUrgent = e.category === "urgent" || e.category === "action_needed";
      const hasActionKeywords = /contract|proposal|pricing|price|quote|urgent|problem|issue|refund|cancel|question|deadline|asap|schedule|meeting|call|invoice|payment|warehousing|fulfillment|3pl|shipment/i.test(subj + " " + snippet);
      const linkedToDeal = activeDeals.some((d: any) => {
        const ce = (d.contact_email || "").toLowerCase();
        if (!ce) return false;
        // Match by full email or by sender domain (for company matches)
        const senderDomain = from.includes("@") ? from.split("@").pop()?.split(">")[0] : "";
        const contactDomain = ce.split("@")[1] || "";
        return (ce && from.includes(ce)) || (senderDomain && contactDomain && senderDomain === contactDomain && !["gmail.com","yahoo.com","hotmail.com","outlook.com"].includes(senderDomain));
      });

      // Only promote to section 1 if explicitly urgent/action_needed by the triage classifier
      // FYI emails never go to section 1 regardless of keywords or deal links
      if (isUrgent) {
        emails.push(e);
        continue;
      }

      // Section 3: FYI (everything else)
      fyiEmails.push(e);
    }

    for (const e of emails) {
      // Try to link to a deal by sender domain or linked_email
      const senderDomain = (e.from_addr || "").includes("@") ? e.from_addr.split("@").pop()?.split(">")[0]?.toLowerCase() : "";
      const linkedDeal = e.linked_email
        ? activeDeals.find((d: any) => d.contact_email?.toLowerCase() === e.linked_email?.toLowerCase())
        : activeDeals.find((d: any) => d.contact_email?.toLowerCase()?.includes(senderDomain) && senderDomain.length > 5);

      const senderName = (e.from_addr || "").split("<")[0].replace(/"/g, "").trim() || e.from_addr;
      const urgency = e.category === "urgent" ? 9 : e.category === "action_needed" ? 7 : 3;

      items.push({
        id: `email-${e.id}`,
        type: "email",
        title: senderName,
        kind: e.category === "urgent" ? "Urgent" : e.category === "action_needed" ? "Needs Response" : "FYI",
        kindTone: e.category === "urgent" ? "danger" : e.category === "action_needed" ? "warn" : "",
        action: `${e.subject || "(no subject)"}`,
        value: linkedDeal ? (linkedDeal.value || 0) : 0,
        valueFmt: linkedDeal?.value ? `$${(linkedDeal.value >= 1000 ? (linkedDeal.value / 1000).toFixed(0) + "K" : linkedDeal.value)}` : null,
        why: linkedDeal ? `Linked to ${linkedDeal.org_name || linkedDeal.title} (${linkedDeal.stage})` : "Inbox email requiring attention",
        tags: [
          { label: e.category, tone: e.category === "urgent" ? "danger" : e.category === "action_needed" ? "warn" : "" },
        ],
        buttons: [
          { label: "See email", icon: "mail", primary: true },
          ...(linkedDeal ? [{ label: "Open deal", icon: "target" }] : []),
        ],
        urgent: e.category === "urgent",
        score: urgency * 100 + (linkedDeal?.value || 0) / 1000,
        source: "email_triage",
        sourceId: e.message_id,
        threadId: e.thread_id,
        deal: linkedDeal,
        email: e,
      });
    }

    // 2. DEAL FOLLOW-UPS — deals that genuinely need attention
    // Only include deals that are actually stale (>5d) or high-value with any gap
    for (const d of activeDeals) {
      const la = d.last_activity || d.updated_at;
      if (!la) continue;
      const daysSilent = Math.floor((now - new Date(la).getTime()) / dayMs);
      // Skip deals touched recently (unless high-value negotiation)
      const value = d.value || 0;
      const stage = (d.stage || "").toLowerCase();
      const isNegotiating = stage.includes("negotiat");
      if (daysSilent < 3) continue; // touched in last 3 days = not actionable
      if (daysSilent < 5 && !isNegotiating && value < 100000) continue; // small deals need 5+ days

      const contact = d.contact_name || "";
      const company = d.org_name || d.title || "Unknown";

      let kind = "Follow Up";
      let kindTone = "";
      let action = "";
      let why = "";
      let type = "call";
      let urgent = false;
      const tags: any[] = [];

      if (daysSilent > 14 && value > 0) {
        kind = "Churn Risk";
        kindTone = "danger";
        action = `Re-engage ${contact || company} — ${daysSilent} days silent, ${value > 0 ? "$" + (value >= 1000 ? (value/1000).toFixed(0) + "K" : value) + " at risk" : ""}`;
        why = `${daysSilent} days without contact. Deals this silent close at ~23%. Personal call recovers ~40%.`;
        urgent = true;
        tags.push({ label: "Churn Risk", tone: "danger" });
      } else if (stage.includes("proposal") || stage.includes("follow up")) {
        type = "email";
        kind = "Proposal Follow-up";
        kindTone = "warn";
        action = `Follow up with ${contact || company} on proposal — ${daysSilent} days pending`;
        why = `Proposals stale after 7+ days need a nudge. Push for decision or address concerns.`;
        tags.push({ label: "Proposal pending" });
      } else if (stage.includes("negotiat")) {
        type = "deal";
        kind = "Advance Deal";
        kindTone = "info";
        action = `Push ${company} negotiations forward — ${daysSilent} days since last touch`;
        why = `In negotiations. Momentum matters — contracts stall 3.5× after 48h of silence.`;
        tags.push({ label: "Closing" });
      } else {
        type = "email";
        kind = `${daysSilent}d Silent`;
        action = `Check in with ${contact || company} — routine follow-up`;
        why = `${daysSilent} days since last contact. Keep the deal moving forward.`;
      }

      if (value > 200000) tags.push({ label: "Whale", tone: "whale" });

      const buttons = [];
      if (d.contact_email) buttons.push({ label: "Draft email", icon: "mail", primary: true });
      if (d.contact_phone) buttons.push({ label: "Call now", icon: "phone", primary: !d.contact_email });
      buttons.push({ label: "Open deal", icon: "target" });

      items.push({
        id: `deal-${d.id}`,
        type,
        title: `${company}${contact ? " — " + contact : ""}`,
        kind,
        kindTone,
        action,
        value,
        valueFmt: value > 0 ? "$" + (value >= 1000000 ? (value/1000000).toFixed(1)+"M" : value >= 1000 ? (value/1000).toFixed(0)+"K" : value) : null,
        valueTone: urgent ? "danger" : null,
        why,
        lastTouch: `${daysSilent}d ago`,
        respondWithin: urgent ? { label: "today", tone: "warn" } : null,
        tags,
        buttons,
        urgent,
        score: (urgent ? 1000 : 0) + value / 100 + daysSilent * 10,
        source: "deal",
        deal: d,
      });
    }

    // 3. PENDING APPROVALS — drafts waiting for review
    const pendingApprovals = approvals.pending();
    for (const a of pendingApprovals.slice(0, 5)) {
      let payload: any = {};
      try { payload = typeof a.payload === "string" ? JSON.parse(a.payload) : (a.payload || {}); } catch {}

      items.push({
        id: `approval-${a.id}`,
        type: "task",
        title: a.title || "Approval needed",
        kind: "Review",
        kindTone: "warn",
        action: a.reason || "Jarvis needs your approval",
        value: payload.estimated_value || 0,
        valueFmt: payload.estimated_value ? "$" + (payload.estimated_value >= 1000 ? (payload.estimated_value/1000).toFixed(0)+"K" : payload.estimated_value) : null,
        why: `Queued by ${a.skill || "Jarvis"}. Waiting for your review.`,
        tags: [{ label: "Approval", tone: "warn" }],
        buttons: [{ label: "Review", icon: "eye", primary: true }],
        urgent: false,
        score: 50 + (payload.estimated_value || 0) / 1000,
        source: "approval",
        approvalId: a.id,
      });
    }

    // Sort by score descending, assign ranks
    items.sort((a, b) => b.score - a.score);
    items.forEach((item, i) => { item.rank = i + 1; });

    // Count by type
    const counts = { all: items.length, call: 0, email: 0, task: 0, deal: 0 };
    for (const it of items) {
      if (counts[it.type as keyof typeof counts] !== undefined) {
        (counts as any)[it.type]++;
      }
    }

    // Build section 2: quick replies
    const quickReplyItems = quickReplies.map((e: any, i: number) => {
      const senderName = (e.from_addr || "").split("<")[0].replace(/"/g, "").trim();
      return {
        id: `quick-${e.id}`, type: "email", section: "quick_reply",
        title: senderName, action: e.subject || "(no subject)",
        email: e, sourceId: e.message_id, threadId: e.thread_id,
        buttons: [{ label: "Quick thanks", icon: "send", primary: true }, { label: "Skip" }],
      };
    });

    // Build section 3: FYI
    const fyiItems = fyiEmails.map((e: any) => {
      const senderName = (e.from_addr || "").split("<")[0].replace(/"/g, "").trim();
      return {
        id: `fyi-${e.id}`, type: "email", section: "fyi",
        title: senderName, action: e.subject || "(no subject)",
        email: e, sourceId: e.message_id, threadId: e.thread_id,
      };
    });

    // Build section 4: system
    const systemItems = systemEmails.map((e: any) => {
      const senderName = (e.from_addr || "").split("<")[0].replace(/"/g, "").trim();
      return {
        id: `sys-${e.id}`, type: "email", section: "system",
        title: senderName, action: e.subject || "(no subject)",
        email: e, sourceId: e.message_id,
      };
    });

    const totalAll = items.length + quickReplyItems.length + fyiItems.length + systemItems.length;

    return {
      items: items.slice(0, 20),
      counts,
      total: items.length,
      sections: {
        needs_action: { count: items.length, label: "Needs Action" },
        quick_reply: { count: quickReplyItems.length, label: "Quick Replies", items: quickReplyItems },
        fyi: { count: fyiItems.length, label: "FYI — Inbox Scan", items: fyiItems },
        system: { count: systemItems.length, label: "System & Automated", items: systemItems },
      },
      totalAll,
    };
  });

  // Mark an action feed item as handled
  app.post("/crm/action-feed/handled", async (req) => {
    const { itemId, source, sourceId, action } = req.body as any;
    if (!itemId) return { error: "itemId required" };

    // If it's an email, mark action_taken in triage
    if (source === "email_triage" && sourceId) {
      db.prepare("UPDATE email_triage SET action_taken = 1 WHERE message_id = ?").run(sourceId);
    }

    // Log to learning system
    db.prepare(`INSERT INTO jarvis_learning(id, type, data, created_at) VALUES (?, 'action_handled', ?, datetime('now'))`)
      .run(crypto.randomUUID(), JSON.stringify({ itemId, source, sourceId, action: action || "handled" }));

    audit({ actor: "user", action: "feed.item.handled", subject: itemId, metadata: { source, action } });
    return { ok: true };
  });

  // Pipeline stats
  app.get("/crm/stats", async () => getPipelineStats());

  // All deals
  app.get("/crm/deals", async (req) => {
    const { pipeline, status } = req.query as any;
    return getDeals(pipeline, status ?? "open");
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

  // Deal activity timeline — all history for one deal
  app.get<{ Params: { id: string } }>("/crm/deals/:id/timeline", async (req, reply) => {
    const rawId = (req.params as any).id;
    let deal = getDeal(rawId);
    // If UUID or numeric, try pd-{id} format
    if (!deal && /^\d+$/.test(rawId)) {
      deal = getDeal(`pd-${rawId}`);
    }
    if (!deal) {
      // Try looking up by pipedrive_id
      deal = db.prepare("SELECT * FROM crm_deals WHERE pipedrive_id = ?").get(parseInt(rawId) || 0) as any;
    }
    if (!deal) return reply.code(404).send({ error: "Deal not found" });
    const id = deal.id;

    const contactEmail = (deal.contact_email || "").toLowerCase().trim();
    const contactName = (deal.contact_name || "").toLowerCase().trim();
    const contactDomain = contactEmail.includes("@") ? contactEmail.split("@")[1] : "";
    // Skip generic domains for domain matching
    const genericDomains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "aol.com"];
    const useContactDomain = contactDomain && !genericDomains.includes(contactDomain);

    // Activities from Pipedrive sync
    const activities = db.prepare(
      "SELECT * FROM crm_activities WHERE deal_id = ? ORDER BY due_date DESC, synced_at DESC LIMIT 50"
    ).all(id) as any[];

    // Notes from Pipedrive sync
    const notes = db.prepare(
      "SELECT * FROM crm_notes WHERE deal_id = ? ORDER BY added_at DESC LIMIT 30"
    ).all(id) as any[];

    // Emails from Gmail — match by linked_email (backfill), from_addr, or domain
    let emails: any[] = [];

    if (contactEmail) {
      // Primary: backfilled emails linked to this contact (includes sent AND received)
      const linkedEmails = db.prepare(
        "SELECT * FROM email_triage WHERE LOWER(linked_email) = ? ORDER BY created_at DESC LIMIT 30"
      ).all(contactEmail) as any[];
      emails.push(...linkedEmails);

      // Secondary: emails from this contact in from_addr (catches non-backfilled)
      if (emails.length < 20) {
        const fromContact = db.prepare(
          "SELECT * FROM email_triage WHERE LOWER(from_addr) LIKE ? AND id NOT IN (SELECT value FROM json_each(?)) ORDER BY created_at DESC LIMIT 20"
        ).all(`%${contactEmail}%`, JSON.stringify(emails.map(e => e.id))) as any[];
        emails.push(...fromContact);
      }
    }
    if (useContactDomain && emails.length < 15) {
      // Tertiary: emails from company domain
      const existingIds = new Set(emails.map(e => e.id));
      const fromDomain = db.prepare(
        "SELECT * FROM email_triage WHERE LOWER(from_addr) LIKE ? ORDER BY created_at DESC LIMIT 20"
      ).all(`%${contactDomain}%`) as any[];
      for (const e of fromDomain) {
        if (!existingIds.has(e.id)) emails.push(e);
      }
    }

    // If triage has few matches and we have a contact email, search Gmail directly
    if (emails.length < 5 && contactEmail) {
      try {
        const { listMessages } = await import("../lib/providers/gmail_actions.js");
        const gmailResults = await listMessages(20, `from:${contactEmail} OR to:${contactEmail}`);
        for (const gm of gmailResults) {
          // Skip if already in triage matches (dedup by subject+date)
          const isDupe = emails.some(e =>
            e.subject === gm.subject && e.from_addr?.includes(gm.from?.split("<")[0]?.trim() || "NOMATCH")
          );
          if (!isDupe) {
            emails.push({
              id: `gmail-${gm.id}`,
              message_id: gm.id,
              thread_id: gm.threadId,
              from_addr: gm.from,
              subject: gm.subject,
              snippet: gm.snippet,
              category: "fyi",
              created_at: gm.date,
            });
          }
        }
      } catch {}
    }

    // Drafts we sent to this contact
    const drafts = contactEmail
      ? db.prepare(
          "SELECT * FROM email_drafts WHERE LOWER(to_addr) LIKE ? ORDER BY created_at DESC LIMIT 10"
        ).all(`%${contactEmail}%`) as any[]
      : [];

    // Normalize everything into timeline events
    const timeline: any[] = [];

    for (const a of activities) {
      timeline.push({
        id: a.id,
        type: a.type || "activity",
        subject: a.subject || a.type || "Activity",
        body: null,
        source: "pipedrive",
        ts: a.due_date || a.synced_at,
        done: a.done,
      });
    }

    for (const n of notes) {
      const content = (n.content || "").replace(/<[^>]*>/g, "").trim();
      timeline.push({
        id: n.id,
        type: "note",
        subject: content.slice(0, 80) + (content.length > 80 ? "…" : ""),
        body: content,
        source: "pipedrive",
        ts: n.added_at || n.synced_at,
      });
    }

    for (const e of emails) {
      timeline.push({
        id: e.id,
        type: "email_received",
        subject: e.subject || "(no subject)",
        body: e.snippet,
        source: "gmail",
        ts: e.created_at,
        from: e.from_addr,
        messageId: e.message_id,
        threadId: e.thread_id,
        category: e.category,
      });
    }

    for (const d of drafts) {
      timeline.push({
        id: d.id,
        type: d.status === "sent" ? "email_sent" : "email_draft",
        subject: d.subject || "(no subject)",
        body: (d.body_edited || d.body_original || "").slice(0, 200),
        source: "jarvis",
        ts: d.sent_at || d.created_at,
        status: d.status,
      });
    }

    // Add notes_summary as a research entry if present
    if (deal.notes_summary) {
      timeline.push({
        id: `notes-${id}`,
        type: "research",
        subject: "Prospect Research",
        body: deal.notes_summary,
        source: "jarvis",
        ts: deal.synced_at || deal.updated_at,
      });
    }

    // Sort newest first
    timeline.sort((a, b) => {
      const ta = new Date(a.ts || 0).getTime();
      const tb = new Date(b.ts || 0).getTime();
      return tb - ta;
    });

    return { deal_id: id, company: deal.org_name || deal.title, count: timeline.length, timeline };
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

    // Get all deal IDs that already have a pending or approved estimate — skip them
    const existingApprovals = approvals.pending().filter((a: any) => a.skill === "deal_value_estimator");
    const alreadyQueued = new Set(existingApprovals.map((a: any) => {
      try { return JSON.parse(a.payload).deal_id; } catch { return null; }
    }).filter(Boolean));

    // Also check decided approvals (approved ones already wrote the value)
    const decided = db.prepare(
      "SELECT payload FROM approvals WHERE skill = 'deal_value_estimator' AND decision IS NOT NULL"
    ).all() as any[];
    for (const d of decided) {
      try { const p = JSON.parse(d.payload); if (p.deal_id) alreadyQueued.add(p.deal_id); } catch {}
    }

    const results: any[] = [];

    for (const deal of deals) {
      // Skip if already has a pending or decided estimate
      if (alreadyQueued.has(deal.id)) {
        results.push({ id: deal.id, company: deal.org_name || deal.title, skipped: true, reason: "already estimated" });
        continue;
      }

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
        // Step 1: Extract real volumes from notes — use actual numbers, not buckets
        const allText = (context + " " + dealNotes).toLowerCase();

        // Parse all pallet mentions, take the largest reasonable one
        const palletMatches = [...allText.matchAll(/(\d[\d,]*)\s*pallets?/g)].map(m => parseInt(m[1].replace(/,/g, "")));
        // Parse order/shipment mentions with or without /mo qualifier
        const orderMatches = [...allText.matchAll(/(\d[\d,]*)\s*(orders?|shipments?|packages?|boxes?|pieces?)/g)].map(m => parseInt(m[1].replace(/,/g, "")));

        // Filter out unreasonable numbers (likely years, IDs, etc)
        const reasonablePallets = palletMatches.filter(n => n > 0 && n < 10000);
        const reasonableOrders = orderMatches.filter(n => n > 0 && n < 100000);

        // Use the most common/median value, or the first one
        const parsedPallets = reasonablePallets.length > 0 ? reasonablePallets.sort((a, b) => a - b)[Math.floor(reasonablePallets.length / 2)] : 0;
        const parsedOrders = reasonableOrders.length > 0 ? reasonableOrders.sort((a, b) => a - b)[Math.floor(reasonableOrders.length / 2)] : 0;

        // Known large companies
        const orgLower = (deal.org_name || deal.title || "").toLowerCase();
        const isKnownLarge = /spacex|tesla|amazon|walmart|target|costco|nike/i.test(orgLower);

        // Stage-based defaults
        const stage = (deal.stage || "").toLowerCase();
        const isNegotiating = stage.includes("negotiat") || stage.includes("proposal") || stage.includes("follow up");
        const isNewLead = stage.includes("new lead") || stage.includes("gather info");

        let bucket: VolumeBucket;
        let bucketKey: string;
        let confidencePct: number;
        let confidenceWhy: string;

        if (parsedPallets > 0 || parsedOrders > 0) {
          // USE REAL NUMBERS from the notes — not bucket defaults
          const pallets = parsedPallets || (parsedOrders > 0 ? Math.max(5, Math.ceil(parsedOrders / 50)) : 15);
          const orders = parsedOrders || (parsedPallets > 0 ? parsedPallets * 20 : 300);
          const palletsIn = Math.max(2, Math.ceil(pallets * 0.3));

          bucket = { label: `Custom (from notes)`, pallets, orders, palletsIn };
          bucketKey = `custom_${pallets}p_${orders}o`;
          confidencePct = 85;
          confidenceWhy = `Extracted from deal notes: ${parsedPallets > 0 ? `${parsedPallets} pallets` : ""}${parsedPallets > 0 && parsedOrders > 0 ? ", " : ""}${parsedOrders > 0 ? `${parsedOrders} orders/mo` : ""}`;
        } else if (isKnownLarge) {
          bucket = VOLUME_BUCKETS.xlarge;
          bucketKey = "xlarge";
          confidencePct = 70;
          confidenceWhy = "Known large company — estimated xlarge";
        } else if (isNegotiating) {
          bucket = VOLUME_BUCKETS.medium;
          bucketKey = "medium";
          confidencePct = 50;
          confidenceWhy = "In negotiation/proposal stage but no volume data — estimated medium";
        } else if (isNewLead) {
          bucket = VOLUME_BUCKETS.small;
          bucketKey = "small";
          confidencePct = 35;
          confidenceWhy = "New lead with no volume data — defaulting to small";
        } else {
          bucket = VOLUME_BUCKETS.small;
          bucketKey = "small";
          confidencePct = 30;
          confidenceWhy = "No volume data or stage context";
        }

        // Step 2: Calculate value using REAL rate card with actual volumes
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
