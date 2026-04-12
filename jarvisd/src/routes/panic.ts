// Panic route — emergency lockdown endpoint.

import type { FastifyInstance } from "fastify";
import { panic } from "../lib/panic.js";

export async function panicRoutes(app: FastifyInstance): Promise<void> {
  // POST /panic — trigger emergency lockdown.
  app.post<{ Body: { reason?: string } }>("/panic", async (req) => {
    const reason = (req.body as any)?.reason;
    return panic(reason);
  });
}
