// Gate Protocol integration tests — auth, rate limiting, panic button.
import { before, after, test, describe } from "node:test";
import assert from "node:assert/strict";
import { startDaemon, getJson, postJson, unlockVault } from "./helpers.mjs";

let daemon;

before(async () => {
  daemon = await startDaemon();
});

after(async () => {
  if (daemon) await daemon.stop();
});

describe("Gate Protocol: Rate Limiting", () => {
  test("Normal requests return rate limit headers", async () => {
    const res = await fetch(`${daemon.baseUrl}/health`);
    assert.ok(res.headers.has("x-ratelimit-limit"));
    assert.ok(res.headers.has("x-ratelimit-remaining"));
    assert.ok(res.headers.has("x-ratelimit-reset"));
    const remaining = Number(res.headers.get("x-ratelimit-remaining"));
    assert.ok(remaining >= 0);
  });

  test("Vault routes have tighter limit (20/min)", async () => {
    const res = await fetch(`${daemon.baseUrl}/vault/status`);
    const limit = Number(res.headers.get("x-ratelimit-limit"));
    assert.equal(limit, 20);
  });

  test("Non-vault routes have standard limit (120/min)", async () => {
    const res = await fetch(`${daemon.baseUrl}/health`);
    const limit = Number(res.headers.get("x-ratelimit-limit"));
    assert.equal(limit, 120);
  });
});

describe("Gate Protocol: Panic Button", () => {
  test("POST /panic locks vault and returns lockdown result", async () => {
    // First unlock the vault so we can verify it gets locked.
    await unlockVault();
    const status1 = await getJson("/vault/status");
    assert.equal(status1.body.locked, false);

    // Trigger panic.
    const res = await postJson("/panic", { reason: "test panic" });
    assert.equal(res.status, 200);
    assert.equal(res.body.vaultLocked, true);
    assert.equal(res.body.memoryCleared, true);
    assert.ok(res.body.ts);

    // Verify vault is actually locked now.
    const status2 = await getJson("/vault/status");
    assert.equal(status2.body.locked, true);
  });

  test("POST /panic works even when vault is already locked", async () => {
    // Don't unlock — vault should be locked from previous test.
    const res = await postJson("/panic", { reason: "double panic" });
    assert.equal(res.status, 200);
    assert.equal(res.body.vaultLocked, true);
    assert.equal(res.body.memoryCleared, false); // was already locked
  });

  test("After panic, vault-protected routes return 423", async () => {
    // Vault is locked from previous test.
    const list = await getJson("/vault/list");
    assert.equal(list.status, 423);
    assert.ok(list.body.error.includes("locked"));
  });

  test("After panic, vault can be re-unlocked", async () => {
    const unlock = await unlockVault();
    assert.equal(unlock.status, 200);
    const status = await getJson("/vault/status");
    assert.equal(status.body.locked, false);
  });

  test("Panic is audit-logged", async () => {
    // Trigger another panic to check audit.
    await unlockVault();
    await postJson("/panic", { reason: "audit check" });

    const verify = await getJson("/audit/verify");
    assert.equal(verify.body.ok, true);
  });
});

describe("Gate Protocol: CORS enforcement", () => {
  test("Request from allowed origin succeeds", async () => {
    const res = await fetch(`${daemon.baseUrl}/health`, {
      headers: { Origin: "http://localhost:5173" },
    });
    assert.equal(res.status, 200);
    const acao = res.headers.get("access-control-allow-origin");
    assert.equal(acao, "http://localhost:5173");
  });

  test("Preflight from disallowed origin gets no ACAO header", async () => {
    const res = await fetch(`${daemon.baseUrl}/health`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil.com",
        "Access-Control-Request-Method": "POST",
      },
    });
    const acao = res.headers.get("access-control-allow-origin");
    // Fastify CORS plugin omits ACAO for disallowed origins.
    assert.ok(!acao || acao !== "https://evil.com");
  });
});

describe("Gate Protocol: Vault auth interface", () => {
  test("Vault unlock/lock cycle works with keychain provider", async () => {
    // Reset rate limits so previous vault tests don't exhaust the quota.
    await postJson("/_test/reset-rate-limits");

    // Lock if needed.
    await postJson("/vault/lock");
    const locked = await getJson("/vault/status");
    assert.equal(locked.body.locked, true);

    // Unlock.
    const unlock = await unlockVault();
    assert.equal(unlock.status, 200);
    assert.equal(unlock.body.locked, false);

    // Set a value, verify it persists.
    const setRes = await postJson("/vault/set", { key: "gate_test", value: "secure_value" });
    assert.equal(setRes.status, 200, `vault/set failed: ${JSON.stringify(setRes.body)}`);
    const val = await getJson("/vault/get/gate_test");
    assert.equal(val.status, 200, `vault/get failed: ${JSON.stringify(val.body)}`);
    assert.equal(val.body.value, "secure_value");

    // Lock, verify 423.
    await postJson("/vault/lock");
    const denied = await getJson("/vault/get/gate_test");
    assert.equal(denied.status, 423);
  });
});
