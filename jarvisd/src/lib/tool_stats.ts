// Per-tool-call attribution + aggregate queries for the agentic loop.
// Writes happen inside runAgenticTurn(); reads power the /cost/tools and
// /cost/agentic endpoints.

import { db } from "../db/db.js";

export interface ToolCallRecord {
  runId: string;
  iteration: number;
  toolName: string;
  durationMs: number;
  isError: boolean;
  queued: boolean;
  approvalId?: string;
  costUsd: number;
}

export function recordToolCall(r: ToolCallRecord): void {
  db.prepare(
    `INSERT INTO tool_calls
       (ts, run_id, iteration, tool_name, duration_ms, is_error, queued, approval_id, cost_usd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    new Date().toISOString(),
    r.runId,
    r.iteration,
    r.toolName,
    Math.max(0, Math.round(r.durationMs)),
    r.isError ? 1 : 0,
    r.queued ? 1 : 0,
    r.approvalId ?? null,
    r.costUsd
  );
}

export interface ToolLeaderboardRow {
  toolName: string;
  calls: number;
  errors: number;
  queued: number;
  totalCostUsd: number;
  avgDurationMs: number;
  p50DurationMs: number;
  lastUsedIso: string;
}

/**
 * Per-tool aggregates for a time window.
 * Default window: last 30 days.
 */
export function toolLeaderboard(opts: { sinceIso?: string } = {}): ToolLeaderboardRow[] {
  const since = opts.sinceIso ?? new Date(Date.now() - 30 * 86400_000).toISOString();
  const rows = db
    .prepare(
      `SELECT
         tool_name       AS toolName,
         COUNT(*)        AS calls,
         SUM(is_error)   AS errors,
         SUM(queued)     AS queued,
         SUM(cost_usd)   AS totalCostUsd,
         AVG(duration_ms) AS avgDurationMs,
         MAX(ts)         AS lastUsedIso
       FROM tool_calls
       WHERE ts >= ?
       GROUP BY tool_name
       ORDER BY totalCostUsd DESC, calls DESC`
    )
    .all(since) as Array<Omit<ToolLeaderboardRow, "p50DurationMs">>;

  // Compute p50 per tool in one extra pass. SQLite doesn't have a median
  // window function in our build, so we grab the ordered durations.
  const out: ToolLeaderboardRow[] = [];
  for (const r of rows) {
    const durations = db
      .prepare(
        `SELECT duration_ms AS d FROM tool_calls
         WHERE ts >= ? AND tool_name = ?
         ORDER BY duration_ms ASC`
      )
      .all(since, r.toolName) as Array<{ d: number }>;
    const p50 = durations.length
      ? durations[Math.floor(durations.length / 2)].d
      : 0;
    out.push({
      toolName: r.toolName,
      calls: Number(r.calls) || 0,
      errors: Number(r.errors) || 0,
      queued: Number(r.queued) || 0,
      totalCostUsd: Number(r.totalCostUsd) || 0,
      avgDurationMs: Math.round(Number(r.avgDurationMs) || 0),
      p50DurationMs: Math.round(p50),
      lastUsedIso: r.lastUsedIso,
    });
  }
  return out;
}

export interface AgenticTotals {
  turns: number;                 // distinct run_ids in the window
  toolCalls: number;             // total tool dispatches
  erroredToolCalls: number;
  queuedToolCalls: number;
  totalCostUsd: number;          // SUM of cost_events where task_kind='agentic' in window
  avgCostPerTurnUsd: number;
  tokensIn: number;
  tokensOut: number;
}

export function agenticTotalsSince(iso: string): AgenticTotals {
  const spend = db
    .prepare(
      `SELECT
         COUNT(DISTINCT run_id) AS turns,
         COALESCE(SUM(cost_usd), 0) AS totalCostUsd,
         COALESCE(SUM(tokens_in), 0) AS tokensIn,
         COALESCE(SUM(tokens_out), 0) AS tokensOut
       FROM cost_events
       WHERE task_kind = 'agentic' AND ts >= ?`
    )
    .get(iso) as { turns: number; totalCostUsd: number; tokensIn: number; tokensOut: number };

  const tools = db
    .prepare(
      `SELECT
         COUNT(*) AS toolCalls,
         SUM(is_error) AS erroredToolCalls,
         SUM(queued) AS queuedToolCalls
       FROM tool_calls
       WHERE ts >= ?`
    )
    .get(iso) as { toolCalls: number; erroredToolCalls: number; queuedToolCalls: number };

  const turns = Number(spend.turns) || 0;
  const totalCost = Number(spend.totalCostUsd) || 0;
  return {
    turns,
    toolCalls: Number(tools.toolCalls) || 0,
    erroredToolCalls: Number(tools.erroredToolCalls) || 0,
    queuedToolCalls: Number(tools.queuedToolCalls) || 0,
    totalCostUsd: totalCost,
    avgCostPerTurnUsd: turns > 0 ? totalCost / turns : 0,
    tokensIn: Number(spend.tokensIn) || 0,
    tokensOut: Number(spend.tokensOut) || 0,
  };
}

/**
 * Average cost for a given skill across its runs. Reads cost_events rows
 * attributed to `skill` — useful for "average cost of a research task" etc.
 */
export function avgCostPerSkillRun(skill: string, sinceIso?: string): {
  skill: string;
  runs: number;
  totalCostUsd: number;
  avgCostUsd: number;
} {
  const since = sinceIso ?? new Date(Date.now() - 30 * 86400_000).toISOString();
  const perRun = db
    .prepare(
      `SELECT run_id, SUM(cost_usd) AS runCost
       FROM cost_events
       WHERE skill = ? AND ts >= ? AND run_id IS NOT NULL
       GROUP BY run_id`
    )
    .all(skill, since) as Array<{ run_id: string; runCost: number }>;
  const runs = perRun.length;
  const total = perRun.reduce((s, r) => s + (Number(r.runCost) || 0), 0);
  return {
    skill,
    runs,
    totalCostUsd: total,
    avgCostUsd: runs > 0 ? total / runs : 0,
  };
}

export function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
