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

const FAKE_CREDS = {
  client_id: "fake-client-id.apps.googleusercontent.com",
  client_secret: "fake-client-secret-xyz",
};

test("GET /connectors on fresh daemon -> all three (gmail, gcal, drive) linked=false", async () => {
  const unlock = await unlockVault();
  assert.equal(unlock.status, 200);

  const { status, body } = await getJson("/connectors");
  assert.equal(status, 200);
  assert.ok(body && typeof body === "object", "body is an object");

  for (const id of ["gmail", "gcal", "drive"]) {
    assert.ok(body[id], `${id} present`);
    assert.equal(body[id].id, id);
    assert.equal(body[id].linked, false, `${id} should be linked=false`);
    assert.equal(body[id].available, false, `${id} should be available=false`);
  }
});

test("GET /connectors with vault locked -> 423", async () => {
  const lock = await postJson("/vault/lock");
  assert.equal(lock.status, 200);

  try {
    const res = await getJson("/connectors");
    assert.equal(
      res.status,
      423,
      `GET /connectors should require unlocked vault; got ${res.status}`
    );
  } finally {
    // Always restore unlock so subsequent tests don't cascade-fail
    const unlock = await unlockVault();
    assert.equal(unlock.status, 200);
  }
});

test("POST /connectors/unknown_id/creds -> 400", async () => {
  const res = await postJson("/connectors/unknown_id/creds", FAKE_CREDS);
  assert.equal(res.status, 400);
});

test("POST /connectors/gmail/creds stores creds, returns authUrl containing accounts.google.com", async () => {
  const res = await postJson("/connectors/gmail/creds", FAKE_CREDS);
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(typeof res.body.authUrl, "string");
  assert.ok(
    res.body.authUrl.includes("accounts.google.com"),
    `authUrl should include accounts.google.com; got ${res.body.authUrl}`
  );
});

test("POST /connectors/gcal/creds stores creds and authUrl has calendar.readonly scope", async () => {
  const res = await postJson("/connectors/gcal/creds", FAKE_CREDS);
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(typeof res.body.authUrl, "string");
  assert.ok(
    res.body.authUrl.includes("calendar.readonly"),
    `gcal authUrl should reference calendar.readonly scope; got ${res.body.authUrl}`
  );
});

test("POST /connectors/drive/creds stores creds and authUrl has drive.readonly scope", async () => {
  const res = await postJson("/connectors/drive/creds", FAKE_CREDS);
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(typeof res.body.authUrl, "string");
  assert.ok(
    res.body.authUrl.includes("drive.readonly"),
    `drive authUrl should reference drive.readonly scope; got ${res.body.authUrl}`
  );
});

test("GET /connectors after creds set for gmail -> linked=false (no refresh_token yet), available=false", async () => {
  const { status, body } = await getJson("/connectors");
  assert.equal(status, 200);
  // Creds present but no refresh_token -> not linked (per contract: linked = refresh token flow works)
  assert.equal(body.gmail.linked, false, "gmail linked=false without refresh_token");
  assert.equal(body.gmail.available, false, "gmail available=false without refresh_token");
});

test("GET /connectors/gcal/events without refresh_token -> 400 not linked", async () => {
  const res = await getJson("/connectors/gcal/events?days=1");
  assert.equal(res.status, 400, `expected 400 when gcal not linked, got ${res.status}`);
});

test("GET /connectors/drive/search without refresh_token -> 400 not linked", async () => {
  const res = await getJson("/connectors/drive/search?q=foo");
  assert.equal(res.status, 400, `expected 400 when drive not linked, got ${res.status}`);
});

test("POST /connectors/gmail/unlink when nothing is linked -> ok:true no-op", async () => {
  const res = await postJson("/connectors/gmail/unlink");
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
});

test("POST /connectors/gmail/test without key -> ok:false with error", async () => {
  const res = await postJson("/connectors/gmail/test");
  assert.equal(res.status, 200);
  assert.equal(typeof res.body.ok, "boolean");
  assert.equal(res.body.ok, false);
  assert.ok(res.body.error && typeof res.body.error === "string", "error message populated");
});

test("Audit chain verifies after a run of >=8 state-changing calls", async () => {
  const calls = [
    () => postJson("/connectors/gmail/creds", FAKE_CREDS),
    () => postJson("/connectors/gcal/creds", FAKE_CREDS),
    () => postJson("/connectors/drive/creds", FAKE_CREDS),
    () => postJson("/connectors/gmail/unlink"),
    () => postJson("/connectors/gcal/unlink"),
    () => postJson("/connectors/drive/unlink"),
    () => postJson("/connectors/gmail/test"),
    () => postJson("/connectors/gcal/test"),
    () => postJson("/connectors/drive/test"),
  ];

  for (const fn of calls) {
    const res = await fn();
    assert.ok(res.status >= 200 && res.status < 500, `call returned ${res.status}`);
  }

  const { status, body } = await getJson("/audit/verify");
  assert.equal(status, 200);
  assert.ok(body, "audit verify returned body");
  const ok = body.ok ?? body.valid ?? body.verified;
  assert.equal(ok, true, `audit chain should verify; got ${JSON.stringify(body)}`);
});
