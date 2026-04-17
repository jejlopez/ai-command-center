import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AskResponse } from "../../../shared/types.js";
import { vault } from "../lib/vault.js";
import { route, estimateCostUsd, type TaskKind, type Privacy } from "../lib/router.js";
import { callAnthropic } from "../lib/providers/anthropic.js";
import { callOllama } from "../lib/providers/ollama.js";
import { callClaudeCli } from "../lib/providers/claude_cli.js";
import { callWithWebSearch } from "../lib/providers/web_search.js";
import { JARVIS_SYSTEM_PROMPT } from "../lib/jarvis_system_prompt.js";
import { gatherContext, detectSkillIntent } from "../lib/context_gatherer.js";
import { runSkill } from "../lib/workflow.js";
import { registry } from "../lib/skills.js";
import { parseActions, stripActionBlocks, executeActions } from "../lib/action_executor.js";
import { assertBudgetAvailable, recordCost, spentTodayUsd, dailyBudgetUsd } from "../lib/cost.js";
import { audit } from "../lib/audit.js";
import { tagText, sensitivityToPrivacy } from "../lib/tagger.js";
import { policyEngine } from "../lib/policy.js";
import { sanitizeForContext } from "../lib/sanitize.js";

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
      "web_search",
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

    const { prompt: rawPrompt, context: rawContext, privacy, kind } = parsed.data;

    // --- Red Team: sanitize external input for prompt injection ---
    const { clean: prompt, stripped } = sanitizeForContext(rawPrompt);
    const context = rawContext ? sanitizeForContext(rawContext).clean : undefined;
    if (stripped.length > 0) {
      audit({
        actor: "user",
        action: "prompt_injection.filtered",
        metadata: { stripped, originalLength: rawPrompt.length },
      });
    }

    // Gather live data relevant to the user's question
    const liveContext = await gatherContext(prompt);

    // Check if user wants to run a specific skill
    let skillContext = "";
    const skillIntent = detectSkillIntent(prompt);
    if (skillIntent && registry.get(skillIntent.skill)) {
      try {
        const skillResult = await runSkill(skillIntent.skill, {
          inputs: skillIntent.args,
          triggeredBy: "manual",
        });
        if (skillResult) {
          const resultStr = typeof skillResult === "string" ? skillResult : JSON.stringify(skillResult, null, 2);
          skillContext = `\n\n--- SKILL RESULT (${skillIntent.skill}) ---\n${resultStr.slice(0, 2000)}\nUse this data to answer the user naturally. Do not dump raw JSON.`;
        }
      } catch {}
    }

    // Inject JARVIS system prompt + live data + skill result
    const systemPrompt = JARVIS_SYSTEM_PROMPT + liveContext + skillContext + (context ? `\n\n${context}` : "");

    // --- Shield Protocol: tag prompt for PII/secrets, escalate privacy ---
    const tag = tagText(prompt + (systemPrompt ?? ""));
    const effectivePrivacy = sensitivityToPrivacy(tag.level, privacy) as Privacy;

    let decision = route({
      kind: kind as TaskKind | undefined,
      privacy: effectivePrivacy,
    });

    // --- Shield Protocol: policy engine check ---
    const policyCheck = await policyEngine.beforeRoute({
      kind,
      privacy: effectivePrivacy,
      provider: decision.provider,
      model: decision.model,
    });
    if (policyCheck.effect === "deny") {
      decision = {
        provider: "ollama" as const,
        model: "jarvis:latest",
        reason: `Policy denied: ${policyCheck.reason} — forced local`,
      };
    }

    // CLI doesn't need vault, but API providers do.
    if (decision.provider !== "ollama" && decision.provider !== "claude-cli" && vault.isLocked()) {
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

    if (!["anthropic", "ollama", "claude-cli"].includes(decision.provider)) {
      reply.code(501);
      return { error: `provider ${decision.provider} not yet wired` };
    }

    // Always enable web search — let Claude decide when to use it
    const needsWeb = true;

    try {
      let result;
      if (decision.provider === "claude-cli") {
        result = await callClaudeCli({ model: decision.model, prompt, system: systemPrompt, allowWebSearch: needsWeb });
      } else if (decision.provider === "ollama") {
        result = await callOllama({ model: decision.model, prompt, system: systemPrompt });
      } else {
        // No API fallback — CLI only. If CLI isn't available, error clearly.
        result = await callClaudeCli({ model: decision.model, prompt, system: systemPrompt, allowWebSearch: needsWeb });
      }
      const costUsd = decision.provider === "claude-cli" ? 0 : estimateCostUsd(decision.model, result.tokensIn, result.tokensOut);
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
      // Parse and execute any action blocks in Claude's response
      const actions = parseActions(result.text);
      let actionResults: any[] = [];
      if (actions.length > 0) {
        actionResults = await executeActions(actions);
        audit({ actor: "jarvis", action: "actions.executed", subject: runId, metadata: { count: actions.length, results: actionResults } });
      }

      const cleanText = actions.length > 0 ? stripActionBlocks(result.text) : result.text;
      const actionSummary = actionResults.length > 0
        ? "\n\n" + actionResults.map(r => `${r.success ? "✓" : "✗"} ${r.message}`).join("\n")
        : "";

      return {
        id: runId,
        text: cleanText + actionSummary,
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
