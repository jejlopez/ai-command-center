import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { registry } from "../lib/skills.js";
import { runSkill, listRuns, getRun, listWorkflows } from "../lib/workflow.js";

const RunBody = z.object({
  inputs: z.record(z.unknown()).optional(),
});

const LimitQuery = z.object({
  limit: z.coerce.number().min(1).max(500).optional(),
});

export async function skillsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/skills", async () => registry.list());

  app.get<{ Params: { name: string } }>("/skills/:name", async (req, reply) => {
    const skill = registry.get(req.params.name);
    if (!skill) {
      reply.code(404);
      return { error: "skill not found" };
    }
    return skill.manifest;
  });

  app.post<{ Params: { name: string }; Body: unknown }>(
    "/skills/:name/run",
    async (req, reply) => {
      const skill = registry.get(req.params.name);
      if (!skill) {
        reply.code(404);
        return { error: "skill not found" };
      }
      const parsed = RunBody.safeParse(req.body ?? {});
      if (!parsed.success) {
        reply.code(400);
        return { error: parsed.error.message };
      }
      try {
        const run = await runSkill(req.params.name, {
          inputs: parsed.data.inputs,
          triggeredBy: "manual",
        });
        return run;
      } catch (err: any) {
        reply.code(500);
        return { error: err?.message ?? String(err) };
      }
    }
  );

  app.get<{ Params: { name: string } }>("/skills/:name/runs", async (req, reply) => {
    const skill = registry.get(req.params.name);
    if (!skill) {
      reply.code(404);
      return { error: "skill not found" };
    }
    const parsed = LimitQuery.safeParse(req.query);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.message };
    }
    return listRuns({ skill: req.params.name, limit: parsed.data.limit });
  });

  app.get("/runs", async (req, reply) => {
    const parsed = LimitQuery.safeParse(req.query);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.message };
    }
    return listRuns({ limit: parsed.data.limit });
  });

  app.get<{ Params: { id: string } }>("/runs/:id", async (req, reply) => {
    const run = getRun(req.params.id);
    if (!run) {
      reply.code(404);
      return { error: "run not found" };
    }
    return run;
  });

  app.get("/workflows", async () => listWorkflows());
}
