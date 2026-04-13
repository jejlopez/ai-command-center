// Google Calendar write actions — create, update, delete events, find free slots.
//
// NOTE: The current OAuth scope is `calendar.readonly`. These write operations
// require upgrading to `https://www.googleapis.com/auth/calendar.events` scope.
// Update the SCOPE constant in gcal.ts and re-link the connector to enable writes.

import { getAccessToken } from "./gcal.js";
import { audit } from "../audit.js";

const GCAL_API = "https://www.googleapis.com/calendar/v3";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function gcalRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  query?: Record<string, string>,
): Promise<T> {
  const token = await getAccessToken();
  const url = new URL(`${GCAL_API}${path}`);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`gcal ${method} ${path}: ${res.status} ${t.slice(0, 200)}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

interface RawEventResponse {
  id: string;
  htmlLink?: string;
}

interface FreeBusyResponse {
  calendars?: {
    primary?: {
      busy?: Array<{ start: string; end: string }>;
    };
  };
}

// ---------------------------------------------------------------------------
// createEvent
// ---------------------------------------------------------------------------

export async function createEvent(opts: {
  summary: string;
  start: string;       // ISO datetime
  end: string;         // ISO datetime
  description?: string;
  location?: string;
  attendees?: string[]; // email addresses
}): Promise<{ eventId: string; htmlLink: string }> {
  const body: Record<string, unknown> = {
    summary: opts.summary,
    start: { dateTime: opts.start },
    end: { dateTime: opts.end },
  };
  if (opts.description) body.description = opts.description;
  if (opts.location) body.location = opts.location;
  if (opts.attendees?.length) {
    body.attendees = opts.attendees.map((email) => ({ email }));
  }

  const data = await gcalRequest<RawEventResponse>(
    "POST",
    "/calendars/primary/events",
    body,
  );

  audit({
    actor: "skill:gcal",
    action: "gcal.event.create",
    metadata: { eventId: data.id, summary: opts.summary },
  });

  return { eventId: data.id, htmlLink: data.htmlLink ?? "" };
}

// ---------------------------------------------------------------------------
// updateEvent
// ---------------------------------------------------------------------------

export async function updateEvent(
  eventId: string,
  updates: {
    summary?: string;
    start?: string;
    end?: string;
    description?: string;
    location?: string;
  },
): Promise<{ eventId: string; htmlLink: string }> {
  const body: Record<string, unknown> = {};
  if (updates.summary !== undefined) body.summary = updates.summary;
  if (updates.description !== undefined) body.description = updates.description;
  if (updates.location !== undefined) body.location = updates.location;
  if (updates.start !== undefined) body.start = { dateTime: updates.start };
  if (updates.end !== undefined) body.end = { dateTime: updates.end };

  const data = await gcalRequest<RawEventResponse>(
    "PATCH",
    `/calendars/primary/events/${eventId}`,
    body,
  );

  audit({
    actor: "skill:gcal",
    action: "gcal.event.update",
    metadata: { eventId, updates: Object.keys(updates) },
  });

  return { eventId: data.id, htmlLink: data.htmlLink ?? "" };
}

// ---------------------------------------------------------------------------
// deleteEvent
// ---------------------------------------------------------------------------

export async function deleteEvent(eventId: string): Promise<void> {
  await gcalRequest<void>("DELETE", `/calendars/primary/events/${eventId}`);

  audit({
    actor: "skill:gcal",
    action: "gcal.event.delete",
    metadata: { eventId },
  });
}

// ---------------------------------------------------------------------------
// findFreeSlots
// ---------------------------------------------------------------------------

export async function findFreeSlots(opts: {
  durationMinutes: number;
  startDate: string; // ISO date e.g. "2026-04-13"
  endDate: string;   // ISO date e.g. "2026-04-14"
}): Promise<Array<{ start: string; end: string }>> {
  const timeMin = new Date(`${opts.startDate}T00:00:00`).toISOString();
  const timeMax = new Date(`${opts.endDate}T23:59:59`).toISOString();

  const freeBusy = await gcalRequest<FreeBusyResponse>(
    "POST",
    "/freeBusy",
    {
      timeMin,
      timeMax,
      items: [{ id: "primary" }],
    },
  );

  const busy = freeBusy.calendars?.primary?.busy ?? [];
  const durationMs = opts.durationMinutes * 60 * 1000;
  const slots: Array<{ start: string; end: string }> = [];

  // Walk the window hour by hour (08:00–18:00 each day) finding gaps
  const windowStart = new Date(`${opts.startDate}T08:00:00`).getTime();
  const windowEnd = new Date(`${opts.endDate}T18:00:00`).getTime();

  let cursor = windowStart;
  while (cursor + durationMs <= windowEnd) {
    const slotEnd = cursor + durationMs;
    const conflict = busy.some((b) => {
      const bs = new Date(b.start).getTime();
      const be = new Date(b.end).getTime();
      return cursor < be && slotEnd > bs;
    });
    if (!conflict) {
      slots.push({
        start: new Date(cursor).toISOString(),
        end: new Date(slotEnd).toISOString(),
      });
      cursor = slotEnd; // advance past this slot
    } else {
      cursor += 15 * 60 * 1000; // advance 15 min and retry
    }
    // Skip overnight gaps — jump to 08:00 next day
    const cursorDate = new Date(cursor);
    if (cursorDate.getHours() >= 18) {
      cursorDate.setDate(cursorDate.getDate() + 1);
      cursorDate.setHours(8, 0, 0, 0);
      cursor = cursorDate.getTime();
    }
  }

  audit({
    actor: "skill:gcal",
    action: "gcal.free_slots.find",
    metadata: {
      durationMinutes: opts.durationMinutes,
      startDate: opts.startDate,
      endDate: opts.endDate,
      slotsFound: slots.length,
    },
  });

  return slots;
}
