// Feedback capture — records user feedback on skill runs, asks, and briefs.
// Feeds into router learning loop.

import { randomUUID } from "node:crypto";
import { db } from "../db/db.js";
import { audit } from "./audit.js";
import type { FeedbackEntry, FeedbackRating } from "../../../shared/types.js";

function rowToEntry(row: any): FeedbackEntry {
  return {
    id: row.id,
    runId: row.run_id ?? null,
    kind: row.kind,
    rating: row.rating,
    reason: row.reason ?? undefined,
    createdAt: row.created_at,
  };
}

export interface RecordFeedbackOpts {
  runId?: string;
  kind: FeedbackEntry["kind"];
  rating: FeedbackRating;
  reason?: string;
}

export function recordFeedback(opts: RecordFeedbackOpts): FeedbackEntry {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO feedback(id, run_id, kind, rating, reason) VALUES (?, ?, ?, ?, ?)`
  ).run(id, opts.runId ?? null, opts.kind, opts.rating, opts.reason ?? null);

  audit({
    actor: "user",
    action: "feedback.record",
    subject: id,
    metadata: { kind: opts.kind, rating: opts.rating, runId: opts.runId },
  });

  const row = db.prepare("SELECT * FROM feedback WHERE id = ?").get(id) as any;
  return rowToEntry(row);
}

export function listFeedback(opts: { kind?: string; limit?: number } = {}): FeedbackEntry[] {
  const limit = Math.min(opts.limit ?? 50, 500);
  if (opts.kind) {
    return (db.prepare("SELECT * FROM feedback WHERE kind = ? ORDER BY created_at DESC LIMIT ?")
      .all(opts.kind, limit) as any[]).map(rowToEntry);
  }
  return (db.prepare("SELECT * FROM feedback ORDER BY created_at DESC LIMIT ?")
    .all(limit) as any[]).map(rowToEntry);
}

export function feedbackStatsForSkill(skillName: string): { positive: number; negative: number; neutral: number; total: number } {
  const rows = db.prepare(
    `SELECT f.rating, COUNT(*) as cnt FROM feedback f
     JOIN skill_runs sr ON f.run_id = sr.id
     WHERE sr.skill = ?
     GROUP BY f.rating`
  ).all(skillName) as any[];

  const stats = { positive: 0, negative: 0, neutral: 0, total: 0 };
  for (const r of rows) {
    if (r.rating in stats) (stats as any)[r.rating] = r.cnt;
    stats.total += r.cnt;
  }
  return stats;
}
