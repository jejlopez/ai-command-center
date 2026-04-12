import type { FastifyInstance } from "fastify";
import {
  appleStatus,
  getTodayEvents,
  getRecentUnread,
  requestAccess,
} from "../lib/providers/apple.js";

export async function appleRoutes(app: FastifyInstance): Promise<void> {
  app.get("/connectors/apple/status", async () => appleStatus());

  app.post("/connectors/apple/connect", async () => requestAccess());

  app.get("/connectors/apple/calendar/today", async (_req, reply) => {
    try {
      return await getTodayEvents();
    } catch (err: any) {
      reply.code(500);
      return { error: err.message };
    }
  });

  app.get<{ Querystring: { limit?: string } }>(
    "/connectors/apple/mail/unread",
    async (req, reply) => {
      const limit = Math.max(1, Math.min(50, Number(req.query?.limit ?? 10) || 10));
      try {
        return await getRecentUnread(limit);
      } catch (err: any) {
        reply.code(500);
        return { error: err.message };
      }
    }
  );
}
