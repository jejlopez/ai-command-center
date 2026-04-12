// Cost endpoints for the Money surface.
//
// - GET /cost/events   — recent raw cost events (paginated)
// - GET /cost/summary  — today's spend, last 7 days series, top models
//
// Note: GET /cost/today is owned by routes/ask.ts and is left alone.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/db.js";
import { spentTodayUsd, dailyBudgetUsd } from "../lib/cost.js";
import type {
  CostEventRow,
  CostSummary,
  CostSeriesPoint,
} from "../../../shared/types.js";

const EventsQuery = z.object({
  since: z.string().optional(),
  limit: z.coerce.number().min(1).max(500).optional(),
});

function rowToCostEvent(row: any): CostEventRow {
  return {
    id: row.id,
    ts: row.ts,
    provider: row.provider,
    model: row.model,
    taskKind: row.task_kind ?? null,
    tokensIn: row.tokens_in,
    tokensOut: row.tokens_out,
    costUsd: row.cost_usd,
    skill: row.skill ?? null,
    runId: row.run_id ?? null,
  };
}

function localDayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function costRoutes(app: FastifyInstance): Promise<void> {
  app.get("/cost/events", async (req, reply) => {
    const parsed = EventsQuery.safeParse(req.query);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.message };
    }
    const limit = parsed.data.limit ?? 100;
    const clauses: string[] = [];
    const params: any[] = [];
    if (parsed.data.since) {
      clauses.push("ts >= ?");
      params.push(parsed.data.since);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    params.push(limit);
    const rows = db
      .prepare(
        `SELECT id, ts, provider, model, task_kind, tokens_in, tokens_out, cost_usd, skill, run_id
         FROM cost_events ${where}
         ORDER BY ts DESC
         LIMIT ?`
      )
      .all(...params) as any[];
    return rows.map(rowToCostEvent);
  });

  app.get("/cost/summary", async (): Promise<CostSummary> => {
    const today = {
      spentUsd: Number(spentTodayUsd().toFixed(4)),
      budgetUsd: dailyBudgetUsd(),
    };

    // Last 7 days including today — local-day buckets.
    const now = new Date();
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 6
    );
    const startIso = start.toISOString();

    const rows = db
      .prepare(
        `SELECT ts, tokens_in, tokens_out, cost_usd
         FROM cost_events
         WHERE ts >= ?`
      )
      .all(startIso) as Array<{
      ts: string;
      tokens_in: number;
      tokens_out: number;
      cost_usd: number;
    }>;

    const byDay = new Map<string, CostSeriesPoint>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() + i
      );
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
      byDay.set(key, { day: key, costUsd: 0, tokensIn: 0, tokensOut: 0 });
    }
    for (const r of rows) {
      const key = localDayKey(r.ts);
      const bucket = byDay.get(key);
      if (!bucket) continue;
      bucket.costUsd += r.cost_usd;
      bucket.tokensIn += r.tokens_in;
      bucket.tokensOut += r.tokens_out;
    }
    const last7Days = Array.from(byDay.values())
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((p) => ({
        ...p,
        costUsd: Number(p.costUsd.toFixed(6)),
      }));

    // Top 5 models by total cost across all time.
    const topRows = db
      .prepare(
        `SELECT model, SUM(cost_usd) AS cost_usd, COUNT(*) AS runs
         FROM cost_events
         GROUP BY model
         ORDER BY cost_usd DESC
         LIMIT 5`
      )
      .all() as Array<{ model: string; cost_usd: number; runs: number }>;
    const topModels = topRows.map((r) => ({
      model: r.model,
      costUsd: Number((r.cost_usd ?? 0).toFixed(6)),
      runs: r.runs,
    }));

    return { today, last7Days, topModels };
  });
}
