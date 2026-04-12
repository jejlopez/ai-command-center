import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { episodic, type EpisodicKind } from "../lib/episodic.js";

const ListQuery = z.object({
  kind: z.enum(["brief", "approval", "skill_run", "remember", "custom"]).optional(),
  since: z.string().optional(),
  limit: z.coerce.number().min(1).max(500).optional(),
});

export async function episodicRoutes(app: FastifyInstance): Promise<void> {
  app.get("/episodic", async (req, reply) => {
    const parsed = ListQuery.safeParse(req.query);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.message };
    }
    return episodic.list({
      kind: parsed.data.kind as EpisodicKind | undefined,
      since: parsed.data.since,
      limit: parsed.data.limit,
    });
  });

  app.get<{ Params: { id: string } }>("/episodic/:id", async (req, reply) => {
    const snap = episodic.get(req.params.id);
    if (!snap) {
      reply.code(404);
      return { error: "not found" };
    }
    return snap;
  });
}
