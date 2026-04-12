// Integration tests for the M4-batch-2 cost endpoints.
// Contract: shared/types.ts "M4 batch 2 + surfaces" block:
//   GET /cost/events?since=ISO&limit=N -> CostEventRow[]
//   GET /cost/summary                   -> CostSummary
//
// The existing cost.test.mjs covers /cost/today — this file is scoped
// to the new /cost/events and /cost/summary endpoints.
import { before, after, test } from "node:test";
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

function assertCostEventRowShape(row) {
  assert.ok(row && typeof row === "object", "row should be object");
  assert.equal(typeof row.id, "number", "id should be number");
  assert.equal(typeof row.ts, "string", "ts should be string");
  assert.ok(!Number.isNaN(Date.parse(row.ts)), `ts should parse as date, got ${row.ts}`);
  assert.equal(typeof row.provider, "string", "provider should be string");
  assert.equal(typeof row.model, "string", "model should be string");
  assert.ok(
    row.taskKind === null || typeof row.taskKind === "string",
    `taskKind should be string|null, got ${typeof row.taskKind}`
  );
  assert.equal(typeof row.tokensIn, "number", "tokensIn should be number");
  assert.equal(typeof row.tokensOut, "number", "tokensOut should be number");
  assert.equal(typeof row.costUsd, "number", "costUsd should be number");
  assert.ok(
    row.skill === null || typeof row.skill === "string",
    `skill should be string|null, got ${typeof row.skill}`
  );
  assert.ok(
    row.runId === null || typeof row.runId === "string",
    `runId should be string|null, got ${typeof row.runId}`
  );
}

test("GET /cost/events on fresh daemon returns an array (possibly empty)", async () => {
  const res = await getJson("/cost/events");
  assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  assert.ok(Array.isArray(res.body), `expected array, got ${typeof res.body}`);
  for (const row of res.body) {
    assertCostEventRowShape(row);
  }
});

test("GET /cost/events?limit=3 returns at most 3 items", async () => {
  const res = await getJson("/cost/events?limit=3");
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));
  assert.ok(res.body.length <= 3, `expected <=3 rows, got ${res.body.length}`);
});

test("GET /cost/events?since=<future ISO> returns an empty array", async () => {
  const futureIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const res = await getJson(`/cost/events?since=${encodeURIComponent(futureIso)}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));
  assert.equal(res.body.length, 0, `expected 0 rows for future since, got ${res.body.length}`);
});

test("GET /cost/summary returns shape { today, last7Days[7], topModels[] }", async () => {
  const res = await getJson("/cost/summary");
  assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  const body = res.body;
  assert.ok(body && typeof body === "object", "summary should be object");

  // today
  assert.ok(body.today && typeof body.today === "object", "summary.today should be object");
  assert.equal(typeof body.today.spentUsd, "number", "today.spentUsd should be number");

  // last7Days — array of exactly 7 CostSeriesPoint
  assert.ok(Array.isArray(body.last7Days), "last7Days should be array");
  assert.equal(body.last7Days.length, 7, `last7Days should have 7 entries, got ${body.last7Days.length}`);
  for (const pt of body.last7Days) {
    assert.ok(pt && typeof pt === "object", "series point should be object");
    assert.equal(typeof pt.day, "string", "point.day should be string (YYYY-MM-DD)");
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(pt.day), `point.day should be YYYY-MM-DD, got ${pt.day}`);
    assert.equal(typeof pt.costUsd, "number", "point.costUsd should be number");
    assert.equal(typeof pt.tokensIn, "number", "point.tokensIn should be number");
    assert.equal(typeof pt.tokensOut, "number", "point.tokensOut should be number");
  }

  // topModels — array of { model, costUsd, runs }
  assert.ok(Array.isArray(body.topModels), "topModels should be array");
  for (const tm of body.topModels) {
    assert.ok(tm && typeof tm === "object", "topModels entry should be object");
    assert.equal(typeof tm.model, "string", "topModels.model should be string");
    assert.equal(typeof tm.costUsd, "number", "topModels.costUsd should be number");
    assert.equal(typeof tm.runs, "number", "topModels.runs should be number");
  }
});

test("after running skills, /cost/events is non-empty and /cost/summary.today.spentUsd is a number", async () => {
  // Capture baseline
  const sumBefore = await getJson("/cost/summary");
  assert.equal(sumBefore.status, 200);
  const spentBefore = sumBefore.body?.today?.spentUsd;
  assert.equal(typeof spentBefore, "number");

  const eventsBefore = await getJson("/cost/events");
  assert.equal(eventsBefore.status, 200);
  assert.ok(Array.isArray(eventsBefore.body));
  const eventsBeforeLen = eventsBefore.body.length;

  // Run a couple of skills to generate cost events (may complete or fail —
  // either way, a cost event should be recorded on each model call the
  // daemon attempted).
  const a = await postJson("/skills/daily_recap/run", { inputs: {} });
  assert.ok(a.status >= 200 && a.status < 300, `daily_recap 2xx, got ${a.status}`);
  const b = await postJson("/skills/plan_my_day/run", { inputs: {} });
  assert.ok(b.status >= 200 && b.status < 300, `plan_my_day 2xx, got ${b.status}`);

  // /cost/events should now include at least one row (the daemon records
  // cost events for every LLM call it made, even failed ones record
  // zero-cost rows per spec).
  const eventsAfter = await getJson("/cost/events");
  assert.equal(eventsAfter.status, 200);
  assert.ok(Array.isArray(eventsAfter.body));
  assert.ok(
    eventsAfter.body.length >= eventsBeforeLen + 1,
    `expected at least one new cost event after running 2 skills; before=${eventsBeforeLen}, after=${eventsAfter.body.length}`
  );
  assertCostEventRowShape(eventsAfter.body[0]);

  // /cost/summary.today.spentUsd should still be a valid number (it may be
  // unchanged if runs failed with 0 cost, but must remain numeric and >= 0).
  const sumAfter = await getJson("/cost/summary");
  assert.equal(sumAfter.status, 200);
  const spentAfter = sumAfter.body?.today?.spentUsd;
  assert.equal(typeof spentAfter, "number");
  assert.ok(spentAfter >= 0, `today.spentUsd should be >=0, got ${spentAfter}`);
  assert.ok(
    spentAfter >= spentBefore,
    `today.spentUsd should be monotonically non-decreasing; before=${spentBefore}, after=${spentAfter}`
  );
});
