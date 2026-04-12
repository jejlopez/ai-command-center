import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { vault } from "../lib/vault.js";
import { audit } from "../lib/audit.js";
import {
  providerRegistry,
  detectOllama,
  CLOUD_PROVIDER_IDS,
  isGoogleLinked,
  googleAuthMode,
} from "../lib/providers/registry.js";
import {
  setCreds as setGoogleOAuthCreds,
  buildAuthUrl as buildGoogleAuthUrl,
  exchangeCode as exchangeGoogleCode,
  unlink as unlinkGoogleOAuth,
  isLinkedViaOAuth as googleIsLinkedViaOAuth,
} from "../lib/providers/google_provider_oauth.js";
import type {
  ProviderId,
  ProviderStatus,
  ProviderTestResult,
} from "../../../shared/types.js";

const PROVIDER_IDS: ProviderId[] = ["anthropic", "openai", "google", "groq", "ollama", "claude-code", "pandadoc", "pipedrive"];

function isProviderId(id: string): id is ProviderId {
  return (PROVIDER_IDS as string[]).includes(id);
}

const KeyBody = z.object({ key: z.string().min(1) });

export async function providersRoutes(app: FastifyInstance): Promise<void> {
  app.get("/providers", async (_req, reply): Promise<ProviderStatus[] | { error: string }> => {
    if (vault.isLocked()) {
      reply.code(423);
      return { error: "vault locked" };
    }

    const out: ProviderStatus[] = [];

    for (const id of CLOUD_PROVIDER_IDS) {
      if (id === "google") {
        const linked = isGoogleLinked();
        out.push({
          id,
          linked,
          available: linked,
          authMode: googleAuthMode(),
        });
        continue;
      }
      const entry = providerRegistry[id];
      const linked = vault.get(entry.vaultKey) !== null;
      out.push({
        id,
        linked,
        available: linked,
        authMode: linked ? "api_key" : undefined,
      });
    }

    const ollama = await detectOllama();
    out.push({
      id: "ollama",
      linked: ollama.up,
      available: ollama.up,
      models: ollama.models,
    });

    return out;
  });

  app.get("/providers/local/detect", async () => {
    return detectOllama();
  });

  app.post<{ Params: { id: string } }>("/providers/:id/key", async (req, reply) => {
    if (vault.isLocked()) {
      reply.code(423);
      return { error: "vault locked" };
    }
    const { id } = req.params;
    if (!isProviderId(id)) {
      reply.code(404);
      return { error: "unknown provider" };
    }
    if (id === "ollama") {
      reply.code(400);
      return { error: "local provider has no key" };
    }
    const parsed = KeyBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.issues };
    }
    const entry = providerRegistry[id];
    vault.set(entry.vaultKey, parsed.data.key);
    audit({ actor: "user", action: "provider.key.set", subject: id });
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>("/providers/:id/key", async (req, reply) => {
    if (vault.isLocked()) {
      reply.code(423);
      return { error: "vault locked" };
    }
    const { id } = req.params;
    if (!isProviderId(id)) {
      reply.code(404);
      return { error: "unknown provider" };
    }
    if (id === "ollama") {
      reply.code(400);
      return { error: "local provider has no key" };
    }
    const entry = providerRegistry[id];
    vault.delete(entry.vaultKey);
    audit({ actor: "user", action: "provider.key.delete", subject: id });
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/providers/:id/test", async (req, reply): Promise<ProviderTestResult | { error: string }> => {
    if (vault.isLocked()) {
      reply.code(423);
      return { error: "vault locked" };
    }
    const { id } = req.params;
    if (!isProviderId(id)) {
      reply.code(404);
      return { error: "unknown provider" };
    }
    const entry = providerRegistry[id];
    if (entry.kind === "cloud") {
      // Google counts as "has creds" if either api_key or oauth refresh_token.
      const hasCreds =
        id === "google"
          ? isGoogleLinked()
          : vault.get(entry.vaultKey) !== null;
      if (!hasCreds) {
        reply.code(400);
        return { error: "no key or oauth link set for provider" };
      }
    }
    const result = await entry.testFn();
    audit({
      actor: "user",
      action: "provider.test",
      subject: id,
      metadata: { ok: result.ok, latencyMs: result.latencyMs, error: result.error },
    });
    return result;
  });

  // ------------------- Google provider OAuth flow --------------------------

  const OAuthCreds = z.object({
    client_id: z.string().min(1),
    client_secret: z.string().min(1),
  });

  app.post("/providers/google/oauth/creds", async (req, reply) => {
    if (vault.isLocked()) {
      reply.code(423);
      return { error: "vault locked" };
    }
    const parsed = OAuthCreds.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.message };
    }
    setGoogleOAuthCreds(parsed.data.client_id, parsed.data.client_secret);
    try {
      return { ok: true, authUrl: buildGoogleAuthUrl() };
    } catch (err: any) {
      reply.code(500);
      return { error: err.message };
    }
  });

  app.get("/providers/google/oauth/start", async (_req, reply) => {
    if (vault.isLocked()) {
      reply.code(423);
      return { error: "vault locked" };
    }
    try {
      reply.redirect(buildGoogleAuthUrl());
    } catch (err: any) {
      reply.code(400);
      return { error: err.message };
    }
  });

  app.get("/providers/google/oauth/callback", async (req, reply) => {
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
      await exchangeGoogleCode(code);
      reply
        .type("text/html")
        .send(
          `<!doctype html><html><head><meta charset="utf-8"><title>Google linked</title><style>body{font-family:-apple-system,system-ui,sans-serif;background:#0b0d10;color:#e6e8eb;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}.card{padding:32px 40px;background:#12151a;border:1px solid #232830;border-radius:12px;max-width:420px;text-align:center}h1{margin:0 0 8px;font-size:18px;font-weight:600}p{margin:0;color:#98a2b3;font-size:14px}</style></head><body><div class="card"><h1>Google linked</h1><p>You can close this tab and return to JARVIS.</p></div></body></html>`
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

  app.post("/providers/google/oauth/unlink", async (_req, reply) => {
    if (vault.isLocked()) {
      reply.code(423);
      return { error: "vault locked" };
    }
    try {
      unlinkGoogleOAuth();
      return { ok: true, stillLinked: googleIsLinkedViaOAuth() };
    } catch (err: any) {
      reply.code(500);
      return { error: err.message };
    }
  });
}
