// Unified Google data-connector OAuth: one sign-in grants Gmail + Calendar +
// Drive read access simultaneously. The resulting refresh token is stored
// under each per-connector key so the existing gmail.ts / gcal.ts / drive.ts
// adapters keep working without changes.

import { vault } from "../vault.js";
import { audit } from "./../audit.js";
import { exchangeAuthCode, buildGoogleAuthUrl } from "./google_oauth.js";

const REDIRECT_URI = "http://127.0.0.1:8787/connectors/google/unified/callback";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
].join(" ");

function creds() {
  if (vault.isLocked()) throw new Error("vault locked");
  const client_id = vault.get("google.connectors.client_id");
  const client_secret = vault.get("google.connectors.client_secret");
  if (!client_id || !client_secret) {
    throw new Error("google connector creds not set");
  }
  return { client_id, client_secret };
}

// Stores the shared client_id/secret AND also mirrors them into each
// per-connector slot so the existing adapters (which read e.g. gmail.client_id)
// continue to work transparently.
export function setSharedCreds(client_id: string, client_secret: string): void {
  if (vault.isLocked()) throw new Error("vault locked");
  vault.set("google.connectors.client_id", client_id);
  vault.set("google.connectors.client_secret", client_secret);

  vault.set("gmail.client_id", client_id);
  vault.set("gmail.client_secret", client_secret);
  vault.set("gcal.client_id", client_id);
  vault.set("gcal.client_secret", client_secret);
  vault.set("drive.client_id", client_id);
  vault.set("drive.client_secret", client_secret);

  audit({ actor: "user", action: "google.unified.creds.set" });
}

export function buildUnifiedAuthUrl(): string {
  const { client_id } = creds();
  return buildGoogleAuthUrl({
    clientId: client_id,
    redirectUri: REDIRECT_URI,
    scope: SCOPES,
  });
}

export async function exchangeUnifiedCode(code: string): Promise<void> {
  const { client_id, client_secret } = creds();
  const result = await exchangeAuthCode({
    clientId: client_id,
    clientSecret: client_secret,
    code,
    redirectUri: REDIRECT_URI,
  });

  // Mirror the single refresh_token into each per-connector slot.
  vault.set("gmail.refresh_token", result.refreshToken);
  vault.set("gcal.refresh_token", result.refreshToken);
  vault.set("drive.refresh_token", result.refreshToken);

  audit({
    actor: "user",
    action: "google.unified.link",
    metadata: { gmail: true, gcal: true, drive: true },
  });
}

export function unlinkAll(): void {
  if (vault.isLocked()) throw new Error("vault locked");
  vault.delete("gmail.refresh_token");
  vault.delete("gcal.refresh_token");
  vault.delete("drive.refresh_token");
  audit({ actor: "user", action: "google.unified.unlink" });
}

export function status(): { credsSet: boolean; linked: boolean } {
  if (vault.isLocked()) return { credsSet: false, linked: false };
  const credsSet =
    vault.get("google.connectors.client_id") !== null &&
    vault.get("google.connectors.client_secret") !== null;
  const linked =
    vault.get("gmail.refresh_token") !== null ||
    vault.get("gcal.refresh_token") !== null ||
    vault.get("drive.refresh_token") !== null;
  return { credsSet, linked };
}

export const GOOGLE_UNIFIED_REDIRECT = REDIRECT_URI;
