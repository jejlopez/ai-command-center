// Router learning — tracks routing outcomes and auto-tunes model selection.
//
// After N consecutive successes at a cheaper model for a task kind, the router
// auto-downgrades. After a negative feedback or failure, it auto-upgrades.
// All decisions are explainable.

import { db } from "../db/db.js";
import { route as staticRoute, PRICING, type TaskKind, type RouteInput, type RouteDecision } from "./router.js";
import type { FeedbackRating, RouteExplanation } from "../../../shared/types.js";

const DOWNGRADE_THRESHOLD = 5;
const UPGRADE_ON_NEGATIVE = true;

const MODEL_TIERS: string[][] = [
  ["jarvis:latest"],
  ["claude-haiku-4-5-20251001"],
  ["claude-sonnet-4-6", "gemini-2.5-pro"],
  ["claude-opus-4-7", "gpt-5"],
];

function tierOf(model: string): number {
  for (let i = 0; i < MODEL_TIERS.length; i++) {
    if (MODEL_TIERS[i].includes(model)) return i;
  }
  return 2; // default mid-tier
}

function cheaperModel(current: string): string | null {
  const tier = tierOf(current);
  if (tier <= 0) return null;
  return MODEL_TIERS[tier - 1][0];
}

function strongerModel(current: string): string | null {
  const tier = tierOf(current);
  if (tier >= MODEL_TIERS.length - 1) return null;
  return MODEL_TIERS[tier + 1][0];
}

function providerForModel(model: string): RouteDecision["provider"] {
  if (model.startsWith("claude")) return "anthropic";
  if (model.startsWith("gpt")) return "openai";
  if (model.startsWith("gemini")) return "google";
  return "ollama";
}

export function recordRouting(opts: {
  taskKind: string;
  provider: string;
  model: string;
  success: boolean;
  feedbackRating?: FeedbackRating;
  costUsd: number;
  durationMs: number;
}): void {
  db.prepare(
    `INSERT INTO routing_history(task_kind, provider, model, success, feedback_rating, cost_usd, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    opts.taskKind,
    opts.provider,
    opts.model,
    opts.success ? 1 : 0,
    opts.feedbackRating ?? null,
    opts.costUsd,
    opts.durationMs,
  );
}

export function consecutiveSuccesses(taskKind: string, model: string): number {
  const rows = db.prepare(
    `SELECT success FROM routing_history
     WHERE task_kind = ? AND model = ?
     ORDER BY created_at DESC LIMIT ?`
  ).all(taskKind, model, DOWNGRADE_THRESHOLD + 1) as any[];

  let count = 0;
  for (const r of rows) {
    if (r.success === 1) count++;
    else break;
  }
  return count;
}

function recentNegativeFeedback(taskKind: string, model: string): boolean {
  const row = db.prepare(
    `SELECT feedback_rating FROM routing_history
     WHERE task_kind = ? AND model = ? AND feedback_rating = 'negative'
     ORDER BY created_at DESC LIMIT 1`
  ).get(taskKind, model) as any;
  if (!row) return false;

  const latest = db.prepare(
    `SELECT feedback_rating FROM routing_history
     WHERE task_kind = ? AND model = ?
     ORDER BY created_at DESC LIMIT 1`
  ).get(taskKind, model) as any;
  return latest?.feedback_rating === "negative";
}

export function learnedRoute(input: RouteInput): RouteExplanation {
  const base = staticRoute(input);
  const kind = input.kind ?? "chat";

  const successes = consecutiveSuccesses(kind, base.model);
  const hasNegative = recentNegativeFeedback(kind, base.model);

  let finalModel = base.model;
  let finalProvider = base.provider;
  let learned: string | undefined;

  if (hasNegative && UPGRADE_ON_NEGATIVE) {
    const stronger = strongerModel(base.model);
    if (stronger) {
      finalModel = stronger;
      finalProvider = providerForModel(stronger);
      learned = `Upgraded from ${base.model} — recent negative feedback`;
    }
  } else if (successes >= DOWNGRADE_THRESHOLD) {
    const cheaper = cheaperModel(base.model);
    if (cheaper) {
      finalModel = cheaper;
      finalProvider = providerForModel(cheaper);
      learned = `Downgraded from ${base.model} — ${successes} consecutive successes at cheaper tier`;
    }
  }

  return {
    provider: finalProvider,
    model: finalModel,
    reason: base.reason,
    learned,
    consecutiveSuccesses: successes,
  };
}

export function routingStats(taskKind?: string): Array<{
  taskKind: string;
  model: string;
  total: number;
  successes: number;
  avgCostUsd: number;
  avgDurationMs: number;
}> {
  const where = taskKind ? "WHERE task_kind = ?" : "";
  const params = taskKind ? [taskKind] : [];
  return db.prepare(
    `SELECT task_kind, model, COUNT(*) as total,
            SUM(success) as successes,
            AVG(cost_usd) as avg_cost,
            AVG(duration_ms) as avg_duration
     FROM routing_history ${where}
     GROUP BY task_kind, model
     ORDER BY total DESC`
  ).all(...params) as any[];
}
