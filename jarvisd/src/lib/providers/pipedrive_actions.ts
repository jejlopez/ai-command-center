// Pipedrive CRM action provider — create deals, log activities, update stages, add contacts.
// Complements pipedrive.ts (read/sync) with write operations.

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

// GET helper
async function pipedriveGet(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const token = getApiToken();
  const domain = getDomain();
  const qs = new URLSearchParams({ api_token: token, ...params });
  const url = `https://${domain}.pipedrive.com/${API_VERSION}/${endpoint}?${qs}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pipedrive GET ${endpoint} ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// POST/PATCH helper
async function pipedriveMutate(
  method: "POST" | "PATCH" | "PUT",
  endpoint: string,
  body: Record<string, unknown>
): Promise<any> {
  const token = getApiToken();
  const domain = getDomain();
  const url = `https://${domain}.pipedrive.com/${API_VERSION}/${endpoint}?api_token=${token}`;
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pipedrive ${method} ${endpoint} ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Stage lookup — resolve stage name → stage ID
// ---------------------------------------------------------------------------

const stageIdCache = new Map<string, number>();

async function resolveStageId(stageName: string): Promise<number | undefined> {
  const key = stageName.toLowerCase();
  if (stageIdCache.has(key)) return stageIdCache.get(key)!;

  const result = await pipedriveGet("stages");
  const stages: any[] = result.data ?? [];
  for (const s of stages) {
    stageIdCache.set(s.name.toLowerCase(), s.id);
  }
  return stageIdCache.get(key);
}

// ---------------------------------------------------------------------------
// Person lookup / create — resolve org name → org ID
// ---------------------------------------------------------------------------

async function resolveOrCreatePerson(name: string, orgId?: number): Promise<number> {
  // Search first
  const search = await pipedriveGet("persons/search", { term: name, limit: "1", fields: "name" });
  const found = search.data?.items?.[0]?.item;
  if (found) return found.id as number;

  // Create
  const body: Record<string, unknown> = { name };
  if (orgId) body.org_id = orgId;
  const created = await pipedriveMutate("POST", "persons", body);
  return created.data.id as number;
}

async function resolveOrCreateOrg(orgName: string): Promise<number> {
  const search = await pipedriveGet("organizations/search", {
    term: orgName,
    limit: "1",
    fields: "name",
  });
  const found = search.data?.items?.[0]?.item;
  if (found) return found.id as number;

  const created = await pipedriveMutate("POST", "organizations", { name: orgName });
  return created.data.id as number;
}

// ---------------------------------------------------------------------------
// createDeal
// ---------------------------------------------------------------------------

export async function createDeal(opts: {
  title: string;
  value?: number;
  currency?: string;
  personName?: string;
  orgName?: string;
  stageName?: string;
}): Promise<{ dealId: number; title: string }> {
  const body: Record<string, unknown> = {
    title: opts.title,
  };

  if (opts.value !== undefined) body.value = opts.value;
  if (opts.currency) body.currency = opts.currency;

  if (opts.orgName) {
    body.org_id = await resolveOrCreateOrg(opts.orgName);
  }

  if (opts.personName) {
    body.person_id = await resolveOrCreatePerson(
      opts.personName,
      body.org_id as number | undefined
    );
  }

  if (opts.stageName) {
    const stageId = await resolveStageId(opts.stageName);
    if (stageId !== undefined) body.stage_id = stageId;
  }

  const result = await pipedriveMutate("POST", "deals", body);
  const deal = result.data;

  audit({
    actor: "crm_actions",
    action: "pipedrive.deal.create",
    subject: String(deal.id),
    metadata: { title: deal.title, value: opts.value, stage: opts.stageName },
  });

  return { dealId: deal.id as number, title: deal.title as string };
}

// ---------------------------------------------------------------------------
// updateDealStage
// ---------------------------------------------------------------------------

export async function updateDealStage(dealId: number, stageName: string): Promise<void> {
  const stageId = await resolveStageId(stageName);
  if (stageId === undefined) {
    throw new Error(`Stage "${stageName}" not found in Pipedrive`);
  }

  await pipedriveMutate("PATCH", `deals/${dealId}`, { stage_id: stageId });

  audit({
    actor: "crm_actions",
    action: "pipedrive.deal.stage_update",
    subject: String(dealId),
    metadata: { stageName, stageId },
  });
}

// ---------------------------------------------------------------------------
// logActivity
// ---------------------------------------------------------------------------

export async function logActivity(opts: {
  dealId?: number;
  type: string;
  subject: string;
  note?: string;
  done?: boolean;
  dueDate?: string;
}): Promise<{ activityId: number }> {
  const body: Record<string, unknown> = {
    type: opts.type,
    subject: opts.subject,
  };

  if (opts.dealId !== undefined) body.deal_id = opts.dealId;
  if (opts.note) body.note = opts.note;
  if (opts.done !== undefined) body.done = opts.done ? 1 : 0;
  if (opts.dueDate) body.due_date = opts.dueDate;

  const result = await pipedriveMutate("POST", "activities", body);
  const activity = result.data;

  audit({
    actor: "crm_actions",
    action: "pipedrive.activity.create",
    subject: String(activity.id),
    metadata: { type: opts.type, subject: opts.subject, dealId: opts.dealId },
  });

  return { activityId: activity.id as number };
}

// ---------------------------------------------------------------------------
// addContact
// ---------------------------------------------------------------------------

export async function addContact(opts: {
  name: string;
  email?: string;
  phone?: string;
  orgName?: string;
}): Promise<{ personId: number }> {
  const body: Record<string, unknown> = { name: opts.name };

  if (opts.email) body.email = [{ value: opts.email, primary: true }];
  if (opts.phone) body.phone = [{ value: opts.phone, primary: true }];

  if (opts.orgName) {
    body.org_id = await resolveOrCreateOrg(opts.orgName);
  }

  const result = await pipedriveMutate("POST", "persons", body);
  const person = result.data;

  audit({
    actor: "crm_actions",
    action: "pipedrive.contact.create",
    subject: String(person.id),
    metadata: { name: opts.name, email: opts.email, orgName: opts.orgName },
  });

  return { personId: person.id as number };
}

// ---------------------------------------------------------------------------
// searchDeals
// ---------------------------------------------------------------------------

export async function searchDeals(query: string): Promise<
  Array<{
    id: number;
    title: string;
    value: number;
    stage: string;
    personName: string;
  }>
> {
  const result = await pipedriveGet("deals/search", {
    term: query,
    limit: "20",
    fields: "title",
    include_fields: "deal.stage_id,deal.value,deal.person_id",
  });

  const items: any[] = result.data?.items ?? [];

  return items.map((item: any) => {
    const d = item.item;
    return {
      id: d.id as number,
      title: d.title as string,
      value: (d.value ?? 0) as number,
      stage: (d.stage?.name ?? d.stage_id ?? "") as string,
      personName: (d.person?.name ?? "") as string,
    };
  });
}
