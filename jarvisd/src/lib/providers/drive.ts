import { getCreds, setCreds } from "../connectors.js";
import { vault } from "../vault.js";
import { audit } from "../audit.js";
import {
  buildGoogleAuthUrl,
  exchangeAuthCode,
  refreshAccessToken as refreshOauthToken,
} from "./google_oauth.js";
import type { ConnectorStatus, DriveFile } from "../../../../shared/types.js";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const REDIRECT_URI = "http://127.0.0.1:8787/connectors/drive/callback";
const SCOPE = "https://www.googleapis.com/auth/drive.readonly";

interface TokenBundle {
  access_token: string;
  expires_at: number;
}

let cached: TokenBundle | null = null;

function needCreds() {
  const creds = getCreds("drive", ["client_id", "client_secret", "refresh_token"]);
  if (!creds) throw new Error("drive not linked — missing creds in vault");
  return creds;
}

export async function getAccessToken(): Promise<string> {
  if (cached && cached.expires_at > Date.now() + 30_000) return cached.access_token;
  const creds = needCreds();
  const result = await refreshOauthToken({
    clientId: creds.client_id,
    clientSecret: creds.client_secret,
    refreshToken: creds.refresh_token,
  });
  cached = {
    access_token: result.accessToken,
    expires_at: Date.now() + result.expiresIn * 1000,
  };
  audit({ actor: "system", action: "drive.token.refresh" });
  return result.accessToken;
}

async function driveGet<T>(path: string, query?: Record<string, string>): Promise<T> {
  const token = await getAccessToken();
  const url = new URL(`${DRIVE_API}${path}`);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`drive ${path}: ${res.status} ${t.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export function driveStatus(): ConnectorStatus {
  if (vault.isLocked()) {
    return { id: "drive", linked: false, available: false, lastError: "vault locked" };
  }
  const creds = getCreds("drive", ["client_id", "client_secret", "refresh_token"]);
  return { id: "drive", linked: creds !== null, available: creds !== null };
}

export function buildAuthUrl(): string {
  const creds = getCreds("drive", ["client_id"]);
  if (!creds) throw new Error("set drive.client_id in vault first");
  return buildGoogleAuthUrl({
    clientId: creds.client_id,
    redirectUri: REDIRECT_URI,
    scope: SCOPE,
  });
}

export async function exchangeCode(code: string): Promise<void> {
  const creds = getCreds("drive", ["client_id", "client_secret"]);
  if (!creds) throw new Error("set drive.client_id + drive.client_secret in vault first");
  const result = await exchangeAuthCode({
    clientId: creds.client_id,
    clientSecret: creds.client_secret,
    code,
    redirectUri: REDIRECT_URI,
  });
  setCreds("drive", { refresh_token: result.refreshToken });
  cached = {
    access_token: result.accessToken,
    expires_at: Date.now() + result.expiresIn * 1000,
  };
  audit({ actor: "user", action: "drive.oauth.link" });
}

interface RawFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  modifiedTime?: string;
  iconLink?: string;
}

export async function searchFiles(query: string, limit = 20): Promise<DriveFile[]> {
  // escape single quotes per Drive v3 query syntax
  const safe = query.replace(/'/g, "\\'");
  const data = await driveGet<{ files?: RawFile[] }>("/files", {
    q: `fullText contains '${safe}'`,
    pageSize: String(Math.min(Math.max(limit, 1), 100)),
    fields: "files(id,name,mimeType,webViewLink,modifiedTime,iconLink)",
  });
  const out: DriveFile[] = (data.files ?? []).slice(0, limit).map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    webViewLink: f.webViewLink,
    modifiedTime: f.modifiedTime,
    iconLink: f.iconLink,
  }));
  audit({
    actor: "skill:drive",
    action: "drive.search",
    metadata: { count: out.length, query: query.slice(0, 80) },
  });
  return out;
}

export async function testCall(): Promise<void> {
  await driveGet<unknown>("/about", { fields: "user" });
}
