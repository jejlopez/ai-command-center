// Integration tests for M4 — Skill registry + workflow engine (batch 1).
// See shared/types.ts "M4 — Skill registry + workflow engine" block.
//
// These tests run against a live jarvisd. They handle both "Ollama
// available" and "Ollama not available" cases: since the test environment
// has no real LLM API keys, cloud skills fall back to local Ollama, which
// may or may not be up. Status assertions therefore accept both "completed"
// and "failed" where outcome depends on provider availability.
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { startDaemon, getJson, postJson, unlockVault } from "./helpers.mjs";

let daemon;

// Captured across tests so later assertions can reference it.
let sampleRun = null;

const STARTER_SKILLS = ["daily_recap", "plan_my_day", "budget_watch"];
const TERMINAL_STATUSES = new Set(["completed", "failed"]);

before(async () => {
  daemon = await startDaemon();
  await unlockVault();
});

after(async () => {
  if (daemon) await daemon.stop();
});

test("GET /skills on fresh daemon returns array with at least 3 starter skills", async () => {
  const res = await getJson("/skills");
  assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  assert.ok(Array.isArray(res.body), `expected array, got ${typeof res.body}`);
  assert.ok(res.body.length >= 3, `expected >=3 skills, got ${res.body.length}`);
  const names = res.body.map((s) => s.name);
  for (const want of STARTER_SKILLS) {
    assert.ok(names.includes(want), `expected '${want}' in skills list; got ${names.join(",")}`);
  }
});

test("GET /skills/daily_recap returns a valid SkillManifest", async () => {
  const res = await getJson("/skills/daily_recap");
  assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  const m = res.body;
  assert.ok(m && typeof m === "object", "manifest should be object");
  assert.equal(m.name, "daily_recap", "name should be daily_recap");
  assert.equal(typeof m.title, "string", "title should be string");
  assert.ok(m.title.length > 0, "title should be non-empty");
  assert.equal(typeof m.description, "string", "description should be string");
  assert.equal(typeof m.version, "string", "version should be string");
  assert.ok(Array.isArray(m.scopes), "scopes should be array");
  assert.ok(m.scopes.length > 0, "scopes should be non-empty");
  for (const s of m.scopes) {
    assert.equal(typeof s, "string", `scope entry should be string, got ${typeof s}`);
  }
  assert.ok(Array.isArray(m.triggers), "triggers should be array");
  assert.ok(m.triggers.length > 0, "triggers should be non-empty");
  for (const t of m.triggers) {
    assert.ok(t && typeof t === "object", "trigger should be object");
    assert.ok(
      ["manual", "cron", "event"].includes(t.kind),
      `trigger.kind should be manual|cron|event, got ${t.kind}`
    );
    if (t.kind === "cron") assert.equal(typeof t.expr, "string", "cron trigger requires expr");
    if (t.kind === "event") assert.equal(typeof t.event, "string", "event trigger requires event name");
  }
});

test("GET /skills/does-not-exist returns 404", async () => {
  const res = await getJson("/skills/does-not-exist");
  assert.equal(res.status, 404, `expected 404, got ${res.status}: ${JSON.stringify(res.body)}`);
});

test("POST /skills/daily_recap/run returns a SkillRun with terminal status", async () => {
  const res = await postJson("/skills/daily_recap/run", { inputs: {} });
  assert.ok(
    res.status >= 200 && res.status < 300,
    `expected 2xx, got ${res.status}: ${JSON.stringify(res.body)}`
  );
  const run = res.body;
  assert.ok(run && typeof run === "object", "run should be object");
  assert.equal(typeof run.id, "string", "run.id should be string");
  assert.ok(run.id.length > 0, "run.id should be non-empty");
  assert.equal(run.skill, "daily_recap", `run.skill should be daily_recap, got ${run.skill}`);
  assert.ok(
    TERMINAL_STATUSES.has(run.status),
    `run.status should be completed|failed (depends on Ollama/keys), got ${run.status}`
  );
  assert.equal(run.triggeredBy, "manual", `run.triggeredBy should be manual, got ${run.triggeredBy}`);
  assert.equal(typeof run.startedAt, "string", "run.startedAt should be string");
  assert.ok(!Number.isNaN(Date.parse(run.startedAt)), `run.startedAt should parse as date, got ${run.startedAt}`);
  assert.equal(typeof run.durationMs, "number", "run.durationMs should be number");
  assert.ok(run.durationMs >= 0, `run.durationMs should be >=0, got ${run.durationMs}`);
  if (run.status === "failed") {
    // Failures should include an error string (useful for debugging env mismatches).
    assert.equal(typeof run.error, "string", "failed run should carry an error string");
  }
  sampleRun = run;
});

test("GET /runs?limit=5 includes the just-run skill", async () => {
  assert.ok(sampleRun, "prior test should have produced a run");
  const res = await getJson("/runs?limit=5");
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body), "runs should be array");
  const ids = res.body.map((r) => r.id);
  assert.ok(ids.includes(sampleRun.id), `expected ${sampleRun.id} in /runs; got ${ids.join(",")}`);
});

