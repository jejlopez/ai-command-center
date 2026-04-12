import { createHash } from "node:crypto";
import { db } from "../db/db.js";

export interface AuditEntry {
  actor: string;
  action: string;
  subject?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

const GENESIS = "0".repeat(64);

function lastHash(): string {
  const row = db
    .prepare("SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1")
    .get() as { hash: string } | undefined;
  return row?.hash ?? GENESIS;
}

const insertStmt = db.prepare(
  `INSERT INTO audit_log(ts, actor, action, subject, reason, metadata, prev_hash, hash)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);

const writeEntry = db.transaction((entry: AuditEntry) => {
  const ts = new Date().toISOString();
  const prev = lastHash(); // read inside txn — serialized by SQLite
  const metaJson = entry.metadata ? JSON.stringify(entry.metadata) : null;
  const payload = [ts, entry.actor, entry.action, entry.subject ?? "", entry.reason ?? "", metaJson ?? "", prev].join("|");
  const hash = createHash("sha256").update(payload).digest("hex");
  insertStmt.run(ts, entry.actor, entry.action, entry.subject ?? null, entry.reason ?? null, metaJson, prev, hash);
});

export function audit(entry: AuditEntry): void {
  writeEntry(entry);
}

export function verifyAuditChain(): { ok: boolean; brokenAt?: number } {
  const rows = db
    .prepare("SELECT id, ts, actor, action, subject, reason, metadata, prev_hash, hash FROM audit_log ORDER BY id ASC")
    .all() as Array<{
      id: number;
      ts: string;
      actor: string;
      action: string;
      subject: string | null;
      reason: string | null;
      metadata: string | null;
      prev_hash: string;
      hash: string;
    }>;

  let prev = GENESIS;
  for (const r of rows) {
    if (r.prev_hash !== prev) return { ok: false, brokenAt: r.id };
    const payload = [r.ts, r.actor, r.action, r.subject ?? "", r.reason ?? "", r.metadata ?? "", r.prev_hash].join("|");
    const expected = createHash("sha256").update(payload).digest("hex");
    if (expected !== r.hash) return { ok: false, brokenAt: r.id };
    prev = r.hash;
  }
  return { ok: true };
}
