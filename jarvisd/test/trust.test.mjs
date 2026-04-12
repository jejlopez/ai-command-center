// Trust Protocol integration tests — audit log API, chain verification, summary.
import { before, after, test, describe } from "node:test";
import assert from "node:assert/strict";
import { startDaemon, getJson, postJson, unlockVault } from "./helpers.mjs";

let daemon;

before(async () => {
  daemon = await startDaemon();
  await unlockVault();
});

after(async () => {
  if (daemon) await daemon.stop();
});

describe("Trust Protocol: Audit Log API", () => {
  test("GET /audit/log returns paginated entries", async () => {
    const res = await getJson("/audit/log?limit=10");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.entries));
    assert.ok(typeof res.body.total === "number");
    assert.ok(res.body.total > 0); // daemon.start + vault.unlock at minimum
    assert.ok(res.body.entries.length <= 10);

    // Each entry has required fields.
    const entry = res.body.entries[0];
    assert.ok(entry.id);
    assert.ok(entry.ts);
    assert.ok(entry.actor);
    assert.ok(entry.action);
    assert.ok(entry.hash);
  });

  test("GET /audit/log supports action filter", async () => {
    const res = await getJson("/audit/log?action=daemon.start");
    assert.equal(res.status, 200);
    assert.ok(res.body.entries.length > 0);
    assert.ok(res.body.entries.every((e) => e.action.startsWith("daemon.start")));
  });

  test("GET /audit/log supports pagination", async () => {
    const page1 = await getJson("/audit/log?limit=2&offset=0");
    const page2 = await getJson("/audit/log?limit=2&offset=2");
    assert.equal(page1.status, 200);
    assert.equal(page2.status, 200);
    // Different entries (if enough exist).
    if (page1.body.total > 2) {
      const ids1 = page1.body.entries.map((e) => e.id);
      const ids2 = page2.body.entries.map((e) => e.id);
      assert.ok(!ids1.some((id) => ids2.includes(id)));
    }
  });

  test("GET /audit/chain verifies successfully", async () => {
    const res = await getJson("/audit/chain");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  });

  test("GET /audit/summary returns 24h breakdown", async () => {
    const res = await getJson("/audit/summary?hours=24");
    assert.equal(res.status, 200);
    assert.ok(typeof res.body.total === "number");
    assert.ok(res.body.total > 0);
    assert.ok(Array.isArray(res.body.actions));
    // Should have daemon.start at least.
    assert.ok(res.body.actions.some((a) => a.action === "daemon.start"));
  });
});

describe("Trust Protocol: Audit integrity after security operations", () => {
  test("Panic followed by chain verify passes", async () => {
    await postJson("/panic", { reason: "trust test" });
    const verify = await getJson("/audit/chain");
    assert.equal(verify.body.ok, true);

    // Panic should be in the log.
    const log = await getJson("/audit/log?action=panic");
    assert.ok(log.body.entries.some((e) => e.action === "panic.triggered"));
  });

  test("Policy deny is logged and chain stays valid", async () => {
    // Add a deny-all rule, trigger it, then remove it.
    await postJson("/policy/rules", {
      id: "test-deny-all",
      name: "Test deny",
      effect: "deny",
      conditions: { providers: ["anthropic"] },
      reason: "test deny rule",
      enabled: true,
    });

    // Re-unlock vault for the ask.
    await unlockVault();

    // This should trigger the policy deny.
    await postJson("/ask", { prompt: "test", kind: "chat" }).catch(() => {});

    const verify = await getJson("/audit/chain");
    assert.equal(verify.body.ok, true);

    // Clean up the test rule.
    await fetch(`${daemon.baseUrl}/policy/rules/test-deny-all`, { method: "DELETE" });
  });

  test("Multiple rapid operations don't break the chain", async () => {
    await unlockVault();
    // Fire 10 rapid operations.
    await Promise.all([
      postJson("/memory/remember", { kind: "fact", label: "trust-test-1", body: "a" }),
      postJson("/memory/remember", { kind: "fact", label: "trust-test-2", body: "b" }),
      postJson("/memory/remember", { kind: "fact", label: "trust-test-3", body: "c" }),
      getJson("/audit/summary"),
      getJson("/health"),
      getJson("/vault/status"),
      postJson("/memory/remember", { kind: "fact", label: "trust-test-4", body: "d" }),
      postJson("/memory/remember", { kind: "fact", label: "trust-test-5", body: "e" }),
      getJson("/audit/log?limit=5"),
      getJson("/brief"),
    ]);

    const verify = await getJson("/audit/chain");
    assert.equal(verify.body.ok, true);
  });
});
