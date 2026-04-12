// Audit routes — query the hash-chained audit log + verify integrity.

import type { FastifyInstance } from "fastify";
import { db } from "../db/db.js";
import { verifyAuditChain } from "../lib/audit.js";

export interface AuditRow {
  id: number;
  ts: string;
  actor: string;
  action: string;
  subject: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  hash: string;
}

function parseRow(row: any): AuditRow {
  return {
    id: row.id,
    ts: row.ts,
    actor: row.actor,
    action: row.action,
    subject: row.subject,
    reason: row.reason,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    hash: row.hash,
  };
}

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  // Paginated audit log listing.
  app.get<{
    Querystring: {
      limit?: string;
      offset?: string;
      action?: string;
      actor?: string;
      since?: string;
    };
  }>("/audit/log", async (req) => {
    const limit = Math.min(Number(req.query.limit ?? 100), 500);
    const offset = Number(req.query.offset ?? 0);
    const { action, actor, since } = req.query;

    let where = "1=1";
    const params: unknown[] = [];

    if (action) {
      where += " AND action LIKE ?";
      params.push(`${action}%`);
    }
    if (actor) {
      where += " AND actor = ?";
      params.push(actor);
    }
    if (since) {
      where += " AND ts >= ?";
      params.push(since);
    }

    const rows = db
      .prepare(
        `SELECT id, ts, actor, action, subject, reason, metadata, hash
         FROM audit_log WHERE ${where}
         ORDER BY id DESC LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset) as any[];

    const total = (
      db.prepare(`SELECT COUNT(*) as cnt FROM audit_log WHERE ${where}`).get(...params) as any
    ).cnt;

    return {
      entries: rows.map(parseRow),
      total,
      limit,
      offset,
    };
  });

  // Summary: count of actions by type, for the last N hours.
  app.get<{ Querystring: { hours?: string } }>("/audit/summary", async (req) => {
    const hours = Number(req.query.hours ?? 24);
    const since = new Date(Date.now() - hours * 3600_000).toISOString();

    const rows = db
      .prepare(
        `SELECT action, COUNT(*) as count FROM audit_log
         WHERE ts >= ? GROUP BY action ORDER BY count DESC`
      )
      .all(since) as Array<{ action: string; count: number }>;

    const total = rows.reduce((s, r) => s + r.count, 0);

    return { hours, since, total, actions: rows };
  });

  // Chain verification (already exists at /audit/verify, but we add it to the
  // audit route namespace too for completeness).
  app.get("/audit/chain", async () => verifyAuditChain());
}
