// Workflow engine — runs skills from the registry and persists each run.
//
// Responsibilities:
//   - Execute a skill on demand (manual/event) or on schedule (cron).
//   - Persist every run in `skill_runs` + snapshot it to episodic memory.
//   - Own the in-process cron scheduler.
//
// Cron subset supported (v1):
//   "M H * * *"  → fire at H:M every day (0-59 / 0-23)
//   "M * * * *"  → fire at minute M of every hour
// Anything richer is logged and skipped. Seconds are not supported.
//
// The scheduler ticks every 60s; each tick iterates registered cron triggers
// and fires any whose expression matches the current (local) minute+hour.

import { randomUUID } from "node:crypto";
import { db } from "../db/db.js";
import { audit } from "./audit.js";
import { episodic } from "./episodic.js";
import { memory } from "./memory.js";
import * as apple from "./providers/apple.js";
import { registry, callModel, type SkillContext } from "./skills.js";
import { bus } from "./events.js";
import { recordRouting } from "./router_learning.js";
import type { SkillRun, SkillManifest, SkillTrigger } from "../../../shared/types.js";

// ---------------------------------------------------------------------------
// Row <-> SkillRun mapping
// ---------------------------------------------------------------------------

function rowToRun(row: any): SkillRun {
  return {
    id: row.id,
    skill: row.skill,
    status: row.status,
    triggeredBy: row.triggered_by,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? undefined,
    durationMs: row.duration_ms ?? undefined,
    inputs: row.inputs ? JSON.parse(row.inputs) : undefined,
    output: row.output ? JSON.parse(row.output) : undefined,
    error: row.error ?? undefined,
    costUsd: row.cost_usd ?? undefined,
    tokensIn: row.tokens_in ?? undefined,
    tokensOut: row.tokens_out ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RunSkillOpts {
  inputs?: Record<string, unknown>;
  triggeredBy: "manual" | "cron" | "event";
}

export async function runSkill(name: string, opts: RunSkillOpts): Promise<SkillRun> {
  const skill = registry.get(name);
  if (!skill) {
    throw new Error(`skill not found: ${name}`);
  }

  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const inputs = opts.inputs ?? {};

  db.prepare(
    `INSERT INTO skill_runs(id, skill, status, triggered_by, started_at, inputs)
     VALUES (?, ?, 'running', ?, ?, ?)`
  ).run(runId, name, opts.triggeredBy, startedAt, JSON.stringify(inputs));

  audit({
    actor: `skill:${name}`,
    action: "skill.run.start",
    subject: runId,
    metadata: { triggeredBy: opts.triggeredBy },
  });

  try {
    bus.emit("skill.started", { runId, skill: name, triggeredBy: opts.triggeredBy });
  } catch { /* best-effort */ }

  let costUsd = 0;
  let tokensIn = 0;
  let tokensOut = 0;

  const ctx: SkillContext = {
    runId,
    inputs,
    triggeredBy: opts.triggeredBy,
    memory,
    apple,
    callModel: async (input) => {
      const callStart = Date.now();
      const out = await callModel(input, { skill: name, runId });
      costUsd += out.costUsd;
      tokensIn += out.tokensIn;
      tokensOut += out.tokensOut;
      try {
        recordRouting({
          taskKind: input.kind ?? "chat",
          provider: out.provider ?? "unknown",
          model: out.model,
          success: true,
          costUsd: out.costUsd,
          durationMs: Date.now() - callStart,
        });
      } catch { /* best-effort */ }
      return out;
    },
    log: (msg, meta) => {
      audit({
        actor: `skill:${name}`,
        action: "skill.log",
        subject: runId,
        metadata: { msg, ...meta },
      });
    },
  };

  let output: unknown = null;
  let error: string | null = null;
  let status: SkillRun["status"] = "completed";

  try {
    output = await skill.run(ctx);
  } catch (err: any) {
    status = "failed";
    error = err?.message ?? String(err);
    audit({
      actor: `skill:${name}`,
      action: "skill.run.fail",
      subject: runId,
      reason: error ?? undefined,
    });
  }

  const completedAt = new Date().toISOString();
  const durationMs = Date.parse(completedAt) - Date.parse(startedAt);

  db.prepare(
    `UPDATE skill_runs
       SET status = ?, completed_at = ?, duration_ms = ?, output = ?, error = ?,
           cost_usd = ?, tokens_in = ?, tokens_out = ?
     WHERE id = ?`
  ).run(
    status,
    completedAt,
    durationMs,
    output != null ? JSON.stringify(output) : null,
    error,
    costUsd || null,
    tokensIn || null,
    tokensOut || null,
    runId
  );

  // If the skill returned { skipped: true }, it decided at runtime that
  // this invocation isn't relevant (e.g. contact_enrich on a non-person
  // memory.remembered event). Clean up the run row so it doesn't pollute
  // /runs lists — the audit log still captured the attempt.
  const isSkipped =
    output != null &&
    typeof output === "object" &&
    (output as any).skipped === true;
  if (isSkipped) {
    db.prepare("DELETE FROM skill_runs WHERE id = ?").run(runId);
    return {
      id: runId,
      skill: name,
      status: "completed" as const,
      triggeredBy: opts.triggeredBy,
      startedAt,
      completedAt,
      durationMs,
      output,
    };
  }

  // Episodic snapshot — one per run regardless of status.
  try {
    episodic.snapshot({
      kind: "skill_run",
      title: `${name} — ${status}`,
      body: {
        runId,
        skill: name,
        status,
        triggeredBy: opts.triggeredBy,
        startedAt,
        completedAt,
        durationMs,
        inputs,
        output,
        error,
        costUsd,
        tokensIn,
        tokensOut,
      },
      actor: `skill:${name}`,
    });
  } catch (err: any) {
    console.warn(`[workflow] episodic snapshot failed: ${err?.message ?? err}`);
  }

  audit({
    actor: `skill:${name}`,
    action: status === "completed" ? "skill.run.complete" : "skill.run.fail",
    subject: runId,
    metadata: { durationMs, costUsd },
  });

  // Emit skill.completed so other parts of the system can react. Skills
  // subscribed to this event are dispatched via the event bus; to avoid
  // re-entrancy, initEventBus() refuses to wire any skill to this event.
  try {
    bus.emit("skill.completed", { runId, skill: name, status });
  } catch (err: any) {
    console.warn(`[workflow] bus.emit skill.completed failed: ${err?.message ?? err}`);
  }

  const row = db.prepare("SELECT * FROM skill_runs WHERE id = ?").get(runId) as any;
  return rowToRun(row);
}

export function listRuns(opts: { skill?: string; limit?: number; since?: string } = {}): SkillRun[] {
  const limit = Math.min(opts.limit ?? 20, 500);
  const clauses: string[] = [];
  const params: any[] = [];
  if (opts.skill) {
    clauses.push("skill = ?");
    params.push(opts.skill);
  }
  if (opts.since) {
    clauses.push("started_at >= ?");
    params.push(opts.since);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  params.push(limit);
  const rows = db
    .prepare(`SELECT * FROM skill_runs ${where} ORDER BY started_at DESC LIMIT ?`)
    .all(...params) as any[];
  return rows.map(rowToRun);
}

export function getRun(id: string): SkillRun | null {
  const row = db.prepare("SELECT * FROM skill_runs WHERE id = ?").get(id) as any;
  return row ? rowToRun(row) : null;
}

// ---------------------------------------------------------------------------
// Cron parser + scheduler
// ---------------------------------------------------------------------------

// Parsed cron for the subset we support.
interface ParsedCron {
  minute: number | "*";
  hour: number | "*";
  expr: string;
}

function parseCron(expr: string): ParsedCron | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [m, h, dom, mon, dow] = parts;
  // Only support wildcard day/month/dow.
  if (dom !== "*" || mon !== "*" || dow !== "*") return null;
  const minute = m === "*" ? "*" : Number(m);
  const hour = h === "*" ? "*" : Number(h);
  if (minute !== "*" && (!Number.isInteger(minute) || minute < 0 || minute > 59)) return null;
  if (hour !== "*" && (!Number.isInteger(hour) || hour < 0 || hour > 23)) return null;
  // We only support "M H * * *" and "M * * * *".
  if (minute === "*") return null;
  return { minute, hour, expr };
}

function cronMatches(cron: ParsedCron, date: Date): boolean {
  if (cron.minute !== "*" && date.getMinutes() !== cron.minute) return false;
  if (cron.hour !== "*" && date.getHours() !== cron.hour) return false;
  return true;
}

function nextCronRun(cron: ParsedCron, from: Date = new Date()): Date {
  const next = new Date(from.getTime());
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + 1);
  // Walk up to 24*60 minutes.
  for (let i = 0; i < 24 * 60 + 1; i++) {
    if (cronMatches(cron, next)) return next;
    next.setMinutes(next.getMinutes() + 1);
  }
  return next;
}

interface ScheduledCron {
  skill: string;
  cron: ParsedCron;
  trigger: SkillTrigger;
}

function collectCrons(): ScheduledCron[] {
  const out: ScheduledCron[] = [];
  for (const manifest of registry.list()) {
    for (const trigger of manifest.triggers ?? []) {
      if (trigger.kind !== "cron") continue;
      const parsed = parseCron(trigger.expr);
      if (!parsed) {
        console.warn(
          `[workflow] skill ${manifest.name}: unsupported cron "${trigger.expr}" — skipping`
        );
        continue;
      }
      out.push({ skill: manifest.name, cron: parsed, trigger });
    }
  }
  return out;
}

let schedulerTimer: NodeJS.Timeout | null = null;
const lastFiredMinute = new Map<string, string>(); // key = skill|expr, value = "YYYY-MM-DDTHH:MM"

function tickKey(d: Date): string {
  return d.toISOString().slice(0, 16);
}

async function tick(): Promise<void> {
  const now = new Date();
  const key = tickKey(now);
  const crons = collectCrons();
  for (const c of crons) {
    if (!cronMatches(c.cron, now)) continue;
    const id = `${c.skill}|${c.cron.expr}`;
    if (lastFiredMinute.get(id) === key) continue;
    lastFiredMinute.set(id, key);
    try {
      await runSkill(c.skill, { triggeredBy: "cron" });
    } catch (err: any) {
      console.warn(`[workflow] cron run ${c.skill} failed: ${err?.message ?? err}`);
    }
  }
}

export function startScheduler(): void {
  if (schedulerTimer) return;
  // Tick every 60s. First tick after ~5s so we don't block daemon boot.
  schedulerTimer = setInterval(() => {
    void tick();
  }, 60_000);
  // Run a soft tick right after boot too, but delayed, so the registry is
  // populated and we don't immediately re-fire on every restart.
  setTimeout(() => {
    void tick();
  }, 5_000);
  console.log(`[workflow] scheduler started (${collectCrons().length} cron triggers)`);
}

export function stopScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

// ---------------------------------------------------------------------------
// Workflow listing (for GET /workflows)
// ---------------------------------------------------------------------------

export interface WorkflowEntry {
  skill: string;
  trigger: SkillTrigger;
  nextRun?: string;
}

export function listWorkflows(): WorkflowEntry[] {
  const out: WorkflowEntry[] = [];
  for (const manifest of registry.list()) {
    for (const trigger of manifest.triggers ?? []) {
      if (trigger.kind !== "cron") continue;
      const parsed = parseCron(trigger.expr);
      if (!parsed) {
        out.push({ skill: manifest.name, trigger });
        continue;
      }
      out.push({
        skill: manifest.name,
        trigger,
        nextRun: nextCronRun(parsed).toISOString(),
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Event-driven dispatch
// ---------------------------------------------------------------------------

// Re-entrancy guard: skills subscribed to "skill.completed" would trigger
// themselves when they finish. For now we simply refuse to wire that event
// at init time. (Manual triggers can still fire them.)
const NON_SUBSCRIBABLE_EVENTS = new Set<string>(["skill.completed"]);

export async function runSkillForEvent(
  event: string,
  payload: Record<string, unknown>
): Promise<SkillRun[]> {
  const runs: SkillRun[] = [];
  for (const manifest of registry.list()) {
    const subscribed = (manifest.triggers ?? []).some(
      (t) => t.kind === "event" && t.event === event
    );
    if (!subscribed) continue;
    try {
      const run = await runSkill(manifest.name, {
        inputs: { event: payload },
        triggeredBy: "event",
      });
      runs.push(run);
    } catch (err: any) {
      console.warn(
        `[workflow] event-triggered skill ${manifest.name} failed for ${event}: ${err?.message ?? err}`
      );
    }
  }
  return runs;
}

let eventBusInitialized = false;

export function initEventBus(): void {
  if (eventBusInitialized) return;
  eventBusInitialized = true;

  const events = new Set<string>();
  for (const manifest of registry.list()) {
    for (const trigger of manifest.triggers ?? []) {
      if (trigger.kind !== "event") continue;
      if (NON_SUBSCRIBABLE_EVENTS.has(trigger.event)) {
        console.warn(
          `[workflow] skill ${manifest.name} subscribes to ${trigger.event} — refused (re-entrant)`
        );
        continue;
      }
      events.add(trigger.event);
    }
  }

  for (const event of events) {
    bus.on(event, (payload) => {
      // Fire-and-forget: event dispatch is best-effort.
      void runSkillForEvent(event, payload);
    });
  }

  console.log(`[workflow] event bus wired (${events.size} subscribed events)`);
}

export function _parseCronForTest(expr: string): ParsedCron | null {
  return parseCron(expr);
}

// Silence unused warnings for manifest import (kept for reference).
export type _ManifestRef = SkillManifest;
