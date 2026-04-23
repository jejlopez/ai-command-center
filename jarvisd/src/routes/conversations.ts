// HTTP surface for conversation history (Phase 2).
//
//   GET    /conversations                     — list, most-recent first
//   GET    /conversations/:id                 — single conversation metadata
//   GET    /conversations/:id/messages        — full history (no truncation)
//   POST   /conversations/:id/clear           — drop all messages, keep session
//   DELETE /conversations/:id                 — drop conversation + messages

import type { FastifyInstance } from "fastify";
import { conversations } from "../lib/conversations.js";

export async function conversationRoutes(app: FastifyInstance): Promise<void> {
  app.get("/conversations", async () => {
    return conversations.list(100);
  });

  app.get<{ Params: { id: string } }>("/conversations/:id", async (req, reply) => {
    const conv = conversations.get(req.params.id);
    if (!conv) {
      reply.code(404);
      return { error: "conversation not found" };
    }
    return conv;
  });

  app.get<{ Params: { id: string } }>(
    "/conversations/:id/messages",
    async (req, reply) => {
      const conv = conversations.get(req.params.id);
      if (!conv) {
        reply.code(404);
        return { error: "conversation not found" };
      }
      return {
        conversation: conv,
        messages: conversations.listAll(req.params.id),
      };
    }
  );

  app.post<{ Params: { id: string } }>(
    "/conversations/:id/clear",
    async (req) => {
      const deleted = conversations.clear(req.params.id);
      return { ok: true, deleted };
    }
  );

  app.delete<{ Params: { id: string } }>(
    "/conversations/:id",
    async (req) => {
      const removed = conversations.delete(req.params.id);
      return { ok: removed };
    }
  );
}
