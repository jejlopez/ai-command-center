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
import { runAgenticTurn } from "../lib/agentic.js";
import { vault as vaultLib } from "../lib/vault.js";
import { conversations, newSessionId } from "../lib/conversations.js";

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

  // --- POST /ask/stream ---------------------------------------------------
  // Agentic SSE endpoint. Drives the tool-use loop from lib/agentic.ts and
  // emits iteration/text/tool events as Server-Sent Events for the UI to
  // render incrementally. Feature-flagged via JARVIS_AGENTIC_LOOP — when
  // unset/"1" it's on; "0" disables and returns 501.
  app.post("/ask/stream", async (req, reply) => {
    const flag = process.env.JARVIS_AGENTIC_LOOP;
    if (flag === "0" || flag === "false") {
      reply.code(501);
      return { error: "agentic loop disabled — use POST /ask" };
    }

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

    if (vaultLib.isLocked()) {
      reply.code(423);
      return { error: "vault locked — needed for Anthropic API key" };
    }

    const { prompt: rawPrompt, context: rawContext } = parsed.data;
    const { clean: prompt, stripped } = sanitizeForContext(rawPrompt);
    const context = rawContext ? sanitizeForContext(rawContext).clean : undefined;
    if (stripped.length > 0) {
      audit({
        actor: "user",
        action: "prompt_injection.filtered",
        metadata: { stripped, originalLength: rawPrompt.length, route: "ask_stream" },
      });
    }

    // Bug #2 fix (Phase 2 Day 3): agentic path no longer injects liveContext.
    // The legacy /ask path still uses it (no tools, no memory there). Here
    // the model has 9 tools + conversation history — it should pull ground
    // truth rather than confabulate around a partial stuffed context. A
    // static system prompt also lets cache_control hit the whole prefix.
    const systemPrompt =
      JARVIS_SYSTEM_PROMPT + (context ? `\n\n${context}` : "");

    // Resolve / mint the session id. Client sends X-Session-Id; if missing
    // (first-ever load) we auto-generate and echo it back so the client can
    // persist it locally.
    const headerSid = (req.headers["x-session-id"] ?? req.headers["X-Session-Id"]) as
      | string
      | undefined;
    let sessionId: string;
    try {
      sessionId =
        headerSid && /^[A-Za-z0-9_-]{8,128}$/.test(headerSid) ? headerSid : newSessionId();
      conversations.getOrCreate(sessionId);
    } catch {
      sessionId = newSessionId();
      conversations.getOrCreate(sessionId);
    }

    const runId = randomUUID();
    audit({
      actor: "user",
      action: "ask_stream",
      subject: runId,
      metadata: { promptLen: prompt.length, sessionId },
    });

    // SSE headers — bypass Fastify's JSON serializer by using reply.raw.
    // Echo the resolved session id so first-time clients learn theirs.
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Session-Id": sessionId,
    });
    // Tell Fastify we've taken over the reply.
    reply.hijack();

    const writeEvent = (payload: unknown) => {
      try {
        reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch {
        /* connection closed — nothing to do */
      }
    };

    // Keep-alive heartbeat (SSE comment) every 15s so intermediary proxies
    // don't drop the connection on long tool runs.
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(`: hb\n\n`);
      } catch {
        clearInterval(heartbeat);
      }
    }, 15_000);

    // Client disconnect → abort the agentic loop so we stop burning tokens.
    // The signal propagates through runAgenticTurn → messages.stream, which
    // tears down the HTTP connection to Anthropic mid-stream.
    //
    // IMPORTANT: only listen on reply.raw ("close" on the ServerResponse).
    // req.raw.on("close") fires the moment Node finishes reading the POST
    // body — a false positive that instantly aborts every request. Phase 1
    // scenario 7 verification showed reply.raw is the one that fires on
    // actual client disconnect, so that's sufficient.
    let clientGone = false;
    const abortCtrl = new AbortController();
    reply.raw.on("close", () => {
      if (clientGone) return;
      clientGone = true;
      abortCtrl.abort();
      clearInterval(heartbeat);
      audit({ actor: "user", action: "ask_stream.client_gone", subject: runId, metadata: { source: "reply.raw" } });
    });

    try {
      const result = await runAgenticTurn({
        runId,
        userPrompt: prompt,
        system: systemPrompt,
        signal: abortCtrl.signal,
        conversationId: sessionId,
        onEvent: (evt) => {
          if (!clientGone) writeEvent(evt);
        },
      });
      if (!clientGone) {
        writeEvent({ type: "result", ...result });
      }
    } catch (err: any) {
      // Abort errors are already swallowed inside runAgenticTurn — this catch
      // is for real failures (auth, network, provider errors).
      if (!clientGone) {
        writeEvent({ type: "error", message: err?.message ?? String(err) });
      }
    } finally {
      clearInterval(heartbeat);
      try {
        reply.raw.end();
      } catch {
        /* ignore */
      }
    }
  });
}
