// Integration tests for M3 — Semantic memory upgrade.
// See shared/types.ts "M3 — Semantic memory upgrade" block.
//
// These tests run against a live jarvisd. They handle both "Ollama available"
// and "Ollama not available" cases — semantic-only assertions get skipped
// when the embed provider is down, but FTS5 fallback assertions always run.
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, getJson, postJson, del, unlockVault } from "./helpers.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(__dirname, "fixtures/obsidian");

let daemon;
let embedStatus = null;

async function fetchEmbedStatus() {
  const res = await getJson("/memory/embed/status");
  if (res.status !== 200 || !res.body || typeof res.body !== "object") return null;
  return res.body;
}

async function remember(node) {
  const res = await postJson("/memory/remember", node);
  assert.ok(res.status >= 200 && res.status < 300, `remember failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

async function recall(q, opts = {}) {
  const params = new URLSearchParams({ q });
  if (opts.enhanced) params.set("enhanced", "true");
  if (opts.limit !== undefined) params.set("limit", String(opts.limit));
  const res = await getJson(`/memory/recall?${params.toString()}`);
  return res;
}

before(async () => {
  daemon = await startDaemon();
  await unlockVault();
  embedStatus = await fetchEmbedStatus();
});

after(async () => {
  if (daemon) await daemon.stop();
});

test("GET /memory/embed/status returns EmbedStatus shape", async () => {
  const res = await getJson("/memory/embed/status");
  assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  assert.ok(res.body && typeof res.body === "object", "body should be an object");
  assert.equal(typeof res.body.ok, "boolean", "ok should be boolean");
  assert.equal(res.body.provider, "ollama", "provider should be 'ollama'");
  assert.equal(typeof res.body.model, "string", "model should be string");
  assert.equal(typeof res.body.dims, "number", "dims should be number");
  if (!res.body.ok) {
    // When down, error string should be present (spec allows it).
    // Don't require it — the field is optional in the type — but when
    // ok=false dims may be 0. Accept any non-negative.
    assert.ok(res.body.dims >= 0);
  } else {
    assert.ok(res.body.dims > 0, "dims should be positive when ok");
  }
});

test("POST /memory/remember then GET /memory/recall by exact label returns the node", async () => {
  const node = await remember({
    kind: "fact",
    label: "Exact label needle unicorn-7734",
    body: "A unique marker used by the exact-label recall test.",
    trust: 0.9,
  });
  assert.ok(node && typeof node.id === "string", "remember should return node with id");

  const res = await recall("Exact label needle unicorn-7734");
  assert.equal(res.status, 200);
  const ids = (res.body?.nodes ?? []).map((n) => n.id);
  assert.ok(ids.includes(node.id), `expected ${node.id} in recall nodes, got ${ids.join(",")}`);
});

test("POST /memory/remember x5 then GET /memory/recall?enhanced=true returns RecallResult with hits ordered by score desc", async () => {
  const labels = [
    "alpha budget forecast memo",
    "alpha budget forecast slide",
    "alpha budget spreadsheet",
    "alpha quarterly plan",
    "alpha team retro notes",
  ];
  for (const label of labels) {
    await remember({ kind: "fact", label, body: `${label} body`, trust: 0.8 });
  }

  const res = await recall("alpha budget", { enhanced: true, limit: 10 });
  assert.equal(res.status, 200);
  const body = res.body;
  assert.ok(body && typeof body === "object", "body should be object");
  assert.equal(typeof body.compiled, "string", "compiled should be string");
  assert.equal(typeof body.tokenEstimate, "number", "tokenEstimate should be number");
  assert.ok(Array.isArray(body.nodes), "nodes should be array");
  assert.ok(Array.isArray(body.hits), "enhanced recall should populate hits");
  assert.ok(body.hits.length > 0, "hits should be non-empty");
  for (const h of body.hits) {
    assert.equal(typeof h.nodeId, "string");
    assert.equal(typeof h.score, "number");
    assert.ok(h.score >= 0 && h.score <= 1, `score out of range: ${h.score}`);
    assert.ok(["vector", "fts", "graph", "hybrid"].includes(h.via), `bad via: ${h.via}`);
  }
  for (let i = 1; i < body.hits.length; i++) {
    assert.ok(
      body.hits[i - 1].score >= body.hits[i].score,
      `hits not sorted desc at index ${i}: ${body.hits[i - 1].score} < ${body.hits[i].score}`
    );
  }
  assert.ok(body.embedStatus && typeof body.embedStatus === "object", "embedStatus should be present");
});

test("FTS5 fallback: remember 'quarterly budget review', recall 'budget review' returns via fts or hybrid with non-zero score", async () => {
  const node = await remember({
    kind: "fact",
    label: "quarterly budget review",
    body: "Finance cadence meeting every quarter to review the budget.",
    trust: 0.75,
  });
  const res = await recall("budget review", { enhanced: true });
  assert.equal(res.status, 200);
  const hits = res.body?.hits ?? [];
  const match = hits.find((h) => h.nodeId === node.id);
  assert.ok(match, `expected node ${node.id} in hits; got ${JSON.stringify(hits)}`);
  assert.ok(["fts", "hybrid", "vector"].includes(match.via), `via should be fts/hybrid/vector, got ${match.via}`);
  assert.ok(match.score > 0, `score should be > 0, got ${match.score}`);
});

test("Hybrid/vector scores: semantic recall for 'ops leadership' finds 'Alex Rivera VP of Ops'", async (t) => {
  const node = await remember({
    kind: "person",
    label: "Alex Rivera VP of Ops",
    body: "Senior leader at Acme owning operations and team management.",
    trust: 0.9,
  });

  const status = embedStatus ?? (await fetchEmbedStatus());
  if (!status || !status.ok) {
    t.skip(`Ollama embeddings unavailable (ok=${status?.ok}); skipping semantic-only assertion`);
    return;
  }

  const res = await recall("ops leadership", { enhanced: true, limit: 10 });
  assert.equal(res.status, 200);
  const hits = res.body?.hits ?? [];
  const match = hits.find((h) => h.nodeId === node.id);
  assert.ok(match, `expected ${node.id} in hits via semantic; got ${JSON.stringify(hits)}`);
  assert.ok(
    ["vector", "hybrid"].includes(match.via),
    `via should be vector or hybrid with Ollama up, got ${match.via}`
  );
  assert.ok(match.score > 0);
});

test("Delete: forget a node removes it from FTS5 recall", async () => {
  const node = await remember({
    kind: "fact",
    label: "ephemeral tombstone marker xyzzy-9911",
    body: "will be deleted",
    trust: 0.5,
  });
  let res = await recall("xyzzy-9911");
  let ids = (res.body?.nodes ?? []).map((n) => n.id);
  assert.ok(ids.includes(node.id), "should be findable before delete");

  const delRes = await del(`/memory/${node.id}`);
  assert.equal(delRes.status, 200);

  res = await recall("xyzzy-9911");
  ids = (res.body?.nodes ?? []).map((n) => n.id);
  assert.ok(!ids.includes(node.id), `node ${node.id} should not appear after forget`);
});

test("Obsidian import dry-run: returns counts, memory unchanged", async () => {
  const before = await getJson("/memory");
  const beforeCount = Array.isArray(before.body) ? before.body.length : 0;

  const res = await postJson("/memory/import/obsidian", {
    path: FIXTURE_DIR,
    dryRun: true,
  });
  assert.equal(res.status, 200, `dry-run import failed: ${JSON.stringify(res.body)}`);
  const body = res.body;
  assert.equal(typeof body.scanned, "number");
  assert.equal(typeof body.imported, "number");
  assert.equal(typeof body.skipped, "number");
  assert.ok(Array.isArray(body.errors));
  assert.ok(body.scanned >= 3, `should scan >=3 files, got ${body.scanned}`);

  const after = await getJson("/memory");
  const afterCount = Array.isArray(after.body) ? after.body.length : 0;
  assert.equal(afterCount, beforeCount, "memory should be unchanged after dryRun");
});

test("Obsidian import real: nodes exist in memory and can be recalled", async () => {
  const res = await postJson("/memory/import/obsidian", {
    path: FIXTURE_DIR,
    dryRun: false,
  });
  assert.equal(res.status, 200, `real import failed: ${JSON.stringify(res.body)}`);
  const body = res.body;
  assert.ok(body.imported >= 3, `should import >=3 nodes, got ${body.imported}`);
  assert.equal(body.errors.length, 0, `unexpected import errors: ${JSON.stringify(body.errors)}`);

  // The fixtures contain distinctive tokens — use FTS5-safe lookups.
  const recallAlex = await recall("Alex Rivera");
  const alexNodes = recallAlex.body?.nodes ?? [];
  assert.ok(
    alexNodes.some((n) => /alex/i.test(n.label) || /alex/i.test(n.body ?? "")),
    `expected Alex node after import; got ${JSON.stringify(alexNodes.map((n) => n.label))}`
  );

  const recallAcme = await recall("Acme renewal");
  const acmeNodes = recallAcme.body?.nodes ?? [];
  assert.ok(
    acmeNodes.some((n) => /acme/i.test(n.label) || /acme/i.test(n.body ?? "")),
    `expected Acme project node after import; got ${JSON.stringify(acmeNodes.map((n) => n.label))}`
  );
});

test("Obsidian import with unknown path returns error response", async () => {
  const res = await postJson("/memory/import/obsidian", {
    path: "/definitely/not/a/real/path/__jarvis_test_missing__",
    dryRun: true,
  });
  // Accept either a non-2xx status, or a 200 with errors populated / scanned=0.
  if (res.status >= 200 && res.status < 300) {
    const body = res.body ?? {};
    const scanned = body.scanned ?? 0;
    const errors = Array.isArray(body.errors) ? body.errors : [];
    assert.ok(
      scanned === 0 || errors.length > 0 || body.error,
      `unknown path should yield scanned=0 or errors; got ${JSON.stringify(body)}`
    );
  } else {
    assert.ok(res.status >= 400 && res.status < 600, `expected error status, got ${res.status}`);
  }
});

test("Audit chain verifies after the full round", async () => {
  const { status, body } = await getJson("/audit/verify");
  assert.equal(status, 200);
  const ok = body?.ok ?? body?.valid ?? body?.verified;
  assert.equal(ok, true, `audit chain should verify; got ${JSON.stringify(body)}`);
});
