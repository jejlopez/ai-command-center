// Manual agentic tool-use loop.
//
// Drives Claude through the streaming messages API, dispatches tool_use blocks
// to the local tool registry, appends tool_result blocks, and loops until the
// model ends its turn (or we hit the iteration cap). Emits structured events
// so upstream code (SSE endpoint, tests) can observe text deltas + tool calls
// as they happen.

import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import { getAnthropicClient } from "./providers/anthropic.js";
import { buildAnthropicToolList, findCustomTool } from "./tools/index.js";
import { audit } from "./audit.js";
import { recordCost, assertBudgetAvailable } from "./cost.js";
import { recordRouting } from "./router_learning.js";
import { estimateCostUsd, route } from "./router.js";
import { recordToolCall } from "./tool_stats.js";

const DEFAULT_MAX_ITERATIONS = 10;
const DEFAULT_MAX_TOKENS_PER_CALL = 16_000;

type MessageParam = Anthropic.MessageParam;

export interface AgenticRunOptions {
  runId?: string;
  userPrompt: string;
  system?: string;
  model?: string;
  maxIterations?: number;
  maxTokensPerCall?: number;
  /** Prior assistant/user turns (e.g. from a resumed conversation). */
  priorMessages?: MessageParam[];
  /** Streaming callback. Text deltas fire-and-forget; iteration boundaries awaited. */
  onEvent?: (evt: AgenticEvent) => void | Promise<void>;
  /** Test-only: inject a pre-configured Anthropic client (skips vault lookup). */
  client?: Anthropic;
  /**
   * When this signal fires, the loop stops between iterations and the
   * in-flight model call is cancelled by the SDK. Wired to req.raw.on("close")
   * in /ask/stream so client disconnects don't burn tokens.
   */
  signal?: AbortSignal;
}

export type AgenticEvent =
  | { type: "iteration_start"; iteration: number; model: string }
  | { type: "text_delta"; text: string }
  | { type: "tool_use_start"; id: string; name: string; input: unknown; iteration: number }
  | {
      type: "tool_use_result";
      id: string;
      name: string;
      content: string;
      isError: boolean;
      queued?: boolean;
      approvalId?: string;
    }
  | {
      type: "iteration_end";
      iteration: number;
      stopReason: string;
      tokensIn: number;
      tokensOut: number;
      costUsd: number;
    }
  | {
      type: "done";
      text: string;
      stopReason: string;
      iterations: number;
      totalCostUsd: number;
      pendingApprovals: string[];
    }
  | { type: "aborted"; iterations: number; totalCostUsd: number }
  | { type: "error"; message: string };

export interface AgenticToolCall {
  name: string;
  iteration: number;
  approvalId?: string;
  isError: boolean;
}

export interface AgenticRunResult {
  text: string;
  stopReason: string;
  iterations: number;
  toolCalls: AgenticToolCall[];
  pendingApprovals: string[];
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  model: string;
  maxIterationsReached: boolean;
}

function supportsAdaptiveThinking(model: string): boolean {
  return model.startsWith("claude-opus-4-") || model === "claude-sonnet-4-6";
}