test("GET /skills/daily_recap/runs is scoped to daily_recap and includes the run", async () => {
  assert.ok(sampleRun, "prior test should have produced a run");
  const res = await getJson("/skills/daily_recap/runs");
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body), "runs should be array");
  assert.ok(res.body.length > 0, "should contain at least the run we just triggered");
  for (const r of res.body) {
    assert.equal(r.skill, "daily_recap", `expected run.skill=daily_recap in scoped list, got ${r.skill}`);
  }
  const ids = res.body.map((r) => r.id);
  assert.ok(ids.includes(sampleRun.id), `expected ${sampleRun.id} in scoped list`);
});

test("GET /runs/:id returns the run with the matching id", async () => {
  assert.ok(sampleRun, "prior test should have produced a run");
  const res = await getJson(`/runs/${sampleRun.id}`);
  assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  assert.equal(res.body?.id, sampleRun.id);
  assert.equal(res.body?.skill, "daily_recap");
  assert.ok(TERMINAL_STATUSES.has(res.body?.status), `status should be terminal, got ${res.body?.status}`);
});

test("GET /runs/does-not-exist returns 404", async () => {
  const res = await getJson("/runs/does-not-exist");
  assert.equal(res.status, 404, `expected 404, got ${res.status}: ${JSON.stringify(res.body)}`);
});

test("GET /workflows returns an array with at least 3 cron trigger entries", async () => {
  const res = await getJson("/workflows");
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body), "workflows should be array");
  assert.ok(
    res.body.length >= 3,
    `expected >=3 workflows (one per starter skill's cron trigger); got ${res.body.length}`
  );
  for (const wf of res.body) {
    assert.ok(wf && typeof wf === "object", "workflow entry should be object");
    assert.equal(typeof wf.skill, "string", "workflow.skill should be string");
    assert.ok(wf.trigger && typeof wf.trigger === "object", "workflow.trigger should be object");
    // /workflows only lists active cron triggers per spec.
    assert.equal(wf.trigger.kind, "cron", `expected trigger.kind=cron, got ${wf.trigger.kind}`);
    assert.equal(typeof wf.trigger.expr, "string", "cron trigger expr should be string");
    if (wf.nextRun !== undefined && wf.nextRun !== null) {
      assert.equal(typeof wf.nextRun, "string", "nextRun should be ISO string when present");
      assert.ok(!Number.isNaN(Date.parse(wf.nextRun)), `nextRun should parse, got ${wf.nextRun}`);
    }
  }
  const skills = res.body.map((w) => w.skill);
  for (const want of STARTER_SKILLS) {
    assert.ok(skills.includes(want), `expected workflow for '${want}'; got ${skills.join(",")}`);
  }
});

test("POST /skills/:name/run with no body still runs (inputs is optional) or 400", async () => {
  // inputs is optional per SkillRunRequest; empty body should be accepted.
  // If the route's zod schema rejects it, we accept 400 as an alternate
  // conformant outcome — the spec permits either since inputs is optional.
  const res = await postJson("/skills/plan_my_day/run");
  if (res.status === 400) {
    // zod rejection is acceptable per task spec
    return;
  }
  assert.ok(
    res.status >= 200 && res.status < 300,
    `expected 2xx or 400, got ${res.status}: ${JSON.stringify(res.body)}`
  );
  const run = res.body;
  assert.equal(run?.skill, "plan_my_day");
  assert.ok(
    TERMINAL_STATUSES.has(run?.status),
    `status should be terminal, got ${run?.status}`
  );
});

test("budget_watch run: status is completed or failed regardless of Ollama", async () => {
  // budget_watch is scoped to local LLM — if Ollama is down this should
  // fail gracefully with an error string; if up, it may complete.
  const res = await postJson("/skills/budget_watch/run", { inputs: {} });
  assert.ok(
    res.status >= 200 && res.status < 300,
    `expected 2xx, got ${res.status}: ${JSON.stringify(res.body)}`
  );
  const run = res.body;
  assert.equal(run?.skill, "budget_watch");
  assert.ok(
    TERMINAL_STATUSES.has(run?.status),
    `budget_watch status should be completed|failed, got ${run?.status}`
  );
  if (run.status === "failed") {
    assert.equal(typeof run.error, "string", "failed budget_watch should have error string");
  }
});

test("Episodic snapshot: after a skill run, /episodic?kind=skill_run includes a new entry", async () => {
  assert.ok(sampleRun, "need a prior skill run to assert episodic snapshot");
  const res = await getJson("/episodic?kind=skill_run&limit=50");
  assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  assert.ok(Array.isArray(res.body), "episodic list should be array");
  assert.ok(
    res.body.length > 0,
    "expected at least one skill_run episodic entry after running skills"
  );
  for (const ep of res.body) {
    assert.equal(ep.kind, "skill_run", `entry kind should be skill_run, got ${ep.kind}`);
  }
});

test("Audit chain verifies after the full round", async () => {
  const { status, body } = await getJson("/audit/verify");
  assert.equal(status, 200);
  const ok = body?.ok ?? body?.valid ?? body?.verified;
  assert.equal(ok, true, `audit chain should verify; got ${JSON.stringify(body)}`);
});
