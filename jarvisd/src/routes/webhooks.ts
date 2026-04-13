// Webhooks — Pipedrive pushes deal/lead/activity changes to us.
// Zero API cost, instant updates. Pipedrive sends POST to /webhooks/pipedrive.

import type { FastifyInstance } from "fastify";
import { db } from "../db/db.js";
import { audit } from "../lib/audit.js";
import { bus } from "../lib/events.js";
import { runSkill } from "../lib/workflow.js";
import { registry } from "../lib/skills.js";

export async function webhookRoutes(app: FastifyInstance) {

  // Pipedrive webhook receiver
  app.post("/webhooks/pipedrive", async (req, reply) => {
    const body = req.body as any;
    if (!body || !body.event) {
      return reply.code(400).send({ error: "invalid webhook payload" });
    }

    const event = body.event;       // e.g. "updated.deal", "added.deal", "added.lead"
    const current = body.current;   // current state of the object
    const previous = body.previous; // previous state (for updates)
    const meta = body.meta;

    audit({
      actor: "pipedrive_webhook",
      action: `webhook.${event}`,
      subject: current?.id ? String(current.id) : "unknown",
      metadata: { event },
    });

    // Route by event type
    if (event.includes("deal")) {
      await handleDealWebhook(event, current, previous);
    } else if (event.includes("lead")) {
      await handleLeadWebhook(event, current);
    } else if (event.includes("activity")) {
      await handleActivityWebhook(event, current);
    } else if (event.includes("note")) {
      await handleNoteWebhook(event, current);
    }

    // Emit to WebSocket so UI updates instantly
    bus.emit("crm.updated", { event, id: current?.id });

    return { ok: true };
  });

  // Webhook registration helper — tells you the URL to set in Pipedrive
  app.get("/webhooks/pipedrive/info", async () => ({
    url: "http://YOUR_PUBLIC_URL/webhooks/pipedrive",
    note: "Set this URL in Pipedrive → Settings → Webhooks. For local dev, use ngrok or cloudflare tunnel.",
    events: [
      "added.deal", "updated.deal", "deleted.deal",
      "added.lead", "updated.lead",
      "added.activity", "updated.activity",
      "added.note",
    ],
  }));
}

async function handleDealWebhook(event: string, current: any, previous: any) {
  if (!current?.id) return;

  const personName = current.person_name ?? "";
  const personEmail = current.person_id?.email?.[0]?.value ?? current.cc_email ?? "";
  const orgName = current.org_name ?? current.org_id?.name ?? "";
  const stageName = current.stage_id ? (current.pipeline_id ? `Stage ${current.stage_id}` : "") : "";

  if (event === "added.deal" || event === "updated.deal") {
    db.prepare(`
      INSERT INTO crm_deals(id, pipedrive_id, title, org_name, contact_name, contact_email,
        pipeline, stage, status, value, currency, created_at, updated_at, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(pipedrive_id) DO UPDATE SET
        title=excluded.title, org_name=excluded.org_name, contact_name=excluded.contact_name,
        contact_email=excluded.contact_email, stage=excluded.stage, status=excluded.status,
        value=excluded.value, updated_at=excluded.updated_at, synced_at=datetime('now')
    `).run(
      `pd-${current.id}`,
      current.id,
      current.title ?? "",
      orgName,
      personName,
      personEmail,
      current.pipeline_id ? `Pipeline ${current.pipeline_id}` : "",
      stageName,
      current.status ?? "open",
      current.value ?? 0,
      current.currency ?? "USD",
      current.add_time ?? "",
      current.update_time ?? "",
    );

    // If deal stage changed, log it
    if (previous && previous.stage_id !== current.stage_id) {
      audit({
        actor: "pipedrive_webhook",
        action: "deal.stage_changed",
        subject: String(current.id),
        metadata: {
          title: current.title,
          from: previous.stage_id,
          to: current.stage_id,
        },
      });
    }

    // If deal was won
    if (current.status === "won" && (!previous || previous.status !== "won")) {
      audit({
        actor: "pipedrive_webhook",
        action: "deal.won",
        subject: String(current.id),
        metadata: { title: current.title, value: current.value },
      });
      bus.emit("deal.won", { id: current.id, title: current.title, value: current.value });
    }

    // If deal was lost
    if (current.status === "lost" && (!previous || previous.status !== "lost")) {
      audit({
        actor: "pipedrive_webhook",
        action: "deal.lost",
        subject: String(current.id),
        metadata: { title: current.title, reason: current.lost_reason },
      });
      bus.emit("deal.lost", { id: current.id, title: current.title, reason: current.lost_reason });
    }
  }

  if (event === "deleted.deal") {
    db.prepare("DELETE FROM crm_deals WHERE pipedrive_id = ?").run(current.id);
  }
}

async function handleLeadWebhook(event: string, current: any) {
  if (!current?.id) return;

  if (event === "added.lead") {
    const personName = current.person?.name ?? current.title ?? "";
    const personEmail = current.person?.emails?.[0] ?? "";
    const orgName = current.organization?.name ?? "";

    db.prepare(`
      INSERT INTO crm_leads(id, pipedrive_id, title, org_name, contact_name, contact_email,
        source, status, created_at, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, datetime('now'))
      ON CONFLICT(pipedrive_id) DO UPDATE SET
        title=excluded.title, org_name=excluded.org_name, contact_name=excluded.contact_name,
        contact_email=excluded.contact_email, synced_at=datetime('now')
    `).run(
      `pdl-${current.id}`,
      current.id,
      current.title ?? "",
      orgName,
      personName,
      personEmail,
      current.source_name ?? "",
      current.add_time ?? "",
    );

    // Auto-research new leads
    if (registry.get("lead_research")) {
      try {
        await runSkill("lead_research", {
          inputs: {
            leadId: `pdl-${current.id}`,
            company: orgName || current.title || "",
            contactName: personName,
            contactEmail: personEmail,
          },
          triggeredBy: "event",
        });
      } catch (err: any) {
        console.warn(`[webhook] lead_research failed: ${err.message}`);
      }
    }
  }
}

async function handleActivityWebhook(event: string, current: any) {
  if (!current?.id) return;

  db.prepare(`
    INSERT INTO crm_activities(id, pipedrive_id, deal_id, type, subject, done, due_date, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(pipedrive_id) DO UPDATE SET
      done=excluded.done, synced_at=datetime('now')
  `).run(
    `pda-${current.id}`,
    current.id,
    current.deal_id ? `pd-${current.deal_id}` : null,
    current.type ?? "",
    current.subject ?? "",
    current.done ? 1 : 0,
    current.due_date ?? "",
  );
}

async function handleNoteWebhook(event: string, current: any) {
  if (!current?.id) return;

  db.prepare(`
    INSERT INTO crm_notes(id, pipedrive_id, deal_id, content, added_at, synced_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(pipedrive_id) DO UPDATE SET
      content=excluded.content, synced_at=datetime('now')
  `).run(
    `pdn-${current.id}`,
    current.id,
    current.deal_id ? `pd-${current.deal_id}` : null,
    current.content ?? "",
    current.add_time ?? "",
  );
}
