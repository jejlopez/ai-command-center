import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { startDaemon, getJson, postJson, unlockVault } from "./helpers.mjs";

let daemon;

before(async () => {
  daemon = await startDaemon();
});

after(async () => {
  if (daemon) await daemon.stop();
});

test("GET /config on fresh state -> defaults", async () => {
  const { status, body } = await getJson("/config");
  assert.equal(status, 200);
  assert.equal(body.dailyBudgetUsd, 20);
  assert.equal(body.currency, "USD");
  assert.deepEqual(body.privacyLocalOnly, []);
  assert.deepEqual(body.allowedLocalModels, []);
});

test("POST /config with vault locked -> 423", async () => {
  // Vault starts locked; do not unlock first.
  const res = await postJson("/config", { dailyBudgetUsd: 99 });
  assert.equal(res.status, 423);
});

test("POST /config {dailyBudgetUsd: 50} -> returns merged config with the new budget", async () => {
  const unlock = await unlockVault();
  assert.equal(unlock.status, 200);

  const res = await postJson("/config", { dailyBudgetUsd: 50 });
  assert.equal(res.status, 200);
  assert.equal(res.body.dailyBudgetUsd, 50);
  assert.equal(res.body.currency, "USD");
  assert.deepEqual(res.body.privacyLocalOnly, []);
});

test("POST /config {privacyLocalOnly: ['finance']} -> merges, other fields untouched", async () => {
  const res = await postJson("/config", { privacyLocalOnly: ["finance"] });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.privacyLocalOnly, ["finance"]);
  // previously-set budget should still be 50
  assert.equal(res.body.dailyBudgetUsd, 50);
  assert.equal(res.body.currency, "USD");
});

test("Onboarding status reflects config state: after budget+privacy+cloud key, required steps done", async () => {
  // Ensure cloud key set
  const set = await postJson("/providers/anthropic/key", { key: "sk-ant-fake-test" });
  assert.equal(set.status, 200);

  // Budget + privacy were set above; re-assert by patching again in case test ordering changes
  const cfg = await postJson("/config", { dailyBudgetUsd: 75, privacyLocalOnly: ["finance", "health"] });
  assert.equal(cfg.status, 200);

  const { body: onb } = await getJson("/onboarding/status");
  const required = onb.steps.filter((s) => s.required);
  for (const s of required) {
    assert.equal(s.done, true, `required step ${s.id} should be done`);
  }
  // vault, providers, privacy, budget are required -> all done
  // complete can be true via required-all-done path
  assert.equal(onb.complete, true);
});
