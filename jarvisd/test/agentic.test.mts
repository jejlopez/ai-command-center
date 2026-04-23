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
const { conversations, newSessionId } = await import("../src/lib/conversations.js");
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

// --- Phase 2 Day 2: conversation persistence + multi-turn history ---------

test("Day 2: conversationId persists user + assistant turns", async () => {
  const sid = newSessionId();
  const { fake } = makeFakeClient([
    {
      content: [{ type: "text", text: "hello back" }],
      stop_reason: "end_turn",
    },
  ]);

  await runAgenticTurn({
    client: fake,
    userPrompt: "say hi",
    conversationId: sid,
  });

  const all = conversations.listAll(sid);
  assert.equal(all.length, 2, "should persist user + assistant");
  assert.equal(all[0].role, "user");
  assert.equal(all[0].content, "say hi");
  assert.equal(all[1].role, "assistant");
  const aBlocks = all[1].content as any[];
  assert.ok(Array.isArray(aBlocks) && aBlocks[0].type === "text");
  assert.equal(aBlocks[0].text, "hello back");
});

test("Day 2: tool_use + tool_result both persist (the critical chain)", async () => {
  // Turn 1: user asks → assistant calls search_memory → tool_result → assistant final
  const sid = newSessionId();
  const { fake } = makeFakeClient([
    {
      content: [
        { type: "tool_use", id: "toolu_t1", name: "search_memory", input: { query: "Alex" } },
      ],
      stop_reason: "tool_use",
    },
    {
      content: [{ type: "text", text: "Found Alex." }],
      stop_reason: "end_turn",
    },
  ]);

  await runAgenticTurn({
    client: fake,
    userPrompt: "what do you know about Alex?",
    conversationId: sid,
  });

  const all = conversations.listAll(sid);
  // Expect 4 rows: user(Q), assistant(tool_use), user(tool_result), assistant(final)
  assert.equal(all.length, 4, `expected 4 rows (user+asst+tool_result+asst), got ${all.length}`);

  // Row 2: assistant with tool_use
  const asstTool = all[1].content as any[];
  assert.ok(Array.isArray(asstTool));
  const toolUseBlock = asstTool.find((b: any) => b.type === "tool_use");
  assert.ok(toolUseBlock, "assistant turn should contain tool_use block");
  assert.equal(toolUseBlock.id, "toolu_t1");

  // Row 3: user with tool_result matching the tool_use id
  assert.equal(all[2].role, "user");
  const toolResultBlocks = all[2].content as any[];
  assert.ok(Array.isArray(toolResultBlocks));
  const tr = toolResultBlocks.find((b: any) => b.type === "tool_result");
  assert.ok(tr, "user turn should contain tool_result block");
  assert.equal(tr.tool_use_id, "toolu_t1", "tool_result.tool_use_id must match assistant tool_use.id");
});

