// Limits engine — rate limits, circuit breakers, quiet hours, VIP protection.
// Every connector action MUST check limits before executing.

import { db } from "../db/db.js";
import { audit } from "./audit.js";

// ---------------------------------------------------------------------------
// Rate limits
// ---------------------------------------------------------------------------

export function checkLimit(connector: string, action: string, period: "per_run" | "per_day"): {
  allowed: boolean;
  current: number;
  max: number;
} {
  const row = db.prepare(
    "SELECT * FROM connector_limits WHERE connector = ? AND action = ? AND period = ?"
  ).get(connector, action, period) as any;

  if (!row) return { allowed: true, current: 0, max: Infinity };

  // Reset daily counters if past reset time
  if (period === "per_day" && new Date(row.reset_at) < new Date()) {
    db.prepare(
      "UPDATE connector_limits SET current = 0, reset_at = datetime('now','+1 day') WHERE id = ?"
    ).run(row.id);
    return { allowed: true, current: 0, max: row.max_count };
  }

  return {
    allowed: row.current < row.max_count,
    current: row.current,
    max: row.max_count,
  };
}

export function incrementLimit(connector: string, action: string, period: "per_run" | "per_day"): void {
  db.prepare(
    "UPDATE connector_limits SET current = current + 1 WHERE connector = ? AND action = ? AND period = ?"
  ).run(connector, action, period);
}

export function resetRunLimits(connector: string): void {
  db.prepare(
    "UPDATE connector_limits SET current = 0 WHERE connector = ? AND period = 'per_run'"
  ).run(connector);
}

/** Check both per_run and per_day limits. Throws if either exceeded. */
export function assertLimit(connector: string, action: string): void {
  const run = checkLimit(connector, action, "per_run");
  if (!run.allowed) {
    audit({ actor: "limits", action: "limit.exceeded", subject: `${connector}.${action}`, metadata: { period: "per_run", current: run.current, max: run.max } });
    throw new Error(`Rate limit exceeded: ${connector}.${action} per_run (${run.current}/${run.max})`);
  }
  const day = checkLimit(connector, action, "per_day");
  if (!day.allowed) {
    audit({ actor: "limits", action: "limit.exceeded", subject: `${connector}.${action}`, metadata: { period: "per_day", current: day.current, max: day.max } });
    throw new Error(`Rate limit exceeded: ${connector}.${action} per_day (${day.current}/${day.max})`);
  }
}

/** Increment both per_run and per_day after a successful action. */
export function recordAction(connector: string, action: string): void {
  incrementLimit(connector, action, "per_run");
  incrementLimit(connector, action, "per_day");
}

// ---------------------------------------------------------------------------
// Circuit breaker
// ---------------------------------------------------------------------------

export function checkCircuitBreaker(connector: string): { open: boolean; reason?: string } {
  const row = db.prepare(
    "SELECT * FROM circuit_breakers WHERE connector = ?"
  ).get(connector) as any;

  if (!row) return { open: false };

  if (row.state === "open") {
    // Check if it should transition to half-open
    if (row.closes_at && new Date(row.closes_at) < new Date()) {
      db.prepare("UPDATE circuit_breakers SET state = 'half_open' WHERE connector = ?").run(connector);
      return { open: false };
    }
    return { open: true, reason: row.last_error };
  }

  return { open: false };
}

export function recordCircuitError(connector: string, error: string): void {
  const row = db.prepare("SELECT * FROM circuit_breakers WHERE connector = ?").get(connector) as any;
  if (!row) return;

  const newCount = (row.error_count ?? 0) + 1;

  if (newCount >= 5) {
    // OPEN the circuit
    const closesAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15min
    db.prepare(
      "UPDATE circuit_breakers SET state = 'open', error_count = ?, last_error = ?, opened_at = datetime('now'), closes_at = ? WHERE connector = ?"
    ).run(newCount, error, closesAt, connector);

    audit({
      actor: "circuit_breaker",
      action: "circuit.open",
      subject: connector,
      reason: `${newCount} errors — circuit opened for 15min`,
    });
  } else {
    db.prepare(
      "UPDATE circuit_breakers SET error_count = ?, last_error = ? WHERE connector = ?"
    ).run(newCount, error, connector);
  }
}

export function recordCircuitSuccess(connector: string): void {
  db.prepare(
    "UPDATE circuit_breakers SET state = 'closed', error_count = 0, last_error = NULL, opened_at = NULL, closes_at = NULL WHERE connector = ?"
  ).run(connector);
}

export function resetCircuitBreaker(connector: string): void {
  recordCircuitSuccess(connector);
  audit({ actor: "user", action: "circuit.reset", subject: connector });
}

// ---------------------------------------------------------------------------
// Quiet hours
// ---------------------------------------------------------------------------

export function isQuietHours(): boolean {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  const rows = db.prepare(
    "SELECT * FROM quiet_hours WHERE enabled = 1"
  ).all() as any[];

  for (const qh of rows) {
    const days = qh.days.split(",").map(Number);
    if (!days.includes(day)) continue;

    if (qh.start_hour > qh.end_hour) {
      // Wraps midnight: e.g., 21-7 means 21:00 to 07:00
      if (hour >= qh.start_hour || hour < qh.end_hour) return true;
    } else {
      if (hour >= qh.start_hour && hour < qh.end_hour) return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Protected senders
// ---------------------------------------------------------------------------

export function isProtectedSender(email: string): boolean {
  const row = db.prepare(
    "SELECT id FROM protected_senders WHERE email = ?"
  ).get(email.toLowerCase());
  return !!row;
}

export function addProtectedSender(email: string, reason?: string): void {
  db.prepare(
    "INSERT OR IGNORE INTO protected_senders(email, reason) VALUES (?, ?)"
  ).run(email.toLowerCase(), reason ?? null);
}

export function listProtectedSenders(): Array<{ email: string; reason: string | null }> {
  return db.prepare("SELECT email, reason FROM protected_senders").all() as any[];
}
