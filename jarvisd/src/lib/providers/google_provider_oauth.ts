// Google provider OAuth — lets the user "Sign in with Google" to authorize
// Gemini access instead of pasting an API key. Scope: cloud-platform, which
// covers both Generative Language and Vertex AI endpoints.
//
// Vault layout:
//   google.oauth_client_id
//   google.oauth_client_secret
//   google.oauth_refresh_token
//
// This is INTENTIONALLY kept separate from the per-connector (gmail/gcal/drive)
// credentials so the user can use a different OAuth client if they want, and
// so unlinking the Google provider doesn't affect the data connectors.

import { vault } from "../vault.js";
import { audit } from "./../audit.js";
import { exchangeAuthCode, refreshAccessToken, buildGoogleAuthUrl } from "./google_oauth.js";

const REDIRECT_URI = "http://127.0.0.1:8787/providers/google/oauth/callback";
const SCOPE = "https://www.googleapis.com/auth/cloud-platform";

function needsCreds() {
  if (vault.isLocked()) throw new Error("vault locked");
  const client_id = vault.get("google.oauth_client_id");
  const client_secret = vault.get("google.oauth_client_secret");
  if (!client_id || !client_secret) {
    throw new Error("google oauth client creds not set");
  }
  return { client_id, client_secret };
}

export function setCreds(client_id: string, client_secret: string): void {
  if (vault.isLocked()) throw new Error("vault locked");
  vault.set("google.oauth_client_id", client_id);
  vault.set("google.oauth_client_secret", client_secret);
  audit({ actor: "user", action: "google.oauth.creds.set" });
}

export function buildAuthUrl(): string {
  const { client_id } = needsCreds();
  return buildGoogleAuthUrl({ clientId: client_id, redirectUri: REDIRECT_URI, scope: SCOPE });
}

export async function exchangeCode(code: string): Promise<void> {
  const { client_id, client_secret } = needsCreds();
  const res = await exchangeAuthCode({
    clientId: client_id,
    clientSecret: client_secret,
    code,
    redirectUri: REDIRECT_URI,
  });
  vault.set("google.oauth_refresh_token", res.refreshToken);
  audit({ actor: "user", action: "google.oauth.link" });
}

export function unlink(): void {
  if (vault.isLocked()) throw new Error("vault locked");
  vault.delete("google.oauth_refresh_token");
  audit({ actor: "user", action: "google.oauth.unlink" });
}

export function isLinkedViaOAuth(): boolean {
  if (vault.isLocked()) return false;
  return vault.get("google.oauth_refresh_token") !== null;
}

// Proof-of-life: exchange the refresh_token for a fresh access token.
// Later slices will plug this into an actual Gemini inference call.
export async function testOAuth(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const started = Date.now();
  try {
    if (vault.isLocked()) return { ok: false, latencyMs: 0, error: "vault locked" };
    const client_id = vault.get("google.oauth_client_id");
    const client_secret = vault.get("google.oauth_client_secret");
    const refresh_token = vault.get("google.oauth_refresh_token");
    if (!client_id || !client_secret || !refresh_token) {
      return { ok: false, latencyMs: 0, error: "not linked via oauth" };
    }
    await refreshAccessToken({
      clientId: client_id,
      clientSecret: client_secret,
      refreshToken: refresh_token,
    });
    return { ok: true, latencyMs: Date.now() - started };
  } catch (err: any) {
    return { ok: false, latencyMs: Date.now() - started, error: err?.message ?? String(err) };
  }
}

export const GOOGLE_OAUTH_REDIRECT = REDIRECT_URI;
