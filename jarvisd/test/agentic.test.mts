// Sanity tests for the agentic loop (Phase 1 Task #2).
//
// These don't boot the daemon or hit the real Anthropic API. Instead we
// inject a scripted fake client and verify the loop's control flow.
//
// Run with:   npx tsx --test test/agentic.test.mts
//
// The test sets JARVIS_HOME to a temp dir before importing any jarvisd
// modules so the SQLite DB initializes fresh on disk in isolation.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const testHome = mkdtempSync(join(tmpdir(), "jarvisd-agentic-test-"));
process.env.JARVIS_HOME = testHome;
process.env.LOG_LEVEL = "silent";

// Import order matters — db.ts auto-inits from JARVIS_HOME at import time.
const { after, before, test } = await import("node:test");
const assert = (await import("node:assert/strict")).default;
const { runAgenticTurn } = await import("../src/lib/agentic.js");
const { approvals } = await import("../src/lib/approvals.js");
const { toolLeaderboard, agenticTotalsSince, startOfTodayIso } = await import("../src/lib/tool_stats.js");
const { db } = await import("../src/db/db.js");

after(() => {
  try {
    db.close();
  } catch {}
  try {
    rmSync(testHome, { recursive: true, force: true });
  } catch {}
});

// --- Fake Anthropic client ---------------------------------------------------
// Scripts a queue of pre-baked responses and returns them in order.

interface FakeResponse {
  textDeltas?: string[];
  content: Array<
    | { type: "text"; text: string }
    | { type: "tool_use"; id: string; name: string; input: unknown }
  >;
  stop_reason: "end_turn" | "tool_use" | "pause_turn" | "refusal" | "max_tokens" | "stop_sequence";
  usage?: { input_tokens: number; output_tokens: number };
}

function makeFakeClient(responses: FakeResponse[]) {
  const queue = [...responses];
  const calls: any[] = [];
  const fake = {
    messages: {
      stream(params: any) {
        // Snapshot messages at call time — agentic.ts mutates the same array
        // across iterations, so a reference capture would see the final state.
        calls.push({ ...params, messages: params.messages.map((m: any) => ({ ...m })) });
        const next = queue.shift();
        if (!next) throw new Error("fake client: no more scripted responses");
        return {
          on(event: string, cb: (delta: string) => void) {
            if (event === "text" && next.textDeltas) {
              for (const d of next.textDeltas) cb(d);
            }
          },
          async finalMessage() {
            return {
              content: next.content,
              stop_reason: next.stop_reason,
              usage: next.usage ?? { input_tokens: 10, output_tokens: 5 },
            };
          },
        };
      },
    },
  };
  return { fake: fake as any, calls };
}

// --- 1. Terminates on end_turn ---------------------------------------------

test("loop terminates immediately on end_turn", async () => {
  const { fake, calls } = makeFakeClient([
    {
      textDeltas: ["Hello", ", world"],
      content: [{ type: "text", text: "Hello, world" }],
      stop_reason: "end_turn",
    },
  ]);

  const deltas: string[] = [];
  const result = await runAgenticTurn({
    client: fake,
    userPrompt: "hi",
    onEvent: (evt) => {
      if (evt.type === "text_delta") deltas.push(evt.text);
    },
  });

  assert.equal(result.stopReason, "end_turn");
  assert.equal(result.iterations, 1);
  assert.equal(result.text, "Hello, world");
  assert.equal(result.toolCalls.length, 0);
  assert.equal(result.maxIterationsReached, false);
  assert.deepEqual(deltas, ["Hello", ", world"]);
  assert.equal(calls.length, 1);
});

// --- 2. Tool execution works -----------------------------------------------

