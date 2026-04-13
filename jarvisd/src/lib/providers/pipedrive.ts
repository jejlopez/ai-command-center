// Pipedrive CRM connector — syncs deals, leads, activities.
// Uses the Pipedrive REST API v1. Only polls for recent changes to stay cheap.

import { db } from "../../db/db.js";
import { vault } from "../vault.js";
import { audit } from "../audit.js";

const API_VERSION = "v1";

function getApiToken(): string {
  const token = vault.get("pipedrive_api_token");
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

export async function syncDeals(pipelineName = "New pipeline"): Promise<{ synced: number; total: number }> {
  // Get all pipelines to find the ID
  const pipelines = await pipedriveApi("pipelines");
  const pipeline = (pipelines.data ?? []).find((p: any) =>
    p.name.toLowerCase() === pipelineName.toLowerCase()
  );

  if (!pipeline) {
    throw new Error(`Pipeline "${pipelineName}" not found. Available: ${(pipelines.data ?? []).map((p: any) => p.name).join(", ")}`);
  }

  // Get deals in this pipeline
  const result = await pipedriveApi("deals", {
    pipeline_id: String(pipeline.id),
    status: "open",
    limit: "100",
    sort: "update_time DESC",
  });

  const deals = result.data ?? [];
  let synced = 0;

  const upsert = db.prepare(`
    INSERT INTO crm_deals(id, pipedrive_id, title, org_name, contact_name, contact_email, contact_phone,
      pipeline, stage, status, value, currency, created_at, updated_at, last_activity, next_activity,
      total_activities, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(pipedrive_id) DO UPDATE SET
      title=excluded.title, org_name=excluded.org_name, contact_name=excluded.contact_name,
      contact_email=excluded.contact_email, stage=excluded.stage, status=excluded.status,
      value=excluded.value, updated_at=excluded.updated_at, last_activity=excluded.last_activity,
      next_activity=excluded.next_activity, total_activities=excluded.total_activities,
      synced_at=datetime('now')
  `);

  for (const d of deals) {
    const personName = d.person_id?.name ?? "";
    const personEmail = d.person_id?.email?.[0]?.value ?? "";
    const personPhone = d.person_id?.phone?.[0]?.value ?? "";
    const orgName = d.org_id?.name ?? "";
    const stageName = d.stage_id ? await getStageNameCached(d.stage_id) : "";

    upsert.run(
      `pd-${d.id}`,
      d.id,
      d.title ?? "",
      orgName,
      personName,
      personEmail,
      personPhone,
      pipelineName,
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
  const deals = getDeals("New pipeline", "open");
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
    return Boolean(vault.get("pipedrive_api_token"));
  } catch {
    return false;
  }
}
