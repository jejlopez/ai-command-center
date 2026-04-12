import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { startDaemon, getJson, postJson, unlockVault } from "./helpers.mjs";

let daemon;

before(async () => {
  daemon = await startDaemon();
  const unlock = await unlockVault();
  assert.equal(unlock.status, 200);
});

after(async () => {
  if (daemon) await daemon.stop();
});

test("GET /cost/today on fresh daemon -> { spentUsd: 0, budgetUsd: 20 }", async () => {
  const { status, body } = await getJson("/cost/today");
  assert.equal(status, 200);
  assert.ok(body && typeof body === "object");
  assert.equal(typeof body.spentUsd, "number");
  assert.equal(typeof body.budgetUsd, "number");
  assert.equal(body.spentUsd, 0, `fresh daemon spentUsd=0; got ${body.spentUsd}`);
  assert.equal(body.budgetUsd, 20, `fresh daemon budgetUsd=20 (default); got ${body.budgetUsd}`);
});

test("POST /config dailyBudgetUsd=42, then GET /cost/today -> budgetUsd reflects config or default", async (t) => {
  const patch = await postJson("/config", { dailyBudgetUsd: 42 });
  assert.equal(patch.status, 200);
  assert.equal(patch.body.dailyBudgetUsd, 42, "config patch applied");

  const { status, body } = await getJson("/cost/today");
  assert.equal(status, 200);
  assert.equal(typeof body.budgetUsd, "number");

  // Assert-then-log: manager wants to see if /cost/today reads from config or is hardcoded.
  assert.ok(
    body.budgetUsd === 42 || body.budgetUsd === 20,
    `budgetUsd should be 42 (reads from config) or 20 (hardcoded); got ${body.budgetUsd}`
  );

  if (body.budgetUsd === 42) {
    t.diagnostic("cost/today READS from config (budgetUsd=42)");
  } else {
    t.diagnostic(
      "cost/today IS HARDCODED to 20 — config.dailyBudgetUsd is not wired through. Manager: fix in cost.ts."
    );
  }
});
