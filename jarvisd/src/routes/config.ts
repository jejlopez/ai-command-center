import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { vault } from "../lib/vault.js";
import { config } from "../lib/config.js";
import type { JarvisConfig } from "../../../shared/types.js";

const PrivacyDomain = z.enum(["finance", "health", "work", "personal"]);

const PatchBody = z.object({
  dailyBudgetUsd: z.number().nonnegative().optional(),
  currency: z.string().min(1).optional(),
  privacyLocalOnly: z.array(PrivacyDomain).optional(),
  allowedLocalModels: z.array(z.string()).optional(),
  preferredCloudModel: z.string().optional(),
});

export async function configRoutes(app: FastifyInstance): Promise<void> {
  app.get("/config", async (): Promise<JarvisConfig> => {
    return config.get();
  });

  app.post("/config", async (req, reply) => {
    if (vault.isLocked()) {
      reply.code(423);
      return { error: "vault locked" };
    }
    const parsed = PatchBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.issues };
    }
    const body = parsed.data;
    const merged = config.patch(body);
    if (body.privacyLocalOnly !== undefined) {
      vault.set("onboarding.privacy_set", "1");
    }
    if (body.dailyBudgetUsd !== undefined) {
      vault.set("onboarding.budget_set", "1");
    }
    return merged;
  });
}
