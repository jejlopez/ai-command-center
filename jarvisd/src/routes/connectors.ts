import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { setCreds, vaultKey } from "../lib/connectors.js";
import { vault } from "../lib/vault.js";
import { audit } from "../lib/audit.js";
import {
  buildAuthUrl as gmailBuildAuthUrl,
  exchangeCode as gmailExchangeCode,
  gmailStatus,
  refreshAccessToken as gmailRefreshAccessToken,
} from "../lib/providers/gmail.js";
import {
  buildAuthUrl as gcalBuildAuthUrl,
  exchangeCode as gcalExchangeCode,
  gcalStatus,
  listEvents as gcalListEvents,
  getAccessToken as gcalGetAccessToken,
} from "../lib/providers/gcal.js";
import {
  buildAuthUrl as driveBuildAuthUrl,
  exchangeCode as driveExchangeCode,
  driveStatus,
  searchFiles as driveSearchFiles,
  getAccessToken as driveGetAccessToken,
} from "../lib/providers/drive.js";
import {
  setSharedCreds as setUnifiedCreds,
  buildUnifiedAuthUrl,
  exchangeUnifiedCode,
  unlinkAll as unlinkUnifiedAll,
  status as unifiedStatus,
} from "../lib/providers/google_unified.js";
import { summarizeInbox } from "../skills/inbox_summary.js";
import type {
  ConnectorId,
  ConnectorStatus,
  ConnectorsStatus,
} from "../../../shared/types.js";

const ConnectorCredsBody = z.object({
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
});

const VALID_IDS: ConnectorId[] = ["gmail", "gcal", "drive"];

function isConnectorId(id: string): id is ConnectorId {
  return (VALID_IDS as string[]).includes(id);
}

// gmail.ts's local gmailStatus returns a looser shape ({id, linked, error?}).
// Normalize it to the shared ConnectorStatus contract.
function gmailStatusShared(): ConnectorStatus {
  const raw = gmailStatus() as { id: "gmail"; linked: boolean; error?: string };
  return {
    id: "gmail",
    linked: raw.linked,
    available: raw.linked && !raw.error,
    lastError: raw.error,
  };
}

function allStatus(): ConnectorsStatus {
  return {
    gmail: gmailStatusShared(),
    gcal: gcalStatus(),
    drive: driveStatus(),
  };
}

function rejectBadId(id: string, reply: FastifyReply): boolean {
  if (!isConnectorId(id)) {
    reply.code(400);
    return true;
  }
  return false;
}

function buildAuthUrlFor(id: ConnectorId): string {
  switch (id) {
    case "gmail":
      return gmailBuildAuthUrl();
    case "gcal":
      return gcalBuildAuthUrl();
    case "drive":
      return driveBuildAuthUrl();
  }
}

async function exchangeCodeFor(id: ConnectorId, code: string): Promise<void> {
  switch (id) {
    case "gmail":
      return gmailExchangeCode(code);
    case "gcal":
      return gcalExchangeCode(code);
    case "drive":
      return driveExchangeCode(code);
  }
}

async function getAccessTokenFor(id: ConnectorId): Promise<string> {
  switch (id) {
    case "gmail":
      return gmailRefreshAccessToken();
    case "gcal":
      return gcalGetAccessToken();
    case "drive":
      return driveGetAccessToken();
  }
}

interface TestEndpoint {
  url: string;
}

function testEndpointFor(id: ConnectorId): TestEndpoint {
  switch (id) {
    case "gmail":
      return { url: "https://gmail.googleapis.com/gmail/v1/users/me/profile" };
    case "gcal":
      return { url: "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1" };
    case "drive":
      return { url: "https://www.googleapis.com/drive/v3/about?fields=user" };
  }
}

function successHtml(id: ConnectorId): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${id} linked</title><style>body{font-family:-apple-system,system-ui,sans-serif;background:#0b0d10;color:#e6e8eb;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}.card{padding:32px 40px;background:#12151a;border:1px solid #232830;border-radius:12px;max-width:420px;text-align:center}h1{margin:0 0 8px;font-size:18px;font-weight:600}p{margin:0;color:#98a2b3;font-size:14px}</style></head><body><div class="card"><h1>${id} linked</h1><p>You can close this tab and return to JARVIS.</p></div></body></html>`;
}

