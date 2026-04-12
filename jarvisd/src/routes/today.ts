import type { FastifyInstance } from "fastify";
import { calendarStatus, getTodayEvents } from "../lib/providers/apple.js";
import { focusBlocks } from "../lib/focus_blocks.js";
import type { TodayItem, TodayView, FocusBlock } from "../../../shared/types.js";

/**
 * Local (not UTC) YYYY-MM-DD — matches the user's wall clock, which is what
 * Apple Calendar's "today" uses.
 */
function localDayIso(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function focusToItem(b: FocusBlock): TodayItem {
  return {
    kind: "focus",
    id: b.id,
    title: b.title,
    start: b.start,
    end: b.end,
    notes: b.notes,
    conflictsWith: [],
  };
}

function computeConflicts(all: TodayItem[]): number {
  // Reset first (items are fresh objects, but be explicit).
  for (const it of all) it.conflictsWith = [];
  for (let i = 0; i < all.length; i++) {
    const a = all[i];
    const aStart = Date.parse(a.start);
    const aEnd = Date.parse(a.end);
    if (Number.isNaN(aStart) || Number.isNaN(aEnd)) continue;
    for (let j = i + 1; j < all.length; j++) {
      const b = all[j];
      const bStart = Date.parse(b.start);
      const bEnd = Date.parse(b.end);
      if (Number.isNaN(bStart) || Number.isNaN(bEnd)) continue;
      // Strict overlap: a.start < b.end && b.start < a.end
      if (aStart < bEnd && bStart < aEnd) {
        a.conflictsWith.push(b.id);
        b.conflictsWith.push(a.id);
      }
    }
  }
  return all.reduce((n, it) => (it.conflictsWith.length > 0 ? n + 1 : n), 0);
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race<T>([
    p,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function todayRoutes(app: FastifyInstance): Promise<void> {
  app.get("/today", async (): Promise<TodayView> => {
    const date = localDayIso();

    // Events from Apple Calendar — best effort, bounded to 8s total so /today
    // stays responsive even when AppleScript/Calendar.app is slow or waiting
    // on a permission prompt.
    let events: TodayItem[] = [];
    const status = await withTimeout(
      calendarStatus(),
      3000,
      { available: false, error: "status timeout" } as { available: boolean; error?: string }
    );
    if (status.available) {
      const raw = await withTimeout(getTodayEvents(), 8000, []);
      events = raw.map(
        (e): TodayItem => ({
          kind: "event",
          id: e.id,
          title: e.title,
          start: e.start,
          end: e.end,
          location: e.location,
          calendar: e.calendar,
          conflictsWith: [],
        })
      );
    }

    // Focus blocks for today.
    const blocks = focusBlocks.list(date).map(focusToItem);

    // Merge + sort by start.
    const all: TodayItem[] = [...events, ...blocks].sort(
      (a, b) => Date.parse(a.start) - Date.parse(b.start)
    );

    const conflictCount = computeConflicts(all);

    return {
      date,
      events,
      focusBlocks: blocks,
      all,
      conflictCount,
    };
  });
}
