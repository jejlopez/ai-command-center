import { getCreds, setCreds } from "../connectors.js";
import { vault } from "../vault.js";
import { audit } from "../audit.js";
import {
  buildGoogleAuthUrl,
  exchangeAuthCode,
  refreshAccessToken as refreshOauthToken,
} from "./google_oauth.js";
import type { CalendarEvent, ConnectorStatus } from "../../../../shared/types.js";

const GCAL_API = "https://www.googleapis.com/calendar/v3";
const REDIRECT_URI = "http://127.0.0.1:8787/connectors/gcal/callback";
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

interface TokenBundle {
  access_token: string;
  expires_at: number; // ms epoch
}

let cached: TokenBundle | null = null;

function needCreds() {
  const creds = getCreds("gcal", ["client_id", "client_secret", "refresh_token"]);
  if (!creds) throw new Error("gcal not linked — missing creds in vault");
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
  audit({ actor: "system", action: "gcal.token.refresh" });
  return result.accessToken;
}

async function gcalGet<T>(path: string, query?: Record<string, string>): Promise<T> {
  const token = await getAccessToken();
  const url = new URL(`${GCAL_API}${path}`);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`gcal ${path}: ${res.status} ${t.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export function gcalStatus(): ConnectorStatus {
  if (vault.isLocked()) {
    return { id: "gcal", linked: false, available: false, lastError: "vault locked" };
  }
  const creds = getCreds("gcal", ["client_id", "client_secret", "refresh_token"]);
  return { id: "gcal", linked: creds !== null, available: creds !== null };
}

export function buildAuthUrl(): string {
  const creds = getCreds("gcal", ["client_id"]);
  if (!creds) throw new Error("set gcal.client_id in vault first");
  return buildGoogleAuthUrl({
    clientId: creds.client_id,
    redirectUri: REDIRECT_URI,
    scope: SCOPE,
  });
}

export async function exchangeCode(code: string): Promise<void> {
  const creds = getCreds("gcal", ["client_id", "client_secret"]);
  if (!creds) throw new Error("set gcal.client_id + gcal.client_secret in vault first");
  const result = await exchangeAuthCode({
    clientId: creds.client_id,
    clientSecret: creds.client_secret,
    code,
    redirectUri: REDIRECT_URI,
  });
  setCreds("gcal", { refresh_token: result.refreshToken });
  cached = {
    access_token: result.accessToken,
    expires_at: Date.now() + result.expiresIn * 1000,
  };
  audit({ actor: "user", action: "gcal.oauth.link" });
}

interface RawEvent {
  id: string;
  summary?: string;
  location?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: Array<{ email?: string }>;
}

function mapEvent(e: RawEvent): CalendarEvent {
  const startDateTime = e.start?.dateTime;
  const endDateTime = e.end?.dateTime;
  const startDate = e.start?.date;
  const endDate = e.end?.date;
  const allDay = !startDateTime && !!startDate;
  const start = startDateTime ?? (startDate ? new Date(startDate).toISOString() : "");
  const end = endDateTime ?? (endDate ? new Date(endDate).toISOString() : "");
  return {
    id: e.id,
    summary: e.summary ?? "(no title)",
    start,
    end,
    location: e.location,
    attendees: e.attendees?.map((a) => a.email).filter((x): x is string => !!x),
    htmlLink: e.htmlLink,
    allDay,
  };
}

export async function listEvents(days = 1): Promise<CalendarEvent[]> {
  const now = new Date();
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const data = await gcalGet<{ items?: RawEvent[] }>("/calendars/primary/events", {
    timeMin: now.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
  });
  const out = (data.items ?? []).map(mapEvent);
  audit({ actor: "skill:gcal", action: "gcal.list", metadata: { count: out.length, days } });
  return out;
}

export async function testCall(): Promise<void> {
  await gcalGet<unknown>("/users/me/calendarList", { maxResults: "1" });
}
