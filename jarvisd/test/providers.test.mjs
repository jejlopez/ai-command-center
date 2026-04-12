import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { startDaemon, getJson, postJson, del, unlockVault, ollamaReachable } from "./helpers.mjs";

let daemon;

before(async () => {
  daemon = await startDaemon();
  // Providers endpoints require an unlocked vault for almost everything.
  const unlock = await unlockVault();
  assert.equal(unlock.status, 200);
});

after(async () => {
  if (daemon) await daemon.stop();
});

test("GET /providers lists 5 providers with linked=false on fresh state", async () => {
  const { status, body } = await getJson("/providers");
  assert.equal(status, 200);
  assert.ok(Array.isArray(body));
  assert.equal(body.length, 5);

  const ids = body.map((p) => p.id).sort();
  assert.deepEqual(ids, ["anthropic", "google", "groq", "ollama", "openai"]);

  for (const p of body) {
    if (p.id === "ollama") continue; // ollama linked depends on environment
    assert.equal(p.linked, false, `${p.id} should be unlinked on fresh state`);
    assert.equal(p.available, false, `${p.id} should be unavailable on fresh state`);
  }
});

test("POST /providers/ollama/key -> 400", async () => {
  const res = await postJson("/providers/ollama/key", { key: "whatever" });
  assert.equal(res.status, 400);
  assert.ok(res.body && res.body.error);
});

test("POST /providers/anthropic/key with vault locked -> 423", async () => {
  const lock = await postJson("/vault/lock");
  assert.equal(lock.status, 200);

  const res = await postJson("/providers/anthropic/key", { key: "sk-test-locked" });
  assert.equal(res.status, 423);

  // Restore unlocked for remaining tests
  const unlock = await unlockVault();
  assert.equal(unlock.status, 200);
});

test("POST /providers/anthropic/key after unlock -> ok:true; GET /providers shows anthropic linked=true", async () => {
  const set = await postJson("/providers/anthropic/key", { key: "sk-ant-fake-not-a-real-key" });
  assert.equal(set.status, 200);
  assert.equal(set.body.ok, true);

  const { body } = await getJson("/providers");
  const anthropic = body.find((p) => p.id === "anthropic");
  assert.ok(anthropic, "anthropic provider present");
  assert.equal(anthropic.linked, true);
});

test("POST /providers/anthropic/test with invalid key -> ok:false with error message", async () => {
  const res = await postJson("/providers/anthropic/test");
  assert.equal(res.status, 200);
  assert.equal(typeof res.body.ok, "boolean");
  assert.equal(res.body.ok, false);
  assert.equal(typeof res.body.latencyMs, "number");
  assert.ok(res.body.error && typeof res.body.error === "string", "error message populated");
});

test("DELETE /providers/anthropic/key -> linked=false again", async () => {
  const res = await del("/providers/anthropic/key");
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);

  const { body } = await getJson("/providers");
  const anthropic = body.find((p) => p.id === "anthropic");
  assert.equal(anthropic.linked, false);
});

test("GET /providers/local/detect -> has `up` boolean and `models` array", async (t) => {
  const { status, body } = await getJson("/providers/local/detect");
  assert.equal(status, 200);
  assert.equal(typeof body.up, "boolean");
  assert.ok(Array.isArray(body.models));

  if (body.up === false) {
    t.diagnostic("ollama not reachable, skipping deeper assertions");
    return;
  }
  // If ollama is up, models should be a string[] (possibly empty)
  for (const m of body.models) {
    assert.equal(typeof m, "string");
  }
});
