import { before, after, test, describe } from "node:test";
import assert from "node:assert/strict";
import { startDaemon, getJson, postJson, del } from "./helpers.mjs";

let daemon;

before(async () => {
  daemon = await startDaemon();
});

after(async () => {
  if (daemon) await daemon.stop();
});

describe("Policy Engine", () => {
  test("GET /policy/rules returns default rules", async () => {
    const res = await getJson("/policy/rules");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 2); // secret-local-only + sensitive-no-openai
    const ids = res.body.map((r) => r.id);
    assert.ok(ids.includes("secret-local-only"));
    assert.ok(ids.includes("sensitive-no-openai"));
  });

  test("POST /policy/rules adds a custom rule", async () => {
    const res = await postJson("/policy/rules", {
      id: "test-custom",
      name: "Custom test rule",
      effect: "deny",
      conditions: { providers: ["groq"] },
      reason: "Testing custom rules",
      enabled: true,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);

    const rules = await getJson("/policy/rules");
    assert.ok(rules.body.some((r) => r.id === "test-custom"));
  });

  test("DELETE /policy/rules/:id removes a rule", async () => {
    const res = await del("/policy/rules/test-custom");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);

    const rules = await getJson("/policy/rules");
    assert.ok(!rules.body.some((r) => r.id === "test-custom"));
  });

  test("DELETE non-existent rule returns ok:false", async () => {
    const res = await del("/policy/rules/does-not-exist");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, false);
  });

  test("Disabled rules are included in listing", async () => {
    await postJson("/policy/rules", {
      id: "disabled-test",
      name: "Disabled rule",
      effect: "deny",
      conditions: {},
      reason: "Should be listed but not enforced",
      enabled: false,
    });

    const rules = await getJson("/policy/rules");
    const rule = rules.body.find((r) => r.id === "disabled-test");
    assert.ok(rule);
    assert.equal(rule.enabled, false);

    // Clean up.
    await del("/policy/rules/disabled-test");
  });
});
