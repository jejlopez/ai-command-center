import { db } from "../db/db.js";
import { config } from "./config.js";

export interface CostEvent {
  provider: string;
  model: string;
  taskKind?: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  skill?: string;
  runId?: string;
}

export function recordCost(evt: CostEvent): void {
  db.prepare(
    `INSERT INTO cost_events(ts, model, provider, task_kind, tokens_in, tokens_out, cost_usd, skill, run_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    new Date().toISOString(),
    evt.model,
    evt.provider,
    evt.taskKind ?? null,
    evt.tokensIn,
    evt.tokensOut,
    evt.costUsd,
    evt.skill ?? null,
    evt.runId ?? null
  );
}

export function spentTodayUsd(): number {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const row = db
    .prepare("SELECT COALESCE(SUM(cost_usd), 0) AS total FROM cost_events WHERE ts >= ?")
    .get(since.toISOString()) as { total: number };
  return row.total;
}

export function dailyBudgetUsd(): number {
  try {
    return config.get().dailyBudgetUsd;
  } catch {
    return 20;
  }
}

export function assertBudgetAvailable(): void {
  const spent = spentTodayUsd();
  const budget = dailyBudgetUsd();
  if (spent >= budget) {
    throw new Error(`daily budget exceeded: $${spent.toFixed(2)} / $${budget}`);
  }
}
