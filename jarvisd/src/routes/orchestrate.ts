import type { FastifyInstance } from "fastify";
import { orchestrate, dispatch } from "../lib/orchestrator.js";

export async function orchestrateRoutes(app: FastifyInstance) {
  // Full orchestration — multi-step plan
  app.post("/orchestrate", async (req, reply) => {
    const { goal, steps, budgetUsd } = req.body as any;
    if (!goal || !steps || !Array.isArray(steps)) {
      return reply.code(400).send({ error: "goal and steps[] required" });
    }
    const plan = await orchestrate({ goal, steps, budgetUsd });
    return plan;
  });

  // Quick single-skill dispatch
  app.post("/dispatch", async (req, reply) => {
    const { skill, instruction, payload, budgetUsd } = req.body as any;
    if (!skill || !instruction) {
      return reply.code(400).send({ error: "skill and instruction required" });
    }
    const result = await dispatch(skill, instruction, payload ?? {}, budgetUsd);
    return result;
  });
}
