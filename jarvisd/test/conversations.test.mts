// Unit tests for the conversation history module (Phase 2, Day 1).
//
// Run with: npx tsx --test test/conversations.test.mts

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const testHome = mkdtempSync(join(tmpdir(), "jarvisd-conv-test-"));
process.env.JARVIS_HOME = testHome;
process.env.LOG_LEVEL = "silent";

const { after, test } = await import("node:test");
const assert = (await import("node:assert/strict")).default;
const { conversations, newSessionId } = await import("../src/lib/conversations.js");
const { db } = await import("../src/db/db.js");

after(() => {
  try { db.close(); } catch {}
  try { rmSync(testHome, { recursive: true, force: true }); } catch {}
});

// Helper: backdate a message's ts so we can exercise retention/idle windows
function backdateLastMessage(convId: string, iso: string): void {
  db.prepare(
    "UPDATE messages SET ts = ? WHERE id = (SELECT MAX(id) FROM messages WHERE conversation_id = ?)"
  ).run(iso, convId);
}

// --- 1. Schema ready after migration 018 ---

test("migration 018 created conversations + messages tables", () => {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('conversations','messages')")
    .all() as any[];
  assert.equal(tables.length, 2, "both tables should exist");
  const ver = db.prepare("SELECT version FROM schema_version WHERE version = 18").get();
  assert.ok(ver, "schema_version should record migration 18");
});

// --- 2. getOrCreate is idempotent ---

test("getOrCreate creates once, returns existing thereafter", () => {
  const id = newSessionId();
  const first = conversations.getOrCreate(id);
  const second = conversations.getOrCreate(id);
  assert.equal(first.id, id);
  assert.equal(second.id, id);
  assert.equal(first.createdAt, second.createdAt, "same row, not recreated");
});

// --- 3. Invalid session id rejected ---

test("getOrCreate rejects malformed session ids", () => {
  assert.throws(() => conversations.getOrCreate(""));
  assert.throws(() => conversations.getOrCreate("has spaces"));
  assert.throws(() => conversations.getOrCreate("a".repeat(200)));
  assert.throws(() => conversations.getOrCreate("tab\there"));
});

// --- 4. append + listAll round-trip with tool_use blocks ---

test("append + listAll preserves tool_use content blocks", () => {
  const id = newSessionId();
  conversations.getOrCreate(id);

  conversations.append({
    conversationId: id,
    role: "user",
    content: "search my memory for Alex",
  });
  conversations.append({
    conversationId: id,
    role: "assistant",
    content: [
      { type: "text", text: "Let me check." },
      { type: "tool_use", id: "toolu_abc", name: "search_memory", input: { query: "Alex" } },
    ],
    runId: "run-123",
    tokensIn: 200,
    tokensOut: 40,
  });

  const all = conversations.listAll(id);
  assert.equal(all.length, 2);
  assert.equal(all[0].role, "user");
  assert.equal(all[1].role, "assistant");
  // Assistant content round-tripped as ContentBlockParam[]
  assert.ok(Array.isArray(all[1].content));
  const blocks = all[1].content as any[];
  assert.equal(blocks[1].type, "tool_use");
  assert.equal(blocks[1].input.query, "Alex");
  assert.equal(all[1].runId, "run-123");
});

// --- 5. loadRecent truncates by turn cap ---

test("loadRecent caps at maxTurns (most-recent first, chronological return)", () => {
  const id = newSessionId();
  conversations.getOrCreate(id);
  for (let i = 0; i < 10; i++) {
    conversations.append({ conversationId: id, role: "user", content: `q${i}` });
    conversations.append({ conversationId: id, role: "assistant", content: `a${i}` });
  }
  const windowed = conversations.loadRecent(id, { maxTurns: 6 });
  assert.equal(windowed.length, 6, "should return exactly 6 turns");
  // Truncation drops leading assistant turns so head is user
  assert.equal(windowed[0].role, "user");
  // Last message should be the most recent assistant
  assert.equal(windowed[windowed.length - 1].role, "assistant");
  assert.equal(windowed[windowed.length - 1].content, "a9");
});

// --- 6. loadRecent respects token cap ---

test("loadRecent caps by rough token budget (drops from front)", () => {
  const id = newSessionId();
  conversations.getOrCreate(id);
  const bigString = "x".repeat(5000); // ~1400 tokens @ chars/3.5
  for (let i = 0; i < 10; i++) {
    conversations.append({ conversationId: id, role: "user", content: bigString });
    conversations.append({ conversationId: id, role: "assistant", content: bigString });
  }
  // 20 messages × ~1400 tokens = ~28000 tokens total. Cap at 5000.
  const windowed = conversations.loadRecent(id, { maxTurns: 100, maxTokens: 5000 });
  const totalChars = windowed.reduce((s, m) => s + (typeof m.content === "string" ? m.content.length : 0), 0);
  assert.ok(totalChars / 3.5 <= 5000, `should be under 5000 tokens, got ~${Math.round(totalChars / 3.5)}`);
  assert.ok(windowed.length < 20, "should have dropped some messages");
  assert.equal(windowed[0].role, "user", "head must be user role");
});

// --- 7. Idle break: older than threshold → empty window ---

test("loadRecent returns [] when newest message is past idle threshold", () => {
  const id = newSessionId();
  conversations.getOrCreate(id);
  conversations.append({ conversationId: id, role: "user", content: "old" });
  // Backdate to 3 hours ago
  backdateLastMessage(id, new Date(Date.now() - 3 * 3600_000).toISOString());
  const windowed = conversations.loadRecent(id, { idleBreakMs: 2 * 3600_000 });
  assert.deepEqual(windowed, [], "idle window should be empty");

  // But listAll still returns the message (DB persistence intact)
  assert.equal(conversations.listAll(id).length, 1);
});