function extractText(content: readonly Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/**
 * Run a single user turn through the agentic loop.
 *
 * Iteration lifecycle per loop pass:
 *   1. Check daily budget (throws BudgetExceededError if over).
 *   2. Stream `messages.create` with the full tool list.
 *   3. Record cost + routing, emit iteration_end event.
 *   4. Branch on stop_reason:
 *      - end_turn / refusal / max_tokens / stop_sequence → return
 *      - pause_turn → re-send to continue the server-side tool (e.g. web_search)
 *      - tool_use → dispatch each tool_use block, append tool_result blocks, loop
 */
export async function runAgenticTurn(opts: AgenticRunOptions): Promise<AgenticRunResult> {
  const runId = opts.runId ?? randomUUID();
  const maxIter = opts.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const maxTokens = opts.maxTokensPerCall ?? DEFAULT_MAX_TOKENS_PER_CALL;

  // Option 3 hybrid routing: agentic always goes to the direct Anthropic API.
  // route({kind: "agentic"}) is hard-coded to provider="anthropic" in router.ts.
  const decision = opts.model
    ? { provider: "anthropic" as const, model: opts.model, reason: "caller override" }
    : route({ kind: "agentic" });
  const model = decision.model;

  const emit = opts.onEvent ?? (() => {});
  const client = opts.client ?? getAnthropicClient();
  const tools = buildAnthropicToolList();

  const messages: MessageParam[] = [
    ...(opts.priorMessages ?? []),
    { role: "user", content: opts.userPrompt },
  ];

  audit({
    actor: "agentic",
    action: "agentic.start",
    subject: runId,
    metadata: { model, maxIter, priorMessageCount: opts.priorMessages?.length ?? 0 },
  });

  const toolCalls: AgenticToolCall[] = [];
  const pendingApprovals: string[] = [];
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let totalCostUsd = 0;
  let iter = 0;
  let stopReason = "end_turn";
  let finalText = "";
  let maxIterReached = false;

  while (iter < maxIter) {
    // Check abort before starting the next iteration — prevents a new Claude
    // call after client disconnect.
    if (opts.signal?.aborted) {
      stopReason = "aborted";
      audit({ actor: "agentic", action: "agentic.aborted", subject: runId, metadata: { iterations: iter, reason: "before_iteration" } });
      break;
    }
    iter++;

    try {
      assertBudgetAvailable();
    } catch (err: any) {
      await emit({ type: "error", message: err.message });
      audit({ actor: "agentic", action: "agentic.budget.block", subject: runId, reason: err.message });
      throw err;
    }

    await emit({ type: "iteration_start", iteration: iter, model });

    const callStart = Date.now();
    const streamParams: Anthropic.MessageStreamParams = {
      model,
      max_tokens: maxTokens,
      tools,
      messages,
    };
    if (opts.system) streamParams.system = opts.system;
    if (supportsAdaptiveThinking(model)) {
      // Adaptive thinking is the only supported thinking mode on Opus 4.7 and
      // the recommended mode on Sonnet 4.6 / Opus 4.6. We don't set `display`
      // — default ("omitted" on 4.7) is fine since we don't surface thinking
      // content to the UI in Phase 1.
      (streamParams as any).thinking = { type: "adaptive" };
    }

    let finalMessage: Anthropic.Message;
    try {
      // Pass the abort signal via RequestOptions so the SDK tears down the
      // HTTP connection when abort fires mid-stream.
      const stream = opts.signal
        ? client.messages.stream(streamParams, { signal: opts.signal })
        : client.messages.stream(streamParams);
      stream.on("text", (delta: string) => {
        // Fire-and-forget; text deltas are high-frequency.
        void emit({ type: "text_delta", text: delta });
      });
      finalMessage = await stream.finalMessage();
    } catch (err: any) {
      // Treat AbortError as a non-fatal graceful cancellation — no error to
      // surface to the caller, just break the loop and mark aborted.
      const isAbort =
        opts.signal?.aborted ||
        err?.name === "AbortError" ||
        /abort/i.test(err?.message ?? "");
      if (isAbort) {
        stopReason = "aborted";
        audit({ actor: "agentic", action: "agentic.aborted", subject: runId, metadata: { iterations: iter, reason: "during_stream" } });
        break;
      }
      // Audit here; let the caller decide how to surface the error to clients
      // (the /ask/stream route emits a single "error" event on catch). Emitting
      // from both places produced duplicate error events in the SSE stream.
      audit({ actor: "agentic", action: "agentic.stream.fail", subject: runId, reason: err?.message });
      throw err;
    }

    const durationMs = Date.now() - callStart;
    const tokensIn = finalMessage.usage.input_tokens ?? 0;
    const tokensOut = finalMessage.usage.output_tokens ?? 0;
    const costUsd = estimateCostUsd(model, tokensIn, tokensOut);
    totalTokensIn += tokensIn;
    totalTokensOut += tokensOut;
    totalCostUsd += costUsd;
    stopReason = finalMessage.stop_reason ?? "unknown";

    recordCost({
      provider: "anthropic",
      model,
      taskKind: "agentic",
      tokensIn,
      tokensOut,
      costUsd,
      skill: "agentic",
      runId,
    });
    try {
      recordRouting({
        taskKind: "agentic",
        provider: "anthropic",
        model,
        success: stopReason !== "refusal",
        costUsd,
        durationMs,
      });
    } catch {
      /* best-effort */
    }

    await emit({
      type: "iteration_end",
      iteration: iter,
      stopReason,
      tokensIn,
      tokensOut,
      costUsd,
    });

    // Preserve the full assistant content — tool_use blocks must survive for
    // the next turn's tool_result references to resolve.
    messages.push({ role: "assistant", content: finalMessage.content });
    finalText = extractText(finalMessage.content);

    // Terminal stop reasons — stop the loop.
    if (
      stopReason === "end_turn" ||
      stopReason === "refusal" ||
      stopReason === "max_tokens" ||
      stopReason === "stop_sequence"
    ) {
      break;
    }

    // Server-side tool (web_search) hit its iteration cap. Re-send to resume.
    if (stopReason === "pause_turn") {
      audit({ actor: "agentic", action: "agentic.pause_turn", subject: runId, metadata: { iteration: iter } });
      continue;
    }

    // Tool use — execute each tool_use block, append tool_result blocks as a
    // single user message.
    if (stopReason === "tool_use") {
      const toolUseBlocks = finalMessage.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );
      // Defensive: stop_reason=tool_use with zero tool_use blocks would loop
      // forever (we'd never append anything new). Break out with what we have.
      if (toolUseBlocks.length === 0) {
        audit({
          actor: "agentic",
          action: "agentic.tool_use.empty",
          subject: runId,
          metadata: { iteration: iter },
        });
        break;
      }
      const toolResultBlocks: Anthropic.ToolResultBlockParam[] = [];

      for (const block of toolUseBlocks) {
        const def = findCustomTool(block.name);
        if (!def) {
          const msg = `Tool "${block.name}" is not a registered local tool.`;
          audit({
            actor: "agentic",
            action: "agentic.tool.unknown",
            subject: runId,
            metadata: { name: block.name },
          });
          toolResultBlocks.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: msg,
            is_error: true,
          });
          toolCalls.push({ name: block.name, iteration: iter, isError: true });
          await emit({
            type: "tool_use_result",
            id: block.id,
            name: block.name,
            content: msg,
            isError: true,
          });
          continue;
        }

        await emit({
          type: "tool_use_start",
          id: block.id,
          name: block.name,
          input: block.input,
          iteration: iter,
        });
        audit({
          actor: "agentic",
          action: "agentic.tool.start",
          subject: runId,
          metadata: {
            name: block.name,
            toolUseId: block.id,
            iteration: iter,
            requiresApproval: def.requiresApproval,
          },
        });

        const toolStart = Date.now();
        let content: string;
        let isError = false;
        let approvalId: string | undefined;
        let queued = false;
        let toolCostUsd = 0;
        try {
          const result = await def.run(block.input, {
            runId,
            log: (msg, meta) =>
              audit({
                actor: "agentic",
                action: "agentic.tool.log",
                subject: runId,
                metadata: { tool: block.name, msg, ...meta },
              }),
          });
          content = result.content;
          isError = !!result.isError;
          approvalId = result.approvalId;
          queued = !!result.queued;
          toolCostUsd = result.costUsd ?? 0;
          if (approvalId) pendingApprovals.push(approvalId);
        } catch (err: any) {
          // ZodError or tool runtime error. The tool result tells Claude what
          // went wrong so it can retry with corrected input or back off.
          content = `Tool error: ${err?.message ?? String(err)}`;
          isError = true;
          audit({
            actor: "agentic",
            action: "agentic.tool.fail",
            subject: runId,
            reason: err?.message,
            metadata: { name: block.name },
          });
        }

        toolResultBlocks.push({
          type: "tool_result",
          tool_use_id: block.id,
          content,
          is_error: isError,
        });
        toolCalls.push({ name: block.name, iteration: iter, approvalId, isError });

        // Attribute sub-call cost incurred by the tool to the agentic run.
        // (Task #7 will split this finer; for now we log it here.)
        if (toolCostUsd > 0) {
          recordCost({
            provider: "tool",
            model: block.name,
            taskKind: "agentic",
            tokensIn: 0,
            tokensOut: 0,
            costUsd: toolCostUsd,
            skill: `agent:${block.name}`,
            runId,
          });
          totalCostUsd += toolCostUsd;
        }

        const durationMs = Date.now() - toolStart;
        audit({
          actor: "agentic",
          action: "agentic.tool.end",
          subject: runId,
          metadata: {
            name: block.name,
            toolUseId: block.id,
            durationMs,
            isError,
            queued,
            approvalId,
          },
        });

        // Per-tool attribution row for /cost/tools analytics
        try {
          recordToolCall({
            runId,
            iteration: iter,
            toolName: block.name,
            durationMs,
            isError,
            queued,
            approvalId,
            costUsd: toolCostUsd,
          });
        } catch {
          /* best-effort — never block the loop on stats */
        }

        await emit({
          type: "tool_use_result",
          id: block.id,
          name: block.name,
          content,
          isError,
          queued,
          approvalId,
        });
      }

      messages.push({ role: "user", content: toolResultBlocks });
      continue;
    }

    // Unknown stop_reason — log and bail to avoid an infinite loop.
    audit({
      actor: "agentic",
      action: "agentic.unknown_stop_reason",
      subject: runId,
      metadata: { stopReason },
    });
    break;
  }

  // If we exited the loop because we hit the cap while still in tool_use state,
  // flag that explicitly so callers can surface it to the user.
  if (iter >= maxIter && stopReason === "tool_use") {
    maxIterReached = true;
    stopReason = "max_iterations";
    audit({ actor: "agentic", action: "agentic.max_iterations", subject: runId, metadata: { iter } });
  }

  if (stopReason === "aborted") {
    await emit({ type: "aborted", iterations: iter, totalCostUsd });
  } else {
    await emit({
      type: "done",
      text: finalText,
      stopReason,
      iterations: iter,
      totalCostUsd,
      pendingApprovals,
    });
  }

  audit({
    actor: "agentic",
    action: "agentic.done",
    subject: runId,
    metadata: {
      stopReason,
      iterations: iter,
      tokensIn: totalTokensIn,
      tokensOut: totalTokensOut,
      costUsd: totalCostUsd,
      toolCalls: toolCalls.length,
      pendingApprovals: pendingApprovals.length,
    },
  });

  return {
    text: finalText,
    stopReason,
    iterations: iter,
    toolCalls,
    pendingApprovals,
    tokensIn: totalTokensIn,
    tokensOut: totalTokensOut,
    costUsd: totalCostUsd,
    model,
    maxIterationsReached: maxIterReached,
  };
}
