import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startDaemon, getJson, postJson, unlockVault } from "./helpers.mjs";

describe("Feedback + Learning Loops", () => {
  let daemon;

  before(async () => {
    daemon = await startDaemon();
    await unlockVault();
  });

  after(async () => {
    await daemon?.stop();
  });

  it("POST /feedback records feedback", async () => {
    const { status, body } = await postJson("/feedback", {
      kind: "general",
      rating: "positive",
      reason: "Great output",
    });
    assert.equal(status, 200);
    assert.equal(body.rating, "positive");
    assert.equal(body.kind, "general");
    assert.ok(body.id);
    assert.ok(body.createdAt);
  });

  it("GET /feedback lists feedback", async () => {
    const { status, body } = await getJson("/feedback");
    assert.equal(status, 200);
    assert.ok(Array.isArray(body));
    assert.ok(body.length >= 1);
    assert.equal(body[0].rating, "positive");
  });

  it("POST /feedback with run_id links to a run", async () => {
    const { status, body } = await postJson("/feedback", {
      runId: "fake-run-id",
      kind: "skill_run",
      rating: "negative",
      reason: "Wrong answer",
    });
    assert.equal(status, 200);
    assert.equal(body.runId, "fake-run-id");
    assert.equal(body.rating, "negative");
  });

  it("POST /feedback requires kind and rating", async () => {
    const { status } = await postJson("/feedback", { rating: "positive" });
    assert.equal(status, 400);
  });

  it("GET /feedback/stats/:skill returns stats structure", async () => {
    const { status, body } = await getJson("/feedback/stats/daily_recap");
    assert.equal(status, 200);
    assert.equal(typeof body.positive, "number");
    assert.equal(typeof body.negative, "number");
    assert.equal(typeof body.neutral, "number");
    assert.equal(typeof body.total, "number");
  });

  it("GET /routing/stats returns routing history", async () => {
    const { status, body } = await getJson("/routing/stats");
    assert.equal(status, 200);
    assert.ok(Array.isArray(body));
  });

  it("POST /routing/explain returns explanation", async () => {
    const { status, body } = await postJson("/routing/explain", { kind: "chat" });
    assert.equal(status, 200);
    assert.ok(body.provider);
    assert.ok(body.model);
    assert.ok(body.reason);
    assert.equal(typeof body.consecutiveSuccesses, "number");
  });

  it("GET /skills lists new skills (draft_reply, follow_up_suggest, research_brief)", async () => {
    const { status, body } = await getJson("/skills");
    assert.equal(status, 200);
    const names = body.map((s) => s.name);
    assert.ok(names.includes("draft_reply"), "draft_reply registered");
    assert.ok(names.includes("follow_up_suggest"), "follow_up_suggest registered");
    assert.ok(names.includes("research_brief"), "research_brief registered");
  });

  it("WebSocket endpoint responds", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:8900/ws`);
    const msg = await new Promise((resolve, reject) => {
      ws.onmessage = (e) => resolve(JSON.parse(e.data));
      ws.onerror = reject;
      setTimeout(() => reject(new Error("ws timeout")), 5000);
    });
    ws.close();
    assert.equal(msg.type, "connected");
    assert.ok(msg.ts);
    assert.equal(typeof msg.payload.clients, "number");
  });
});