// --- 8. clear drops messages but keeps conversation ---

test("clear deletes messages but keeps the conversation row", () => {
  const id = newSessionId();
  conversations.getOrCreate(id);
  conversations.append({ conversationId: id, role: "user", content: "hi" });
  conversations.append({ conversationId: id, role: "assistant", content: "hello" });
  assert.equal(conversations.clear(id), 2);
  assert.equal(conversations.listAll(id).length, 0);
  assert.ok(conversations.get(id), "conversation row survives clear");
});

// --- 9. delete drops everything (CASCADE) ---

test("delete removes conversation and cascades to messages", () => {
  const id = newSessionId();
  conversations.getOrCreate(id);
  conversations.append({ conversationId: id, role: "user", content: "bye" });
  const ok = conversations.delete(id);
  assert.equal(ok, true);
  assert.equal(conversations.get(id), null);
  assert.equal(conversations.listAll(id).length, 0);
});

// --- Phase 2 Day 5 — long-conversation truncation (approved caps) ---------

test("Day 5: 45-turn session → loadRecent returns last 40 chronological", () => {
  const id = newSessionId();
  conversations.getOrCreate(id);
  // 45 turns = 45 user + 45 assistant = 90 messages, to hit the turn cap
  for (let i = 0; i < 45; i++) {
    conversations.append({ conversationId: id, role: "user", content: `u${i}` });
    conversations.append({ conversationId: id, role: "assistant", content: `a${i}` });
  }
  const windowed = conversations.loadRecent(id, { maxTurns: 40, maxTokens: 12_000 });
  // Exactly 40 returned
  assert.equal(windowed.length, 40, `expected 40, got ${windowed.length}`);
  // Head is user (user-first-head guard)
  assert.equal(windowed[0].role, "user", "first message must be a user turn");
  // Tail is the most recent message (newest)
  assert.equal(windowed[windowed.length - 1].content, "a44", "last msg must be the newest assistant turn");
  // OLDEST dropped: u0..u24 and a0..a24 should be gone from this window
  const contents = windowed.map((m) => m.content);
  assert.ok(!contents.includes("u0"), "u0 (oldest) should be dropped");
  assert.ok(!contents.includes("a0"), "a0 (oldest) should be dropped");
  // Recent user context preserved: u38 must be in the window
  assert.ok(contents.includes("u38"), "u38 (recent) must be preserved");
  assert.ok(contents.includes("a38"), "a38 (recent) must be preserved");
});

test("Day 5: token-cap truncation drops OLDEST messages (not newest)", () => {
  const id = newSessionId();
  conversations.getOrCreate(id);
  // 50 messages, each ~3500 chars (~1000 tokens). With maxTokens=6000 only
  // the last ~6 messages should fit.
  const bigChunk = "x".repeat(3500);
  for (let i = 0; i < 25; i++) {
    conversations.append({ conversationId: id, role: "user", content: `U${i}_${bigChunk}` });
    conversations.append({ conversationId: id, role: "assistant", content: `A${i}_${bigChunk}` });
  }
  const windowed = conversations.loadRecent(id, { maxTurns: 100, maxTokens: 6_000 });
  // Newest msg is A24 — must be present
  const contents = windowed.map((m) => m.content);
  assert.ok(contents.some((c) => String(c).startsWith("A24")), "newest assistant (A24) must be preserved");
  assert.ok(contents.some((c) => String(c).startsWith("U24")), "newest user (U24) must be preserved");
  // Oldest U0 must be gone
  assert.ok(!contents.some((c) => String(c).startsWith("U0_")), "oldest U0 must be dropped");
  // Head is user
  assert.equal(windowed[0].role, "user");
  // Rough token budget respected
  const totalChars = windowed.reduce((s, m) => s + String(m.content).length, 0);
  assert.ok(totalChars / 3.5 <= 6_000, `token estimate ~${Math.round(totalChars / 3.5)} should be ≤ 6000`);
});

test("Day 5: user-first-head guard holds when truncation lands on assistant", () => {
  const id = newSessionId();
  conversations.getOrCreate(id);
  // Intentionally create a shape where dropping oldest leaves assistant at head
  for (let i = 0; i < 10; i++) {
    conversations.append({ conversationId: id, role: "user", content: `u${i}` });
    conversations.append({ conversationId: id, role: "assistant", content: `a${i}` });
  }
  // With maxTurns=5, last 5 = [u8 a8 u9 a9 ...] actually wait — 10 user + 10 asst interleaved,
  // slicing last 5 gives e.g. [a7 u8 a8 u9 a9]. Head would be a7 (assistant) → user-first-head
  // should drop it, leaving [u8 a8 u9 a9] = 4 msgs.
  const windowed = conversations.loadRecent(id, { maxTurns: 5, maxTokens: 100_000 });
  assert.equal(windowed[0].role, "user", "head must be user even after truncation shift");
  assert.ok(windowed.length <= 5, "should not exceed maxTurns");
  // Claude would get a valid history: starts user
  assert.ok(windowed.length >= 2, "should still have content after head-trim");
});

// --- 10. pruneOlderThan deletes expired messages ---

test("pruneOlderThan deletes messages older than cutoff, keeps recent", () => {
  const id = newSessionId();
  conversations.getOrCreate(id);
  conversations.append({ conversationId: id, role: "user", content: "old" });
  // Backdate to 100 days ago
  backdateLastMessage(id, new Date(Date.now() - 100 * 86400_000).toISOString());
  conversations.append({ conversationId: id, role: "user", content: "new" });

  const deleted = conversations.pruneOlderThan(90);
  assert.equal(deleted, 1, "one message should be pruned");
  const remaining = conversations.listAll(id);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].content, "new");
});
