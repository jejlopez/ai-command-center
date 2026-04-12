import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { approvals } from "../lib/approvals.js";

const EnqueueBody = z.object({
  title: z.string().min(1),
  reason: z.string().min(1),
  skill: z.string().min(1),
  riskLevel: z.enum(["low", "medium", "high"]),
  payload: z.record(z.unknown()),
});

const DecideBody = z.object({
  decision: z.enum(["approve", "deny"]),
  reason: z.string().optional(),
});

export async function approvalsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/approvals", async () => approvals.pending());

  app.post("/approvals", async (req, reply) => {
    const parsed = EnqueueBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.message };
    }
    return approvals.enqueue(parsed.data);
  });

  app.get<{ Params: { id: string } }>("/approvals/:id", async (req, reply) => {
    const a = approvals.get(req.params.id);
    if (!a) {
      reply.code(404);
      return { error: "not found" };
    }
    return a;
  });

  app.post<{ Params: { id: string } }>("/approvals/:id/decide", async (req, reply) => {
    const parsed = DecideBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.message };
    }
    const result = await approvals.decide(req.params.id, parsed.data.decision, parsed.data.reason);
    if (!result.ok) {
      reply.code(400);
      return result;
    }
    return result;
  });
}
