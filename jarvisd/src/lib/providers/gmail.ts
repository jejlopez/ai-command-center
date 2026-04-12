import { getCreds, setCreds, type ConnectorStatus } from "../connectors.js";
import { vault } from "../vault.js";
import { audit } from "../audit.js";

const GOOGLE_OAUTH_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";

interface TokenBundle {
  access_token: string;
  expires_at: number; // ms epoch
}

let cached: TokenBundle | null = null;

function needCreds() {
  const creds = getCreds("gmail", ["client_id", "client_secret", "refresh_token"]);
  if (!creds) throw new Error("gmail not linked — missing creds in vault");
  return creds;
}

export async function refreshAccessToken(): Promise<string> {
  if (cached && cached.expires_at > Date.now() + 30_000) return cached.access_token;

  const creds = needCreds();
  const body = new URLSearchParams({
    client_id: creds.client_id,
    client_secret: creds.client_secret,
    refresh_token: creds.refresh_token,
    grant_type: "refresh_token",
  });

  const res = await fetch(GOOGLE_OAUTH_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`gmail token refresh failed: ${res.status} ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
  audit({ actor: "system", action: "gmail.token.refresh" });
  return data.access_token;
}

async function gmailGet<T>(path: string, query?: Record<string, string>): Promise<T> {
  const token = await refreshAccessToken();
  const url = new URL(`${GMAIL_API}${path}`);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`gmail ${path}: ${res.status} ${t.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export interface GmailMessageMeta {
  id: string;
  threadId: string;
  snippet: string;
  from?: string;
  subject?: string;
  date?: string;
}

function headerValue(headers: Array<{ name: string; value: string }>, name: string): string | undefined {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
}

export async function listRecentMessages(maxResults = 10, query = "in:inbox -category:promotions"): Promise<GmailMessageMeta[]> {
  const list = await gmailGet<{ messages?: Array<{ id: string; threadId: string }> }>(
    "/users/me/messages",
    { maxResults: String(maxResults), q: query }
  );
  const out: GmailMessageMeta[] = [];
  for (const m of list.messages ?? []) {
    const detail = await gmailGet<{
      id: string;
      threadId: string;
      snippet: string;
      payload: { headers: Array<{ name: string; value: string }> };
    }>(`/users/me/messages/${m.id}`, { format: "metadata", metadataHeaders: "From,Subject,Date" });
    out.push({
      id: detail.id,
      threadId: detail.threadId,
      snippet: detail.snippet,
      from: headerValue(detail.payload.headers, "From"),
      subject: headerValue(detail.payload.headers, "Subject"),
      date: headerValue(detail.payload.headers, "Date"),
    });
  }
  audit({ actor: "skill:gmail", action: "gmail.list", metadata: { count: out.length } });
  return out;
}

export function gmailStatus(): ConnectorStatus {
  if (vault.isLocked()) return { id: "gmail", linked: false, error: "vault locked" };
  const creds = getCreds("gmail", ["client_id", "client_secret", "refresh_token"]);
  return { id: "gmail", linked: creds !== null };
}

// OAuth — device/offline flow URL. User runs through browser, pastes back the code.
export function buildAuthUrl(): string {
  const creds = getCreds("gmail", ["client_id"]);
  if (!creds) throw new Error("set gmail.client_id in vault first");
  const params = new URLSearchParams({
    client_id: creds.client_id,
    redirect_uri: "http://127.0.0.1:8787/connectors/gmail/callback",
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.readonly",
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<void> {
  const creds = getCreds("gmail", ["client_id", "client_secret"]);
  if (!creds) throw new Error("set gmail.client_id + gmail.client_secret in vault first");
  const body = new URLSearchParams({
    code,
    client_id: creds.client_id,
    client_secret: creds.client_secret,
    redirect_uri: "http://127.0.0.1:8787/connectors/gmail/callback",
    grant_type: "authorization_code",
  });
  const res = await fetch(GOOGLE_OAUTH_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`oauth exchange failed: ${res.status} ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as { refresh_token?: string; access_token: string; expires_in: number };
  if (!data.refresh_token) throw new Error("no refresh_token returned — revoke and retry with prompt=consent");
  setCreds("gmail", { refresh_token: data.refresh_token });
  cached = { access_token: data.access_token, expires_at: Date.now() + data.expires_in * 1000 };
  audit({ actor: "user", action: "gmail.oauth.link" });
}
