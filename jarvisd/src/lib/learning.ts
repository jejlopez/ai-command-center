// M6 Learning polish — edit-as-feedback, snooze tracking, recommendation timing.

import { db } from "../db/db.js";
import { audit } from "./audit.js";
import { recordFeedback } from "./feedback.js";

// ---------------------------------------------------------------------------
// Edit-as-feedback: when a user edits a JARVIS output, capture the diff
// ---------------------------------------------------------------------------

export function recordEdit(outputId: string, original: string, edited: string): void {
  const diffSize = Math.abs(edited.length - original.length) +
    countChangedChars(original, edited);

  db.prepare(
    `INSERT INTO output_edits(output_id, original, edited, diff_size) VALUES (?, ?, ?, ?)`
  ).run(outputId, original, edited, diffSize);

  // Also record as implicit negative feedback — user changed the output
  const severity = diffSize > original.length * 0.5 ? "negative" : "neutral";
  recordFeedback({
    runId: outputId,
    kind: "general",
    rating: severity,
    reason: `User edited output (${diffSize} chars changed)`,
  });

  audit({
    actor: "user",
    action: "output.edit",
    subject: outputId,
    metadata: { diffSize, severity },
  });
}

function countChangedChars(a: string, b: string): number {
  const minLen = Math.min(a.length, b.length);
  let changes = 0;
  for (let i = 0; i < minLen; i++) {
    if (a[i] !== b[i]) changes++;
  }
  return changes;
}

// ---------------------------------------------------------------------------
// Snooze tracking: did the user act, snooze, or dismiss?
// ---------------------------------------------------------------------------

export type SnoozeAction = "snooze" | "dismiss" | "act";
export type SnoozeItemType = "approval" | "reminder" | "suggestion" | "skill_run";

export function recordSnooze(
  itemType: SnoozeItemType,
  itemId: string,
  action: SnoozeAction,
  delayMs?: number
): void {
  db.prepare(
    `INSERT INTO snooze_events(item_type, item_id, action, delay_ms) VALUES (?, ?, ?, ?)`
  ).run(itemType, itemId, action, delayMs ?? null);

  audit({
    actor: "user",
    action: `snooze.${action}`,
    subject: itemId,
    metadata: { itemType, delayMs },
  });
}

export function snoozeStats(itemType?: string): {
  total: number;
  acted: number;
  snoozed: number;
  dismissed: number;
  actRate: number;
} {
  const where = itemType ? "WHERE item_type = ?" : "";
  const params = itemType ? [itemType] : [];
  const rows = db.prepare(
    `SELECT action, COUNT(*) as cnt FROM snooze_events ${where} GROUP BY action`
  ).all(...params) as any[];

  const counts = { act: 0, snooze: 0, dismiss: 0 };
  for (const r of rows) {
    if (r.action in counts) (counts as any)[r.action] = r.cnt;
  }
  const total = counts.act + counts.snooze + counts.dismiss;

  return {
    total,
    acted: counts.act,
    snoozed: counts.snooze,
    dismissed: counts.dismiss,
    actRate: total > 0 ? counts.act / total : 0,
  };
}

// ---------------------------------------------------------------------------
// Recommendation timing: learn when the user actually acts
// ---------------------------------------------------------------------------

export function recordSuggestion(eventType: string): string {
  const id = crypto.randomUUID();
  const now = new Date();
  db.prepare(
    `INSERT INTO action_timing(id, event_type, suggested_at, day_of_week, hour_of_day)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, eventType, now.toISOString(), now.getDay(), now.getHours());
  return id;
}

export function recordAction(timingId: string): void {
  const now = new Date();
  const row = db.prepare("SELECT suggested_at FROM action_timing WHERE id = ?").get(timingId) as any;
  if (!row) return;

  const delayMs = now.getTime() - new Date(row.suggested_at).getTime();
  db.prepare(
    `UPDATE action_timing SET acted_at = ?, delay_ms = ? WHERE id = ?`
  ).run(now.toISOString(), delayMs, timingId);
}

/** Returns the best hours for a given event type based on when the user actually acts. */
export function bestTimeForEvent(eventType: string): {
  bestHour: number | null;
  bestDay: number | null;
  avgDelayMs: number | null;
  sampleSize: number;
} {
  const rows = db.prepare(
    `SELECT hour_of_day, day_of_week, delay_ms FROM action_timing
     WHERE event_type = ? AND acted_at IS NOT NULL
     ORDER BY created_at DESC LIMIT 100`
  ).all(eventType) as any[];

  if (rows.length < 3) {
    return { bestHour: null, bestDay: null, avgDelayMs: null, sampleSize: rows.length };
  }

  // Find hour with shortest average delay
  const hourDelays = new Map<number, number[]>();
  const dayDelays = new Map<number, number[]>();

  for (const r of rows) {
    const h = r.hour_of_day;
    const d = r.day_of_week;
    if (!hourDelays.has(h)) hourDelays.set(h, []);
    hourDelays.get(h)!.push(r.delay_ms);
    if (!dayDelays.has(d)) dayDelays.set(d, []);
    dayDelays.get(d)!.push(r.delay_ms);
  }

  let bestHour = 0;
  let bestHourAvg = Infinity;
  for (const [h, delays] of hourDelays) {
    const avg = delays.reduce((a, b) => a + b, 0) / delays.length;
    if (avg < bestHourAvg) { bestHour = h; bestHourAvg = avg; }
  }

  let bestDay = 0;
  let bestDayAvg = Infinity;
  for (const [d, delays] of dayDelays) {
    const avg = delays.reduce((a, b) => a + b, 0) / delays.length;
    if (avg < bestDayAvg) { bestDay = d; bestDayAvg = avg; }
  }

  const totalDelay = rows.reduce((a: number, r: any) => a + r.delay_ms, 0);

  return {
    bestHour,
    bestDay,
    avgDelayMs: Math.round(totalDelay / rows.length),
    sampleSize: rows.length,
  };
}