test("Day 2: multi-turn round-trip — Turn 2 loads Turn 1 history with intact tool chain", async () => {
  const sid = newSessionId();

  // Turn 1: tool-use flow
  const turn1 = makeFakeClient([
    {
      content: [
        { type: "tool_use", id: "toolu_r1", name: "search_memory", input: { query: "Q" } },
      ],
      stop_reason: "tool_use",
    },
    {
      content: [{ type: "text", text: "answer from turn 1" }],
      stop_reason: "end_turn",
    },
  ]);
  await runAgenticTurn({ client: turn1.fake, userPrompt: "turn 1 question", conversationId: sid });

  // Turn 2: capture what gets sent as messages — prior turns should round-trip verbatim.
  const turn2 = makeFakeClient([
    {
      content: [{ type: "text", text: "answer from turn 2" }],
      stop_reason: "end_turn",
    },
  ]);
  await runAgenticTurn({ client: turn2.fake, userPrompt: "refer to what we just discussed", conversationId: sid });

  // Inspect what Turn 2 sent to Claude: priorMessages + turn 2 user
  const turn2Params = turn2.calls[0].messages as any[];
  // Expected ordering: [T1 user, T1 asst(tool_use), T1 user(tool_result), T1 asst(final), T2 user]
  assert.equal(turn2Params.length, 5, `expected 5 messages in Turn 2 request, got ${turn2Params.length}`);
  assert.equal(turn2Params[0].role, "user");
  assert.equal(turn2Params[1].role, "assistant");
  assert.equal(turn2Params[2].role, "user");
  assert.equal(turn2Params[3].role, "assistant");
  assert.equal(turn2Params[4].role, "user");
  assert.equal(turn2Params[4].content, "refer to what we just discussed");

  // The dangling-tool_use bug: assistant's tool_use id must match the
  // following user turn's tool_result.tool_use_id. If persistence drops
  // tool_result, Anthropic would 400 on Turn 2.
  const asstBlocks = turn2Params[1].content as any[];
  const userBlocks = turn2Params[2].content as any[];
  const asstToolUse = asstBlocks.find((b: any) => b.type === "tool_use");
  const userToolResult = userBlocks.find((b: any) => b.type === "tool_result");
  assert.ok(asstToolUse && userToolResult, "both tool_use and tool_result must be present");
  assert.equal(userToolResult.tool_use_id, asstToolUse.id, "tool_use ↔ tool_result ids must match");
});

test("Day 2: aborted turn persists user message but NOT assistant content", async () => {
  const sid = newSessionId();
  const { fake } = makeFakeClient([
    {
      content: [{ type: "text", text: "streaming..." }],
      stop_reason: "end_turn",
    },
  ]);
  const ctrl = new AbortController();
  // Abort BEFORE the first iteration even starts — the loop checks signal at
  // the top so we guarantee no assistant persistence.
  ctrl.abort();

  const res = await runAgenticTurn({
    client: fake,
    userPrompt: "will be aborted",
    conversationId: sid,
    signal: ctrl.signal,
  });

  assert.equal(res.stopReason, "aborted");
  const all = conversations.listAll(sid);
  assert.equal(all.length, 1, "only user message should persist on abort");
  assert.equal(all[0].role, "user");
  assert.equal(all[0].content, "will be aborted");
});

test("Day 2: Turn 2 after idle break sees no prior messages (fresh context)", async () => {
  const sid = newSessionId();
  const { fake: f1 } = makeFakeClient([
    { content: [{ type: "text", text: "t1 reply" }], stop_reason: "end_turn" },
  ]);
  await runAgenticTurn({ client: f1, userPrompt: "t1", conversationId: sid });

  // Backdate both T1 messages to 3 hours ago (past 2h idle break)
  db.prepare(
    `UPDATE messages SET ts = ? WHERE conversation_id = ?`
  ).run(new Date(Date.now() - 3 * 3600_000).toISOString(), sid);

  const turn2 = makeFakeClient([
    { content: [{ type: "text", text: "t2 reply" }], stop_reason: "end_turn" },
  ]);
  await runAgenticTurn({ client: turn2.fake, userPrompt: "t2 after idle", conversationId: sid });

  // Turn 2 should send only the new user message (prior window empty due to idle)
  const t2Msgs = turn2.calls[0].messages as any[];
  assert.equal(t2Msgs.length, 1, "idle break should drop prior turns");
  assert.equal(t2Msgs[0].content, "t2 after idle");

  // But all 4 messages still exist in the DB (persistence unaffected by load-window)
  assert.equal(conversations.listAll(sid).length, 4, "DB persists everything regardless of load window");
});

// --- Phase 2 Day 3: prompt caching + sort determinism ---------------------

