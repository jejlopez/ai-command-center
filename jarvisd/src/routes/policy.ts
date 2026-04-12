import type { FastifyInstance } from "fastify";
import { policyEngine } from "../lib/policy.js";

export async function policyRoutes(app: FastifyInstance) {
  app.get("/policy/rules", async () => policyEngine.listRules());

  app.post("/policy/rules", async (req) => {
    const rule = req.body as any;
    if (!rule?.id || !rule?.name || !rule?.effect) {
      return { error: "id, name, and effect are required" };
    }
    policyEngine.addRule(rule);
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>("/policy/rules/:id", async (req) => {
    const removed = policyEngine.removeRule((req.params as any).id);
    return { ok: removed };
  });
}
