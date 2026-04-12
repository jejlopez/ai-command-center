import type { FastifyInstance } from "fastify";
import { recordFeedback, listFeedback, feedbackStatsForSkill } from "../lib/feedback.js";
import { recordRouting, routingStats } from "../lib/router_learning.js";
import { learnedRoute } from "../lib/router_learning.js";
import type { CreateFeedbackBody } from "../../../shared/types.js";

export async function feedbackRoutes(app: FastifyInstance) {
  app.post<{ Body: CreateFeedbackBody }>("/feedback", async (req, reply) => {
    const { runId, kind, rating, reason } = req.body as CreateFeedbackBody;
    if (!kind || !rating) return reply.code(400).send({ error: "kind and rating required" });
    const entry = recordFeedback({ runId, kind, rating, reason });

    if (runId) {
      try {
        const { db } = await import("../db/db.js");
        const run = db.prepare("SELECT * FROM skill_runs WHERE id = ?").get(runId) as any;
        if (run) {
          const lastRouting = db.prepare(
            "SELECT * FROM routing_history ORDER BY created_at DESC LIMIT 1"
          ).get() as any;
          if (lastRouting && lastRouting.model) {
            recordRouting({
              taskKind: lastRouting.task_kind,
              provider: lastRouting.provider,
              model: lastRouting.model,
              success: rating !== "negative",
              feedbackRating: rating,
              costUsd: lastRouting.cost_usd,
              durationMs: lastRouting.duration_ms,
            });
          }
        }
      } catch { /* best-effort */ }
    }

    return entry;
  });

  app.get("/feedback", async (req) => {
    const { kind, limit } = req.query as any;
    return listFeedback({ kind, limit: limit ? Number(limit) : undefined });
  });

  app.get<{ Params: { skill: string } }>("/feedback/stats/:skill", async (req) => {
    return feedbackStatsForSkill((req.params as any).skill);
  });

  app.get("/routing/stats", async (req) => {
    const { taskKind } = req.query as any;
    return routingStats(taskKind);
  });

  app.post<{ Body: { kind?: string } }>("/routing/explain", async (req) => {
    const { kind } = req.body as any;
    return learnedRoute({ kind: kind ?? "chat" });
  });
}
