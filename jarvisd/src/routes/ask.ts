import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AskResponse } from "../../../shared/types.js";
import { vault } from "../lib/vault.js";
import { route, estimateCostUsd, type TaskKind, type Privacy } from "../lib/router.js";
import { callAnthropic } from "../lib/providers/anthropic.js";
import { callOllama } from "../lib/providers/ollama.js";
import { assertBudgetAvailable, recordCost, spentTodayUsd, dailyBudgetUsd } from "../lib/cost.js";
import { audit } from "../lib/audit.js";

const AskBody = z.object({
  prompt: z.string().min(1),
  context: z.string().optional(),
  privacy: z.enum(["public", "personal", "sensitive", "secret"]).optional(),
  kind: z
    .enum([
      "classification",
      "extraction",
      "summary",
      "routine_code",
      "complex_reasoning",
      "long_context",
      "high_risk",
      "vision",
      "chat",
    ])
    .optional(),
});

export async function askRoutes(app: FastifyInstance): Promise<void> {
  app.get("/cost/today", async () => ({
    spentUsd: spentTodayUsd(),
    budgetUsd: dailyBudgetUsd(),
  }));

  app.post("/ask", async (req, reply): Promise<AskResponse | { error: string }> => {
    const parsed = AskBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.message };
    }

    try {
      assertBudgetAvailable();
    } catch (err: any) {
      reply.code(402);
      return { error: err.message };
    }

    const { prompt, context, privacy, kind } = parsed.data;
    const decision = route({
      kind: kind as TaskKind | undefined,
      privacy: privacy as Privacy | undefined,
    });

    // Only cloud providers need a key from the vault.
    if (decision.provider !== "ollama" && vault.isLocked()) {
      reply.code(423);
      return { error: "vault locked — needed for cloud provider API key" };
    }

    const runId = randomUUID();
    audit({
      actor: "user",
      action: "ask",
      subject: runId,
      metadata: { kind, privacy, model: decision.model, reason: decision.reason },
    });

    if (decision.provider !== "anthropic" && decision.provider !== "ollama") {
      reply.code(501);
      return { error: `provider ${decision.provider} not yet wired` };
    }

    try {
      const result =
        decision.provider === "ollama"
          ? await callOllama({ model: decision.model, prompt, system: context })
          : await callAnthropic({ model: decision.model, prompt, system: context });
      const costUsd = estimateCostUsd(decision.model, result.tokensIn, result.tokensOut);
      recordCost({
        provider: decision.provider,
        model: decision.model,
        taskKind: kind,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        costUsd,
        runId,
      });
      audit({
        actor: "system",
        action: "ask.complete",
        subject: runId,
        metadata: { tokensIn: result.tokensIn, tokensOut: result.tokensOut, costUsd },
      });
      return {
        id: runId,
        text: result.text,
        model: decision.model,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        costUsd,
      };
    } catch (err: any) {
      audit({ actor: "system", action: "ask.fail", subject: runId, reason: err.message });
      reply.code(500);
      return { error: err.message };
    }
  });
}