function isLinked(id: ConnectorId): boolean {
  const s = allStatus()[id];
  return s.linked;
}

export async function connectorRoutes(app: FastifyInstance): Promise<void> {
  // ---- Unified status ------------------------------------------------------
  app.get("/connectors", async (_req, reply): Promise<ConnectorsStatus | { error: string }> => {
    if (vault.isLocked()) {
      reply.code(423);
      return { error: "vault locked" };
    }
    return allStatus();
  });

  // ---- Creds ---------------------------------------------------------------
  app.post("/connectors/:id/creds", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (rejectBadId(id, reply)) return { error: `invalid connector id: ${id}` };
    if (vault.isLocked()) {
      reply.code(423);
      return { error: "vault locked" };
    }
    const parsed = ConnectorCredsBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.message };
    }
    setCreds(id as ConnectorId, parsed.data);
    try {
      const authUrl = buildAuthUrlFor(id as ConnectorId);
      return { ok: true, authUrl };
    } catch (err: any) {
      reply.code(500);
      return { error: err.message };
    }
  });

  // ---- Start OAuth (302 redirect) ------------------------------------------
  app.get("/connectors/:id/start", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (rejectBadId(id, reply)) return { error: `invalid connector id: ${id}` };
    if (vault.isLocked()) {
      reply.code(423);
      return { error: "vault locked" };
    }
    try {
      const url = buildAuthUrlFor(id as ConnectorId);
      reply.redirect(url);
    } catch (err: any) {
      reply.code(400);
      return { error: err.message };
    }
  });

  // ---- OAuth callback ------------------------------------------------------
  // Note: callback must work without an explicit unlocked check — user hits it
  // from a browser redirect. But the underlying exchangeCode needs vault to
  // store the refresh_token. If vault is locked we surface a friendly error.
  app.get("/connectors/:id/callback", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (rejectBadId(id, reply)) return { error: `invalid connector id: ${id}` };
    const code = (req.query as any)?.code;
    const oauthErr = (req.query as any)?.error;
    if (oauthErr) {
      reply.code(400);
      return { error: `google oauth error: ${oauthErr}` };
    }
    if (!code) {
      reply.code(400);
      return { error: "missing code" };
    }
    try {
      await exchangeCodeFor(id as ConnectorId, code);
      reply.type("text/html").send(successHtml(id as ConnectorId));
    } catch (err: any) {
      reply.code(500).type("text/html").send(
        `<!doctype html><html><body style="font-family:system-ui;padding:32px"><h1>${id} link failed</h1><pre>${String(err.message).replace(/[<>]/g, "")}</pre></body></html>`
      );
    }
  });

  // ---- Unlink --------------------------------------------------------------
  app.post("/connectors/:id/unlink", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (rejectBadId(id, reply)) return { error: `invalid connector id: ${id}` };
    if (vault.isLocked()) {
      reply.code(423);
      return { error: "vault locked" };
    }
    vault.delete(vaultKey(id as ConnectorId, "refresh_token"));
    audit({ actor: "user", action: "connector.unlink", subject: id });
    return { ok: true };
  });

  // ---- Test ----------------------------------------------------------------
  app.post("/connectors/:id/test", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (rejectBadId(id, reply)) return { error: `invalid connector id: ${id}` };
    if (vault.isLocked()) {
      reply.code(423);
      return { error: "vault locked" };
    }
    if (!isLinked(id as ConnectorId)) {
      // Return 200 with ok:false so callers can render the failure inline
      // (matches /providers/:id/test semantics).
      return { ok: false, latencyMs: 0, error: `${id} not linked` };
    }
    const started = Date.now();
    try {
      const token = await getAccessTokenFor(id as ConnectorId);
      const { url } = testEndpointFor(id as ConnectorId);
      const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`${res.status} ${t.slice(0, 160)}`);
      }
      const latencyMs = Date.now() - started;
      audit({ actor: "user", action: "connector.test", subject: id, metadata: { ok: true, latencyMs } });
      return { ok: true, latencyMs };
    } catch (err: any) {
      const latencyMs = Date.now() - started;
      audit({
        actor: "user",
        action: "connector.test.fail",
        subject: id,
        reason: err.message,
        metadata: { latencyMs },
      });
      return { ok: false, latencyMs, error: err.message };
    }
  });

  // ---- gcal events ---------------------------------------------------------
  app.get("/connectors/gcal/events", async (req, reply) => {
    if (vault.isLocked()) {
      reply.code(423);
      return { error: "vault locked" };
    }
    if (!isLinked("gcal")) {
      reply.code(400);
      return { error: "gcal not linked" };
    }
    const daysRaw = (req.query as any)?.days;
    const days = Math.min(Math.max(Number(daysRaw ?? 1) || 1, 1), 30);
    try {
      return await gcalListEvents(days);
    } catch (err: any) {
      reply.code(500);
      return { error: err.message };
    }
  });

  // ---- drive search --------------------------------------------------------
  app.get("/connectors/drive/search", async (req, reply) => {
    if (vault.isLocked()) {
      reply.code(423);
      return { error: "vault locked" };
    }
    if (!isLinked("drive")) {
      reply.code(400);
      return { error: "drive not linked" };
    }
    const q = String((req.query as any)?.q ?? "").trim();
    if (!q) {
      reply.code(400);
      return { error: "missing q param" };
    }
    try {
      return await driveSearchFiles(q, 20);
    } catch (err: any) {
      reply.code(500);
      return { error: err.message };
    }
  });

  // ---- Preserved: gmail inbox summarize skill ------------------------------
  app.post("/connectors/gmail/summarize", async (req, reply) => {
    try {
      const max = Number((req.body as any)?.max ?? 10);
      return await summarizeInbox(max);
    } catch (err: any) {
      reply.code(500);
      return { error: err.message };
    }
  });

  // ---- Unified Google OAuth (one sign-in = Gmail + GCal + Drive) ----------

  app.get("/connectors/google/unified/status", async () => unifiedStatus());

  app.post("/connectors/google/unified/creds", async (req, reply) => {
    if (vault.isLocked()) {
      reply.code(423);
      return { error: "vault locked" };
    }
    const parsed = ConnectorCredsBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.message };
    }
    setUnifiedCreds(parsed.data.client_id, parsed.data.client_secret);
    try {
      return { ok: true, authUrl: buildUnifiedAuthUrl() };
    } catch (err: any) {
      reply.code(500);
      return { error: err.message };
    }
  });

  app.get("/connectors/google/unified/start", async (_req, reply) => {
    if (vault.isLocked()) {
      reply.code(423);
      return { error: "vault locked" };
    }
    try {
      reply.redirect(buildUnifiedAuthUrl());
    } catch (err: any) {
      reply.code(400);
      return { error: err.message };
    }
  });

  app.get("/connectors/google/unified/callback", async (req, reply) => {
    const code = (req.query as any)?.code;
    const oauthErr = (req.query as any)?.error;
    if (oauthErr) {
      reply.code(400);
      return { error: `google oauth error: ${oauthErr}` };
    }
    if (!code) {
      reply.code(400);
      return { error: "missing code" };
    }
    try {
      await exchangeUnifiedCode(code);
      reply
        .type("text/html")
        .send(
          `<!doctype html><html><head><meta charset="utf-8"><title>Google linked</title><style>body{font-family:-apple-system,system-ui,sans-serif;background:#0b0d10;color:#e6e8eb;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}.card{padding:32px 40px;background:#12151a;border:1px solid #232830;border-radius:12px;max-width:460px;text-align:center}h1{margin:0 0 8px;font-size:18px;font-weight:600;color:#5de8ff}p{margin:0;color:#98a2b3;font-size:14px}.ok{color:#4ade80;font-size:13px;margin-top:12px}</style></head><body><div class="card"><h1>Google linked</h1><p>Gmail, Calendar, and Drive are now connected.</p><div class="ok">✓ You can close this tab and return to JARVIS.</div></div></body></html>`
        );
    } catch (err: any) {
      reply
        .code(500)
        .type("text/html")
        .send(
          `<!doctype html><html><body style="font-family:system-ui;padding:32px"><h1>Google link failed</h1><pre>${String(err.message).replace(/[<>]/g, "")}</pre></body></html>`
        );
    }
  });

  app.post("/connectors/google/unified/unlink", async (_req, reply) => {
    if (vault.isLocked()) {
      reply.code(423);
      return { error: "vault locked" };
    }
    try {
      unlinkUnifiedAll();
      return { ok: true };
    } catch (err: any) {
      reply.code(500);
      return { error: err.message };
    }
  });
}
