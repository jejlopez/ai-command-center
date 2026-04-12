// Integration tests for M4 batch 2 — four new skills:
// meeting_prep, contact_enrich, doc_summarize, weekly_review.
//
// Contract lives in shared/types.ts ("M4 batch 2 + surfaces" block).
//
// These run against a live jarvisd. Since the test env has no real LLM
// keys and Ollama may or may not be up, skill-run status assertions
// accept both "completed" and "failed" — we assert shape, not outcome.
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { startDaemon, getJson, postJson, unlockVault } from "./helpers.mjs";

let daemon;

const BATCH2_SKILLS = ["meeting_prep", "contact_enrich", "doc_summarize", "weekly_review"];
const STARTER_SKILLS = ["daily_recap", "plan_my_day", "budget_watch"];
const TERMINAL_STATUSES = new Set(["completed", "failed"]);

before(async () => {
  daemon = await startDaemon();
  await unlockVault();
});

after(async () => {
  if (daemon) await daemon.stop();
});

test("GET /skills returns at least 7 skills including the 4 batch-2 skills", async () => {
  const res = await getJson("/skills");
  assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  assert.ok(Array.isArray(res.body), "skills list should be an array");
  assert.ok(
    res.body.length >= 7,
    `expected >=7 skills (3 starter + 4 batch2), got ${res.body.length}: ${res.body.map((s) => s.name).join(",")}`
  );
  const names = res.body.map((s) => s.name);
  for (const want of [...STARTER_SKILLS, ...BATCH2_SKILLS]) {
    assert.ok(names.includes(want), `expected '${want}' in skills list; got ${names.join(",")}`);
  }
});

test("GET /skills/meeting_prep returns a valid manifest with a 'topic' input", async () => {
  const res = await getJson("/skills/meeting_prep");
  assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  const m = res.body;
  assert.ok(m && typeof m === "object", "manifest should be object");
  assert.equal(m.name, "meeting_prep");
  assert.equal(typeof m.title, "string");
  assert.equal(typeof m.description, "string");
  assert.equal(typeof m.version, "string");
  assert.ok(Array.isArray(m.scopes) && m.scopes.length > 0, "scopes should be non-empty array");
  assert.ok(Array.isArray(m.triggers) && m.triggers.length > 0, "triggers should be non-empty array");
  assert.ok(Array.isArray(m.inputs), "meeting_prep manifest should declare inputs[]");
  const topic = m.inputs.find((i) => i.name === "topic");
  assert.ok(topic, `expected inputs[] to contain { name: 'topic' }; got ${JSON.stringify(m.inputs)}`);
  assert.equal(topic.type, "string", `topic input type should be 'string', got '${topic.type}'`);
});

test("POST /skills/doc_summarize/run with short text returns a SkillRun", async () => {
  const res = await postJson("/skills/doc_summarize/run", {
    inputs: { text: "A short document. It has two sentences." },
  });
  assert.ok(
    res.status >= 200 && res.status < 300,
    `expected 2xx, got ${res.status}: ${JSON.stringify(res.body)}`
  );
  const run = res.body;
  assert.ok(run && typeof run === "object", "run should be object");
  assert.equal(typeof run.id, "string");
  assert.equal(run.skill, "doc_summarize");
  assert.equal(run.triggeredBy, "manual");
  assert.ok(
    TERMINAL_STATUSES.has(run.status),
    `status should be completed|failed, got ${run.status}`
  );
  if (run.status === "completed") {
    assert.ok(run.output && typeof run.output === "object", "completed run should have object output");
    assert.equal(typeof run.output.text, "string", "completed doc_summarize output should include a text field");
  } else {
    assert.equal(typeof run.error, "string", "failed run should carry an error string");
  }
});

test("POST /skills/meeting_prep/run with topic returns a SkillRun", async () => {
  const res = await postJson("/skills/meeting_prep/run", {
    inputs: { topic: "onboarding" },
  });
  assert.ok(
    res.status >= 200 && res.status < 300,
    `expected 2xx, got ${res.status}: ${JSON.stringify(res.body)}`
  );
  const run = res.body;
  assert.equal(run?.skill, "meeting_prep");
  assert.equal(run?.triggeredBy, "manual");
  assert.ok(
    TERMINAL_STATUSES.has(run?.status),
    `meeting_prep status should be completed|failed, got ${run?.status}`
  );
  if (run.status === "failed") {
    assert.equal(typeof run.error, "string", "failed meeting_prep should carry error string");
  }
});

test("POST /skills/weekly_review/run returns skipped=true or a completed run (day-dependent)", async () => {
  const res = await postJson("/skills/weekly_review/run", { inputs: {} });
  assert.ok(
    res.status >= 200 && res.status < 300,
    `expected 2xx, got ${res.status}: ${JSON.stringify(res.body)}`
  );
  const run = res.body;
  assert.equal(run?.skill, "weekly_review");
  assert.ok(
    TERMINAL_STATUSES.has(run?.status),
    `weekly_review status should be completed|failed, got ${run?.status}`
  );
  // A manual run on a non-Sunday day may legitimately produce { skipped: true }
  // in the run.output; on Sunday (or via force) it produces { text }.
  // Either shape is acceptable — we just sanity-check the output object when
  // the run completed.
  if (run.status === "completed") {
    assert.ok(run.output !== undefined && run.output !== null, "completed weekly_review should have output");
    if (typeof run.output === "object") {
      const hasSkipped = run.output.skipped === true;
      const hasText = typeof run.output.text === "string";
      assert.ok(
        hasSkipped || hasText,
        `weekly_review output should be { skipped: true } or { text }; got ${JSON.stringify(run.output)}`
      );
    }
  }
});

test("POST /skills/contact_enrich/run without inputs fails or completes with a skip-ish output", async () => {
  const res = await postJson("/skills/contact_enrich/run", { inputs: {} });
  assert.ok(
    res.status >= 200 && res.status < 300,
    `expected 2xx, got ${res.status}: ${JSON.stringify(res.body)}`
  );
  const run = res.body;
  assert.equal(run?.skill, "contact_enrich");
  assert.ok(
    TERMINAL_STATUSES.has(run?.status),
    `contact_enrich status should be completed|failed, got ${run?.status}`
  );
  if (run.status === "failed") {
    assert.equal(typeof run.error, "string", "failed contact_enrich should carry error string");
  } else {
    // completed: output should signal skip / no-op since no person was provided
    assert.ok(
      run.output !== undefined && run.output !== null,
      "completed contact_enrich without inputs should still have an output"
    );
  }
});
