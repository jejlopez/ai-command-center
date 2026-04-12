import { randomUUID } from "node:crypto";
import { db } from "../db/db.js";
import { audit } from "./audit.js";

export type EpisodicKind =
  | "brief"
  | "approval"
  | "skill_run"
  | "remember"
  | "custom";

export interface EpisodicSnapshot {
  id: string;
  ts: string;
  kind: EpisodicKind;
  title: string;
  body: unknown;        // parsed JSON
  actor?: string;
}

export interface SnapshotInput {
  kind: EpisodicKind;
  title: string;
  body: unknown;
  actor?: string;
}

function toSnapshot(row: any): EpisodicSnapshot {
  return {
    id: row.id,
    ts: row.ts,
    kind: row.kind,
    title: row.title,
    body: row.body ? JSON.parse(row.body) : null,
    actor: row.actor ?? undefined,
  };
}

export const episodic = {
  snapshot(input: SnapshotInput): EpisodicSnapshot {
    const id = randomUUID();
    const ts = new Date().toISOString();
    const bodyJson = JSON.stringify(input.body ?? null);
    db.prepare(
      `INSERT INTO episodic_snapshots(id, ts, kind, title, body, actor)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, ts, input.kind, input.title, bodyJson, input.actor ?? null);

    audit({
      actor: input.actor ?? "system",
      action: "episodic.snapshot",
      subject: id,
      metadata: { kind: input.kind, title: input.title },
    });

    return toSnapshot({
      id,
      ts,
      kind: input.kind,
      title: input.title,
      body: bodyJson,
      actor: input.actor,
    });
  },

  list(opts: { kind?: EpisodicKind; since?: string; limit?: number } = {}): EpisodicSnapshot[] {
    const limit = Math.min(opts.limit ?? 100, 500);
    const clauses: string[] = [];
    const params: any[] = [];
    if (opts.kind) {
      clauses.push("kind = ?");
      params.push(opts.kind);
    }
    if (opts.since) {
      clauses.push("ts >= ?");
      params.push(opts.since);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    params.push(limit);
    const rows = db
      .prepare(
        `SELECT * FROM episodic_snapshots ${where} ORDER BY ts DESC LIMIT ?`
      )
      .all(...params) as any[];
    return rows.map(toSnapshot);
  },

  get(id: string): EpisodicSnapshot | null {
    const row = db.prepare("SELECT * FROM episodic_snapshots WHERE id = ?").get(id) as any;
    return row ? toSnapshot(row) : null;
  },

  deleteOlderThan(days: number): number {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const info = db
      .prepare("DELETE FROM episodic_snapshots WHERE ts < ?")
      .run(cutoff);
    return info.changes;
  },
};
