import type { FastifyInstance } from "fastify";
import { recordEdit, recordSnooze, snoozeStats, bestTimeForEvent } from "../lib/learning.js";

export async function learningRoutes(app: FastifyInstance) {
  // Record an edit to a JARVIS output
  app.post("/learning/edit", async (req, reply) => {
    const { outputId, original, edited } = req.body as any;
    if (!outputId || !original || !edited) {
      return reply.code(400).send({ error: "outputId, original, edited required" });
    }
    recordEdit(outputId, original, edited);
    return { ok: true };
  });

  // Record a snooze/dismiss/act on an item
  app.post("/learning/snooze", async (req, reply) => {
    const { itemType, itemId, action, delayMs } = req.body as any;
    if (!itemType || !itemId || !action) {
      return reply.code(400).send({ error: "itemType, itemId, action required" });
    }
    recordSnooze(itemType, itemId, action, delayMs);
    return { ok: true };
  });

  // Get snooze stats
  app.get("/learning/snooze/stats", async (req) => {
    const { itemType } = req.query as any;
    return snoozeStats(itemType);
  });

  // Get best time for an event type
  app.get("/learning/timing", async (req) => {
    const { eventType } = req.query as any;
    if (!eventType) return { error: "eventType required" };
    return bestTimeForEvent(eventType);
  });
}
