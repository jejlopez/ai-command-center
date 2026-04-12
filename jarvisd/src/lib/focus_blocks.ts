import { randomUUID } from "node:crypto";
import { db } from "../db/db.js";
import { audit } from "./audit.js";
import type { FocusBlock, CreateFocusBlockBody } from "../../../shared/types.js";

function toBlock(row: any): FocusBlock {
  return {
    id: row.id,
    title: row.title,
    start: row.start_ts,
    end: row.end_ts,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

/**
 * Returns [startIso, endIso) as a half-open range covering the given
 * YYYY-MM-DD day interpreted in the server's LOCAL wall clock — matches
 * how the /today route and Apple Calendar understand "today".
 *
 * We build the range via local Date constructors then call .toISOString()
 * so the comparison stored in SQLite (which is always UTC ISO) lines up.
 */
function localDayRange(dayIso: string): { start: string; end: string } {
  const [y, m, d] = dayIso.split("-").map(Number);
  if (!y || !m || !d) {
    throw new Error(`invalid day: ${dayIso}`);
  }
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

export const focusBlocks = {
  /**
   * List focus blocks whose start falls within the given local YYYY-MM-DD.
   */
  list(dayIso: string): FocusBlock[] {
    const { start, end } = localDayRange(dayIso);
    const rows = db
      .prepare(
        `SELECT * FROM focus_blocks
         WHERE start_ts >= ? AND start_ts < ?
         ORDER BY start_ts ASC`
      )
      .all(start, end) as any[];
    return rows.map(toBlock);
  },

  create(input: CreateFocusBlockBody): FocusBlock {
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO focus_blocks(id, title, start_ts, end_ts, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, input.title, input.start, input.end, input.notes ?? null, now);

    audit({
      actor: "user",
      action: "focus_block.create",
      subject: id,
      metadata: {
        title: input.title,
        start: input.start,
        end: input.end,
      },
    });

    return toBlock(
      db.prepare("SELECT * FROM focus_blocks WHERE id = ?").get(id)
    );
  },

  delete(id: string): boolean {
    const row = db.prepare("SELECT id FROM focus_blocks WHERE id = ?").get(id);
    if (!row) return false;
    db.prepare("DELETE FROM focus_blocks WHERE id = ?").run(id);
    audit({ actor: "user", action: "focus_block.delete", subject: id });
    return true;
  },
};
