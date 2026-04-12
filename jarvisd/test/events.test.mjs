// Integration tests for the M4-batch-2 event bus.
// Contract: shared/types.ts "M4 batch 2 + surfaces" block. Skills subscribe
// to events via SkillManifest.triggers: { kind: 'event', event: '<name>' }.
// When an event fires, the workflow engine runs every subscribed skill and
// records a SkillRun with triggeredBy: 'event'.
//
// Against a live jarvisd, event dispatch is async — tests poll /runs briefly
// before asserting so they're time-robust.
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { startDaemon, getJson, postJson, unlockVault } from "./helpers.mjs";

let daemon;

const POLL_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 100;

async function pollRuns(predicate, timeoutMs = POLL_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  let last = [];
  while (Date.now() < deadline) {
    const res = await getJson("/runs?limit=20");
    if (res.status === 200 && Array.isArray(res.body)) {
      last = res.body;
      if (predicate(last)) return last;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return last;
}

function countBySkill(runs, skill) {
  return runs.filter((r) => r?.skill === skill).length;
}

before(async () => {
  daemon = await startDaemon();
  await unlockVault();
});

after(async () => {
  if (daemon) await daemon.stop();
});

test("memory.remembered (kind=person) triggers contact_enrich via event bus", async () => {
  // Snapshot contact_enrich run count before the write.
  const before = await getJson("/runs?limit=20");
  assert.equal(before.status, 200);
  assert.ok(Array.isArray(before.body));
  const beforeCount = countBySkill(before.body, "contact_enrich");

  // Write a person → should emit memory.remembered and dispatch contact_enrich.
  const remembered = await postJson("/memory/remember", {
    kind: "person",
    label: "Ada Lovelace",
    body: "Mathematician. Worked on the Analytical Engine.",
  });
  assert.ok(
    remembered.status >= 200 && remembered.status < 300,
    `/memory/remember should 2xx, got ${remembered.status}: ${JSON.stringify(remembered.body)}`
  );

  // Poll /runs for up to 5s until a new contact_enrich run appears.
  const runs = await pollRuns((list) => countBySkill(list, "contact_enrich") > beforeCount);
  const afterCount = countBySkill(runs, "contact_enrich");
  assert.ok(
    afterCount > beforeCount,
    `expected a new contact_enrich run after remembering a person; before=${beforeCount}, after=${afterCount}; runs=${runs.map((r) => r.skill).join(",")}`
  );

  // The new run must have triggeredBy='event'. Find any contact_enrich run
  // with triggeredBy='event'.
  const eventRun = runs.find((r) => r.skill === "contact_enrich" && r.triggeredBy === "event");
  assert.ok(
    eventRun,
    `expected at least one contact_enrich run with triggeredBy='event'; got ${JSON.stringify(
      runs.filter((r) => r.skill === "contact_enrich").map((r) => ({ id: r.id, triggeredBy: r.triggeredBy, status: r.status }))
    )}`
  );
  // Terminal status either completed or failed — dispatch is what matters.
  assert.ok(
    ["completed", "failed", "queued", "running"].includes(eventRun.status),
    `event-triggered contact_enrich status should be valid, got ${eventRun.status}`
  );
});

test("memory.remembered (kind=fact) does NOT trigger contact_enrich", async () => {
  // Snapshot again — later tests run against a warmed-up daemon.
  const before = await getJson("/runs?limit=50");
  assert.equal(before.status, 200);
  assert.ok(Array.isArray(before.body));
  const beforeCount = countBySkill(before.body, "contact_enrich");

  const remembered = await postJson("/memory/remember", {
    kind: "fact",
    label: "Water boils at 100C at 1 atm",
    body: "Basic physical-chemistry fact.",
  });
  assert.ok(
    remembered.status >= 200 && remembered.status < 300,
    `/memory/remember (fact) should 2xx, got ${remembered.status}: ${JSON.stringify(remembered.body)}`
  );

  // Give any (incorrect) dispatch a chance to show up — wait the full poll
  // window, then assert the count did NOT grow.
  await new Promise((r) => setTimeout(r, POLL_TIMEOUT_MS));
  const after = await getJson("/runs?limit=50");
  assert.equal(after.status, 200);
  const afterCount = countBySkill(after.body, "contact_enrich");
  assert.equal(
    afterCount,
    beforeCount,
    `remembering a fact should NOT spawn contact_enrich runs; before=${beforeCount}, after=${afterCount}`
  );
});

test("approving an approval emits approval.decided; audit chain still verifies", async () => {
  // Create an approval
  const created = await postJson("/approvals", {
    title: "Test approval",
    reason: "integration test: events.test.mjs",
    skill: "doc_summarize",
    riskLevel: "low",
    payload: { note: "test" },
  });
  assert.ok(
    created.status >= 200 && created.status < 300,
    `/approvals should 2xx, got ${created.status}: ${JSON.stringify(created.body)}`
  );
  const approvalId = created.body?.id;
  assert.equal(typeof approvalId, "string", "created approval must have id");

  // Decide it — this should emit approval.decided internally. No batch-2
  // skill listens for this event, so we can't assert a new run; we just
  // assert that the round-trip works and the audit chain still verifies
  // (i.e. the emit wired through without corrupting the hash chain).
  const decided = await postJson(`/approvals/${approvalId}/decide`, {
    decision: "approve",
    reason: "test",
  });
  assert.ok(
    decided.status >= 200 && decided.status < 300,
    `/approvals/:id/decide should 2xx, got ${decided.status}: ${JSON.stringify(decided.body)}`
  );

  const verify = await getJson("/audit/verify");
  assert.equal(verify.status, 200);
  const ok = verify.body?.ok ?? verify.body?.valid ?? verify.body?.verified;
  assert.equal(ok, true, `audit chain should verify after approval.decide; got ${JSON.stringify(verify.body)}`);
});

test("Audit chain verifies after the full event-bus round", async () => {
  const { status, body } = await getJson("/audit/verify");
  assert.equal(status, 200);
  const ok = body?.ok ?? body?.valid ?? body?.verified;
  assert.equal(ok, true, `audit chain should still verify; got ${JSON.stringify(body)}`);
});
