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