test("Day 3: cache_control ephemeral is placed on the system block", async () => {
  const { fake, calls } = makeFakeClient([
    { content: [{ type: "text", text: "ok" }], stop_reason: "end_turn" },
  ]);
  await runAgenticTurn({
    client: fake,
    userPrompt: "hi",
    system: "You are Jarvis.",
  });
  assert.equal(calls.length, 1);
  // System must be an array of text blocks with cache_control on the last block
  assert.ok(Array.isArray(calls[0].system), "system must be a block array");
  const sys = calls[0].system as any[];
  assert.equal(sys[sys.length - 1].type, "text");
  assert.deepEqual(
    sys[sys.length - 1].cache_control,
    { type: "ephemeral" },
    "cache_control on system block = tools+system prefix is cached"
  );
});

test("Day 3: tool list is alphabetically sorted (cache-prefix stability)", async () => {
  // buildAnthropicToolList is the list Claude sees — order matters for cache.
  const { buildAnthropicToolList } = await import("../src/lib/tools/index.js");
  const list = buildAnthropicToolList();
  const names = list.map((t: any) => t.name);
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(names, sorted, "tool list must be alphabetically sorted");
  // Sanity: each call returns an identically-ordered list
  const second = buildAnthropicToolList().map((t: any) => t.name);
  assert.deepEqual(names, second, "tool list order must be deterministic across calls");
});

test("Day 2: no conversationId = stateless back-compat (no DB writes)", async () => {
  const sidBefore = conversations.list(1000).length;
  const { fake } = makeFakeClient([
    { content: [{ type: "text", text: "ok" }], stop_reason: "end_turn" },
  ]);
  await runAgenticTurn({ client: fake, userPrompt: "no session" });
  const sidAfter = conversations.list(1000).length;
  assert.equal(sidBefore, sidAfter, "no-conversationId path must not touch the DB");
});

// --- Phase 2 Day 5 — abort DURING streaming (distinct from boundary abort) ---

test("Day 5: abort during text streaming → stopReason=aborted, only user persisted", async () => {
  // Different code path from "abort at boundary" (test 6b). Here abort fires
  // AFTER iteration starts + stream begins emitting text but BEFORE
  // finalMessage() resolves. The SDK-side signal must cause the stream
  // catch block to be entered with an AbortError, not the pre-iteration
  // opts.signal.aborted check.
  const sid = newSessionId();

  let callCount = 0;
  const abortAware = {
    messages: {
      stream(_params: any, opts: any) {
        callCount++;
        const textHandlers: Array<(d: string) => void> = [];
        return {
          on(event: string, cb: any) {
            if (event === "text") textHandlers.push(cb);
          },
          async finalMessage() {
            // Emit a text delta so the consumer can fire abort via onEvent
            textHandlers.forEach((h) => h("streaming"));
            // Yield to the event loop so the abort call lands
            await new Promise((resolve) => setTimeout(resolve, 5));
            if (opts?.signal?.aborted) {
              const err: any = new Error("Request was aborted");
              err.name = "AbortError";
              throw err;
            }
            return {
              content: [{ type: "text", text: "should not reach" }],
              stop_reason: "end_turn",
              usage: { input_tokens: 100, output_tokens: 50 },
            };
          },
        };
      },
    },
  };

  const ctrl = new AbortController();
  let firedAbort = false;
  const result = await runAgenticTurn({
    client: abortAware as any,
    userPrompt: "streaming test",
    conversationId: sid,
    signal: ctrl.signal,
    onEvent: (evt) => {
      if (evt.type === "text_delta" && !firedAbort) {
        firedAbort = true;
        ctrl.abort();
      }
    },
  });

  assert.equal(result.stopReason, "aborted", "mid-stream abort must mark stopReason=aborted");
  assert.equal(callCount, 1, "exactly one stream call — abort prevents retries");
  // User persisted, no assistant — the stream never completed so we have no
  // content block to save. Clean state: no dangling assistant turn.
  const stored = conversations.listAll(sid);
  assert.equal(stored.length, 1, "only user persisted on mid-stream abort");
  assert.equal(stored[0].role, "user");
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