test("tool_use is executed and result is fed back to the model", async () => {
  const { fake, calls } = makeFakeClient([
    {
      content: [
        {
          type: "tool_use",
          id: "toolu_1",
          name: "search_memory",
          input: { query: "something that won't match" },
        },
      ],
      stop_reason: "tool_use",
    },
    {
      content: [{ type: "text", text: "Based on the memory search, I found nothing useful." }],
      stop_reason: "end_turn",
    },
  ]);

  const events: any[] = [];
  const result = await runAgenticTurn({
    client: fake,
    userPrompt: "what do you know about Alex?",
    onEvent: (evt) => {
      if (evt.type === "tool_use_start" || evt.type === "tool_use_result") {
        events.push(evt);
      }
    },
  });

  assert.equal(result.iterations, 2);
  assert.equal(result.stopReason, "end_turn");
  assert.equal(result.toolCalls.length, 1);
  assert.equal(result.toolCalls[0].name, "search_memory");
  assert.equal(result.toolCalls[0].isError, false);

  // Second API call must contain the tool_result referencing toolu_1
  assert.equal(calls.length, 2);
  const secondCallMessages = calls[1].messages;
  const lastMsg = secondCallMessages[secondCallMessages.length - 1];
  assert.equal(lastMsg.role, "user");
  const resultBlock = lastMsg.content.find((b: any) => b.type === "tool_result");
  assert.ok(resultBlock, "expected a tool_result block");
  assert.equal(resultBlock.tool_use_id, "toolu_1");

  // Events emitted in order
  assert.equal(events[0].type, "tool_use_start");
  assert.equal(events[0].name, "search_memory");
  assert.equal(events[1].type, "tool_use_result");
  assert.equal(events[1].isError, false);
});

// --- 3. Max iterations cap fires -------------------------------------------

test("max iterations cap fires when model keeps calling tools", async () => {
  // Script infinite tool_use — the cap stops it at maxIterations=3
  const forever: FakeResponse[] = Array.from({ length: 10 }, (_, i) => ({
    content: [
      {
        type: "tool_use",
        id: `toolu_${i}`,
        name: "search_memory",
        input: { query: `q${i}` },
      },
    ],
    stop_reason: "tool_use",
  }));
  const { fake } = makeFakeClient(forever);

  const result = await runAgenticTurn({
    client: fake,
    userPrompt: "loop",
    maxIterations: 3,
  });

  assert.equal(result.maxIterationsReached, true);
  assert.equal(result.stopReason, "max_iterations");
  assert.equal(result.iterations, 3);
  // Each iteration ran the tool
  assert.equal(result.toolCalls.length, 3);
});

// --- 4. pause_turn is handled by re-sending (not treated as terminal) ------

test("pause_turn continues the loop with a fresh call", async () => {
  const { fake, calls } = makeFakeClient([
    {
      content: [{ type: "text", text: "searching..." }],
      stop_reason: "pause_turn",
    },
    {
      content: [{ type: "text", text: "done." }],
      stop_reason: "end_turn",
    },
  ]);

  const result = await runAgenticTurn({
    client: fake,
    userPrompt: "look something up online",
  });

  assert.equal(result.iterations, 2);
  assert.equal(result.stopReason, "end_turn");
  assert.equal(result.text, "done.");
  assert.equal(calls.length, 2, "should have re-called after pause_turn");
});

// --- 5a. Opus 4.7 → adaptive thinking + no sampling params ------------------

test("opus-4-7 requests adaptive thinking and no sampling params", async () => {
  const { fake, calls } = makeFakeClient([
    {
      content: [{ type: "text", text: "ok" }],
      stop_reason: "end_turn",
    },
  ]);

  await runAgenticTurn({
    client: fake,
    userPrompt: "reason about something hard",
    model: "claude-opus-4-7",
  });

  assert.equal(calls.length, 1);
  const params = calls[0];
  assert.equal(params.model, "claude-opus-4-7");
  assert.deepEqual(params.thinking, { type: "adaptive" });
  // Opus 4.7 removes these — they must not be sent.
  assert.equal(params.temperature, undefined, "temperature must not be set");
  assert.equal(params.top_p, undefined, "top_p must not be set");
  assert.equal(params.top_k, undefined, "top_k must not be set");
});

// --- 5b. Haiku skips adaptive thinking (unsupported) ------------------------

test("haiku-4-5 does NOT request adaptive thinking", async () => {
  const { fake, calls } = makeFakeClient([
    {
      content: [{ type: "text", text: "fast response" }],
      stop_reason: "end_turn",
    },
  ]);

  await runAgenticTurn({
    client: fake,
    userPrompt: "classify this",
    model: "claude-haiku-4-5-20251001",
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].thinking, undefined, "haiku should not request thinking");
});

// --- 6. Approval gate enqueues correctly ------------------------------------

