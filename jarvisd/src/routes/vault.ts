import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { vault } from "../lib/vault.js";

const SetBody = z.object({
  key: z.string().min(1),
  value: z.string(),
});

export async function vaultRoutes(app: FastifyInstance): Promise<void> {
  app.get("/vault/status", async () => ({
    exists: vault.exists(),
    locked: vault.isLocked(),
  }));

  app.post("/vault/unlock", async (_req, reply) => {
    try {
      await vault.unlock();
      return { ok: true, locked: false };
    } catch (err: any) {
      reply.code(401);
      return { ok: false, error: err.message };
    }
  });

  app.post("/vault/lock", async () => {
    vault.lock();
    return { ok: true, locked: true };
  });

  app.get("/vault/list", async (_req, reply) => {
    if (vault.isLocked()) {
      reply.code(423);
      return { error: "vault locked" };
    }
    return { keys: vault.list() };
  });

  app.get<{ Params: { key: string } }>("/vault/get/:key", async (req, reply) => {
    if (vault.isLocked()) {
      reply.code(423);
      return { error: "vault locked" };
    }
    const value = vault.get(req.params.key);
    if (value === null) {
      reply.code(404);
      return { error: "not found" };
    }
    return { key: req.params.key, value };
  });

  app.post("/vault/set", async (req, reply) => {
    if (vault.isLocked()) {
      reply.code(423);
      return { error: "vault locked" };
    }
    const parsed = SetBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.issues };
    }
    vault.set(parsed.data.key, parsed.data.value);
    return { ok: true };
  });

  app.delete<{ Params: { key: string } }>("/vault/delete/:key", async (req, reply) => {
    if (vault.isLocked()) {
      reply.code(423);
      return { error: "vault locked" };
    }
    const removed = vault.delete(req.params.key);
    return { ok: removed };
  });

  // Recovery phrase — only works when vault is unlocked
  app.post("/vault/recovery/generate", async (_req, reply) => {
    if (vault.isLocked()) {
      reply.code(423);
      return { error: "vault locked" };
    }
    try {
      const phrase = await vault.getRecoveryPhrase();
      return { ok: true, phrase };
    } catch (err: any) {
      reply.code(500);
      return { error: err.message };
    }
  });

  // Rescue — works even when vault is locked (that's the point)
  app.post("/vault/rescue", async (req, reply) => {
    const { phrase } = req.body as any;
    if (!phrase || typeof phrase !== "string") {
      reply.code(400);
      return { error: "phrase is required" };
    }
    try {
      await vault.rescue(phrase);
      return { ok: true, locked: false };
    } catch (err: any) {
      reply.code(401);
      return { ok: false, error: err.message };
    }
  });
}
