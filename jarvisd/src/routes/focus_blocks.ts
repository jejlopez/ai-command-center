import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { focusBlocks } from "../lib/focus_blocks.js";

const CreateBody = z.object({
  title: z.string().min(1),
  start: z.string().min(1),
  end: z.string().min(1),
  notes: z.string().optional(),
});

const ListQuery = z.object({
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "day must be YYYY-MM-DD")
    .optional(),
});

function localDayIso(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export async function focusBlocksRoutes(app: FastifyInstance): Promise<void> {
  app.get("/focus-blocks", async (req, reply) => {
    const parsed = ListQuery.safeParse(req.query);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.message };
    }
    const day = parsed.data.day ?? localDayIso();
    return focusBlocks.list(day);
  });

  app.post("/focus-blocks", async (req, reply) => {
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.message };
    }
    const { start, end } = parsed.data;
    const startMs = Date.parse(start);
    const endMs = Date.parse(end);
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      reply.code(400);
      return { error: "start and end must be ISO timestamps" };
    }
    if (!(startMs < endMs)) {
      reply.code(400);
      return { error: "start must be before end" };
    }
    return focusBlocks.create(parsed.data);
  });

  app.delete<{ Params: { id: string } }>(
    "/focus-blocks/:id",
    async (req, reply) => {
      const ok = focusBlocks.delete(req.params.id);
      if (!ok) {
        reply.code(404);
        return { error: "not found" };
      }
      return { ok: true };
    }
  );
}