test("draft_email enqueues an approval instead of executing", async () => {
  const pendingBefore = approvals.pending().length;

  const { fake } = makeFakeClient([
    {
      content: [
        {
          type: "tool_use",
          id: "toolu_draft_1",
          name: "draft_email",
          input: {
            to: "alex@acme.com",
            contactName: "Alex Rivera",
            context: "follow up on the Q4 proposal",
            tone: "professional",
          },
        },
      ],
      stop_reason: "tool_use",
    },
    {
      content: [
        { type: "text", text: "I've drafted an email to Alex for your review." },
      ],
      stop_reason: "end_turn",
    },
  ]);

  const result = await runAgenticTurn({
    client: fake,
    userPrompt: "draft a follow-up to Alex",
  });

  assert.equal(result.stopReason, "end_turn");
  assert.equal(result.toolCalls.length, 1);
  assert.equal(result.toolCalls[0].name, "draft_email");
  assert.equal(result.pendingApprovals.length, 1);

  // Approval row exists with the expected skill + payload
  const approvalId = result.pendingApprovals[0];
  const row = approvals.get(approvalId);
  assert.ok(row, "expected approval row in DB");
  assert.equal(row!.skill, "master_email_agent");
  assert.equal((row!.payload as any).contactEmail, "alex@acme.com");
  assert.equal((row!.payload as any).contactName, "Alex Rivera");
  assert.equal((row!.payload as any).mode, "draft_reply");

  const pendingAfter = approvals.pending().length;
  assert.equal(pendingAfter, pendingBefore + 1, "approvals.pending() should grow by 1");
});

// --- 6b. AbortSignal cancels the loop between iterations -------------------

test("abort signal stops the loop at the next iteration boundary", async () => {
  // Script: iteration 1 triggers a tool_use (so we end iteration 1 with more
  // work queued), then iteration 2 returns end_turn. We abort BEFORE iter 2.
  const { fake } = makeFakeClient([
    {
      content: [{ type: "tool_use", id: "toolu_abort_1", name: "search_memory", input: { query: "x" } }],
      stop_reason: "tool_use",
    },
    {
      // This should never be sent — abort fires before iter 2 begins.
      content: [{ type: "text", text: "should never reach" }],
      stop_reason: "end_turn",
    },
  ]);

  const ctrl = new AbortController();
  let abortFired = false;
  const events: string[] = [];

  const promise = runAgenticTurn({
    client: fake,
    userPrompt: "look something up",
    signal: ctrl.signal,
    onEvent: (evt) => {
      events.push(evt.type);
      // Fire abort as soon as the first iteration ends — before iter 2 starts.
      if (evt.type === "iteration_end" && !abortFired) {
        abortFired = true;
        ctrl.abort();
      }
    },
  });

  const result = await promise;
  assert.equal(result.stopReason, "aborted");
  assert.equal(result.iterations, 1, "should have completed iter 1 only");
  assert.ok(events.includes("aborted"), "should emit aborted event");
  assert.ok(!events.includes("done"), "should NOT emit done when aborted");
});

// --- 7. Per-tool cost attribution writes to tool_calls ----------------------

test("tool calls are attributed to tool_calls table + aggregates", async () => {
  const { fake } = makeFakeClient([
    {
      content: [
        { type: "tool_use", id: "toolu_agg_1", name: "search_memory", input: { query: "x" } },
      ],
      stop_reason: "tool_use",
    },
    {
      content: [{ type: "text", text: "searched" }],
      stop_reason: "end_turn",
    },
  ]);

  const since = startOfTodayIso();
  const before = agenticTotalsSince(since);

  const res = await runAgenticTurn({
    client: fake,
    userPrompt: "look something up",
  });

  const after = agenticTotalsSince(since);
  assert.equal(res.toolCalls.length, 1);
  assert.equal(after.toolCalls, before.toolCalls + 1, "tool_calls should grow by 1");
  assert.equal(after.turns, before.turns + 1, "distinct agentic turns should grow by 1");

  const leaderboard = toolLeaderboard({ sinceIso: since });
  const mem = leaderboard.find((r) => r.toolName === "search_memory");
  assert.ok(mem, "search_memory should appear in leaderboard");
  assert.ok(mem!.calls >= 1, "search_memory calls >= 1");
  assert.equal(mem!.errors, 0);
});
