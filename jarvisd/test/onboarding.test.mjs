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

function stepById(status, id) {
  return status.steps.find((s) => s.id === id);
}

test("GET /onboarding/status before anything -> steps all not-done, complete=false", async () => {
  const { status, body } = await getJson("/onboarding/status");
  assert.equal(status, 200);
  assert.equal(body.complete, false);
  assert.ok(Array.isArray(body.steps));
  // 5 steps: vault, providers, local, privacy, budget
  assert.equal(body.steps.length, 5);
  for (const s of body.steps) {
    assert.equal(s.done, false, `step ${s.id} should be not-done on fresh state`);
  }
});

test("GET /onboarding/status after unlock -> vault step done, others not", async () => {
  const unlock = await unlockVault();
  assert.equal(unlock.status, 200);
  assert.equal(unlock.body.ok, true);

  const { status, body } = await getJson("/onboarding/status");
  assert.equal(status, 200);
  assert.equal(stepById(body, "vault").done, true);
  assert.equal(stepById(body, "providers").done, false);
  assert.equal(stepById(body, "privacy").done, false);
  assert.equal(stepById(body, "budget").done, false);
  // complete should still be false (other required steps not done)
  assert.equal(body.complete, false);
});

test("POST /onboarding/complete requires vault unlocked -> 423 if locked", async () => {
  // lock first
  const lockRes = await postJson("/vault/lock");
  assert.equal(lockRes.status, 200);

  const res = await postJson("/onboarding/complete");
  assert.equal(res.status, 423);
  assert.ok(res.body && res.body.error);

  // restore unlocked state for next tests
  const unlock = await unlockVault();
  assert.equal(unlock.status, 200);
});

test("POST /onboarding/complete -> sentinel set -> status.complete=true", async () => {
  const res = await postJson("/onboarding/complete");
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);

  const { body } = await getJson("/onboarding/status");
  assert.equal(body.complete, true);
});

test("POST /onboarding/reset -> clears sentinel -> status.complete=false", async () => {
  const res = await postJson("/onboarding/reset");
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);

  const { body } = await getJson("/onboarding/status");
  assert.equal(body.complete, false);
  // After reset, required non-vault steps should be not-done again
  assert.equal(stepById(body, "privacy").done, false);
  assert.equal(stepById(body, "budget").done, false);
});
