// Pipedrive CRM connector — syncs deals, leads, activities.
// Uses the Pipedrive REST API v1. Only polls for recent changes to stay cheap.

import { db } from "../../db/db.js";
import { vault } from "../vault.js";
import { audit } from "../audit.js";

const API_VERSION = "v1";

function getApiToken(): string {
  const token = vault.get("pipedrive_api_token") ?? vault.get("pipedrive_api_key");
  if (!token) throw new Error("Pipedrive API token not set — add it in Settings > Providers");
  return token;
}

function getDomain(): string {
  return vault.get("pipedrive_domain") ?? "api";
}

async function pipedriveApi(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const token = getApiToken();
  const domain = getDomain();
  const qs = new URLSearchParams({ api_token: token, ...params });
  const url = `https://${domain}.pipedrive.com/${API_VERSION}/${endpoint}?${qs}`;

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pipedrive API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Sync deals from the "New pipeline" (or specified pipeline)
// ---------------------------------------------------------------------------

export async function syncDeals(pipelineName = "all"): Promise<{ synced: number; total: number }> {
  // Get stages + pipelines maps for real names
  const stagesResult = await pipedriveApi("stages");
  const stageMap: Record<number, string> = {};
  for (const s of (stagesResult.data ?? [])) {
    stageMap[s.id] = s.name;
  }

  const pipelinesResult = await pipedriveApi("pipelines");
  const pipelineMap: Record<number, string> = {};
  for (const p of (pipelinesResult.data ?? [])) {
    pipelineMap[p.id] = p.name;
  }

  // Pull ALL deals across all pipelines (open + won + lost)
  const allDeals: any[] = [];
  for (const status of ["open", "won", "lost"]) {
    let start = 0;
    let hasMore = true;
    while (hasMore && start < 500) {
      const result = await pipedriveApi("deals", {
        status,
        limit: "100",
        start: String(start),
        sort: "value DESC",
      });
      const batch = result.data ?? [];
      allDeals.push(...batch);
      hasMore = result.additional_data?.pagination?.more_items_in_collection ?? false;
      start += 100;
    }
  }

  const deals = allDeals;
  let synced = 0;

  const upsert = db.prepare(`
    INSERT INTO crm_deals(id, pipedrive_id, title, org_name, contact_name, contact_email, contact_phone,
      pipeline, stage, status, value, currency, created_at, updated_at, last_activity, next_activity,
      total_activities, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(pipedrive_id) DO UPDATE SET
      title=excluded.title, org_name=excluded.org_name, contact_name=excluded.contact_name,
      contact_email=excluded.contact_email, pipeline=excluded.pipeline, stage=excluded.stage, status=excluded.status,
      value=excluded.value, updated_at=excluded.updated_at, last_activity=excluded.last_activity,
      next_activity=excluded.next_activity, total_activities=excluded.total_activities,
      synced_at=datetime('now')
  `);

  for (const d of deals) {
    const personName = d.person_id?.name ?? d.person_name ?? "";
    const personEmail = d.person_id?.email?.[0]?.value ?? d.cc_email ?? "";
    const personPhone = d.person_id?.phone?.[0]?.value ?? "";
    const orgName = d.org_id?.name ?? d.org_name ?? "";
    const stageName = stageMap[d.stage_id] ?? `Stage ${d.stage_id}`;
    const pipelineLabel = pipelineMap[d.pipeline_id] ?? `Pipeline ${d.pipeline_id}`;

    upsert.run(
      `pd-${d.id}`,
      d.id,
      d.title ?? "",
      orgName,
      personName,
      personEmail,
      personPhone,
      pipelineLabel,
      stageName,
      d.status ?? "open",
      d.value ?? 0,
      d.currency ?? "USD",
      d.add_time ?? "",
      d.update_time ?? "",
      d.last_activity_date ?? "",
      d.next_activity_date ?? "",
      (d.activities_count ?? 0) + (d.done_activities_count ?? 0),
    );
    synced++;
  }

  audit({
    actor: "pipedrive",
    action: "pipedrive.sync.deals",
    metadata: { pipeline: pipelineName, synced, total: deals.length },
  });

  return { synced, total: deals.length };
}

// Stage name cache
const stageCache = new Map<number, string>();

async function getStageNameCached(stageId: number): Promise<string> {
  if (stageCache.has(stageId)) return stageCache.get(stageId)!;
  try {
    const result = await pipedriveApi(`stages/${stageId}`);
    const name = result.data?.name ?? `Stage ${stageId}`;
    stageCache.set(stageId, name);
    return name;
  } catch {
    return `Stage ${stageId}`;
  }
}

// ---------------------------------------------------------------------------
// Sync leads
// ---------------------------------------------------------------------------

export async function syncLeads(): Promise<{ synced: number }> {
  const result = await pipedriveApi("leads", { limit: "100", sort: "add_time DESC" });
  const leads = result.data ?? [];
  let synced = 0;

  const upsert = db.prepare(`
    INSERT INTO crm_leads(id, pipedrive_id, title, org_name, contact_name, contact_email, source, label, status, created_at, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, datetime('now'))
    ON CONFLICT(pipedrive_id) DO UPDATE SET
      title=excluded.title, org_name=excluded.org_name, contact_name=excluded.contact_name,
      contact_email=excluded.contact_email, source=excluded.source, label=excluded.label,
      synced_at=datetime('now')
  `);

  for (const l of leads) {
    const personName = l.person?.name ?? l.title ?? "";
    const personEmail = l.person?.emails?.[0] ?? "";
    const orgName = l.organization?.name ?? "";

    upsert.run(
      `pdl-${l.id}`,
      l.id,
      l.title ?? "",
      orgName,
      personName,
      personEmail,
      l.source_name ?? "",
      (l.label_ids ?? []).join(","),
      l.add_time ?? "",
    );
    synced++;
  }

  audit({
    actor: "pipedrive",
    action: "pipedrive.sync.leads",
    metadata: { synced },
  });

  return { synced };
}

// ---------------------------------------------------------------------------
// Sync activities
// ---------------------------------------------------------------------------

export async function syncActivities(): Promise<{ synced: number }> {
  // Fetch both done and undone activities
  const [undoneResult, doneResult] = await Promise.all([
    pipedriveApi("activities", { limit: "100", done: "0" }),
    pipedriveApi("activities", { limit: "100", done: "1" }),
  ]);
  const activities = [...(undoneResult.data ?? []), ...(doneResult.data ?? [])];
  let synced = 0;

  const upsert = db.prepare(`
    INSERT INTO crm_activities(id, pipedrive_id, deal_id, type, subject, done, due_date, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      done=excluded.done, subject=excluded.subject, synced_at=datetime('now')
  `);

  for (const a of activities) {
    const dealId = a.deal_id ? `pd-${a.deal_id}` : null;
    upsert.run(
      `pda-${a.id}`,
      a.id,
      dealId,
      a.type ?? "activity",
      a.subject ?? "",
      a.done ? 1 : 0,
      a.due_date ?? "",
    );
    synced++;
  }

  audit({ actor: "pipedrive", action: "pipedrive.sync.activities", metadata: { synced } });
  return { synced };
}

// ---------------------------------------------------------------------------
// Sync notes
// ---------------------------------------------------------------------------

export async function syncNotes(): Promise<{ synced: number }> {
  const result = await pipedriveApi("notes", { limit: "200" });
  const notes = result.data ?? [];
  let synced = 0;

  const upsert = db.prepare(`
    INSERT INTO crm_notes(id, pipedrive_id, deal_id, content, added_at, synced_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      content=excluded.content, synced_at=datetime('now')
  `);

  for (const n of notes) {
    const dealId = n.deal_id ? `pd-${n.deal_id}` : null;
    const content = (n.content ?? "").replace(/<[^>]*>/g, "").trim();
    if (!content) continue;
    upsert.run(
      `pdn-${n.id}`,
      n.id,
      dealId,
      content,
      n.add_time ?? "",
    );
    synced++;
  }

  audit({ actor: "pipedrive", action: "pipedrive.sync.notes", metadata: { synced } });
  return { synced };
}

// ---------------------------------------------------------------------------
// Query local CRM data
// ---------------------------------------------------------------------------

export function getDeals(pipeline?: string, status = "open"): any[] {
  if (pipeline) {
    return db.prepare(
      "SELECT * FROM crm_deals WHERE pipeline = ? AND status = ? ORDER BY value DESC"
    ).all(pipeline, status) as any[];
  }
  return db.prepare(
    "SELECT * FROM crm_deals WHERE status = ? ORDER BY value DESC"
  ).all(status) as any[];
}

export function getDeal(id: string): any {
  return db.prepare("SELECT * FROM crm_deals WHERE id = ?").get(id);
}

export function getLeads(status = "active"): any[] {
  return db.prepare(
    "SELECT * FROM crm_leads WHERE status = ? ORDER BY created_at DESC"
  ).all(status) as any[];
}

export function getDealsByStage(): Record<string, any[]> {
  const deals = getDeals(undefined, "open");
  const stages: Record<string, any[]> = {};
  for (const d of deals) {
    const stage = d.stage || "Unknown";
    if (!stages[stage]) stages[stage] = [];
    stages[stage].push(d);
  }
  return stages;
}

export function getPipelineStats(): {
  totalDeals: number;
  totalValue: number;
  overdue: number;
  byStage: Record<string, { count: number; value: number }>;
} {
  const deals = getDeals("New pipeline", "open");
  const now = new Date().toISOString().slice(0, 10);
  let overdue = 0;
  const byStage: Record<string, { count: number; value: number }> = {};

  for (const d of deals) {
    if (d.next_activity && d.next_activity < now) overdue++;
    const stage = d.stage || "Unknown";
    if (!byStage[stage]) byStage[stage] = { count: 0, value: 0 };
    byStage[stage].count++;
    byStage[stage].value += d.value ?? 0;
  }

  return {
    totalDeals: deals.length,
    totalValue: deals.reduce((sum: number, d: any) => sum + (d.value ?? 0), 0),
    overdue,
    byStage,
  };
}

export function isPipedriveConnected(): boolean {
  if (vault.isLocked()) return false;
  try {
    return Boolean(vault.get("pipedrive_api_token") ?? vault.get("pipedrive_api_key"));
  } catch {
    return false;
  }
}
