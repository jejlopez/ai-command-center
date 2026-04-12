import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { startDaemon, getJson, postJson, del, unlockVault } from "./helpers.mjs";

let daemon;

before(async () => {
  daemon = await startDaemon();
});

after(async () => {
  if (daemon) await daemon.stop();
});

test("Audit chain verifies cleanly after a sequence of 10 state-changing calls", async () => {
  // 1. unlock vault
  const unlock = await unlockVault();
  assert.equal(unlock.status, 200);

  const calls = [
    // 2. set anthropic key
    () => postJson("/providers/anthropic/key", { key: "sk-ant-audit-1" }),
    // 3. set openai key
    () => postJson("/providers/openai/key", { key: "sk-openai-audit-1" }),
    // 4. test anthropic (will fail since key is fake but still audits)
    () => postJson("/providers/anthropic/test"),
    // 5. patch config budget
    () => postJson("/config", { dailyBudgetUsd: 42 }),
    // 6. patch config privacy
    () => postJson("/config", { privacyLocalOnly: ["finance"] }),
    // 7. delete openai key
    () => del("/providers/openai/key"),
    // 8. complete onboarding
    () => postJson("/onboarding/complete"),
    // 9. reset onboarding
    () => postJson("/onboarding/reset"),
    // 10. re-set anthropic key
    () => postJson("/providers/anthropic/key", { key: "sk-ant-audit-2" }),
    // 11. patch config allowedLocalModels
    () => postJson("/config", { allowedLocalModels: ["llama3"] }),
  ];

  for (const fn of calls) {
    const res = await fn();
    assert.ok(res.status >= 200 && res.status < 500, `call returned ${res.status}`);
  }

  const { status, body } = await getJson("/audit/verify");
  assert.equal(status, 200);
  // verifyAuditChain typically returns { ok: true, count: N } or { valid: true }
  // accept either shape — the test asserts it is truthy and not an error.
  assert.ok(body, "audit verify returned body");
  const ok = body.ok ?? body.valid ?? body.verified;
  assert.equal(ok, true, `audit chain should verify; got ${JSON.stringify(body)}`);
});
