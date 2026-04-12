import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { startDaemon, getJson, postJson, del } from "./helpers.mjs";

let daemon;

before(async () => {
  daemon = await startDaemon();
});

after(async () => {
  if (daemon) await daemon.stop();
});

function isoDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function offsetIso(msFromNow) {
  return new Date(Date.now() + msFromNow).toISOString();
}

/**
 * Returns an ISO timestamp for H:M on TODAY (local time). Time-of-day-safe:
 * always lands inside the current local day regardless of when the suite
 * runs. Offsets from `now` are not safe because near midnight they roll
 * into tomorrow.
 */
function todayAt(hours, minutes = 0) {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

test("GET /today on a fresh daemon → returns empty TodayView shape", async () => {
  const { status, body } = await getJson("/today");
  assert.equal(status, 200);
  assert.ok(body && typeof body === "object", "today body present");
  assert.equal(typeof body.date, "string");
  assert.match(body.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Array.isArray(body.events), "events is array");
  assert.deepEqual(body.focusBlocks, []);
  assert.deepEqual(body.all, body.events); // focus blocks are empty, so all == events
  assert.equal(body.conflictCount, 0);
});

test("POST /focus-blocks with valid body → inserts and returns FocusBlock with id", async () => {
  const start = offsetIso(60 * 60 * 1000);        // +1h
  const end = offsetIso(90 * 60 * 1000);          // +1.5h
  const { status, body } = await postJson("/focus-blocks", {
    title: "Deep work",
    start,
    end,
    notes: "test block",
  });
  assert.equal(status, 200, `unexpected status ${status}: ${JSON.stringify(body)}`);
  assert.ok(body && typeof body === "object");
  assert.equal(typeof body.id, "string");
  assert.ok(body.id.length > 0);
  assert.equal(body.title, "Deep work");
  assert.equal(body.start, start);
  assert.equal(body.end, end);
  assert.equal(body.notes, "test block");
  assert.equal(typeof body.createdAt, "string");

  // Clean up via API so later tests start from a predictable state.
  await del(`/focus-blocks/${body.id}`);
});

test("GET /focus-blocks contains newly created block", async () => {
  const start = offsetIso(2 * 60 * 60 * 1000);
  const end = offsetIso(3 * 60 * 60 * 1000);
  const created = await postJson("/focus-blocks", {
    title: "Plan day",
    start,
    end,
  });
  assert.equal(created.status, 200);
  const id = created.body.id;

  const day = isoDate(new Date(start));
  const listed = await getJson(`/focus-blocks?day=${day}`);
  assert.equal(listed.status, 200);
  assert.ok(Array.isArray(listed.body));
  const found = listed.body.find((b) => b.id === id);
  assert.ok(found, `focus block ${id} should be in list`);
  assert.equal(found.title, "Plan day");

  await del(`/focus-blocks/${id}`);
});

test("GET /today → new block appears in focusBlocks and all, conflictCount=0", async () => {
  const start = todayAt(9, 0);
  const end = todayAt(10, 0);
  const created = await postJson("/focus-blocks", {
    title: "Write report",
    start,
    end,
  });
  assert.equal(created.status, 200);
  const id = created.body.id;

  const { status, body } = await getJson("/today");
  assert.equal(status, 200);
  const fb = body.focusBlocks.find((b) => b.id === id);
  assert.ok(fb, "focus block present in today.focusBlocks");
  assert.equal(fb.kind, "focus");
  assert.equal(fb.title, "Write report");
  assert.deepEqual(fb.conflictsWith, []);

  const allEntry = body.all.find((b) => b.id === id);
  assert.ok(allEntry, "focus block present in today.all");
  assert.equal(body.conflictCount, 0);

  await del(`/focus-blocks/${id}`);
});

test("POST /focus-blocks with start >= end → 400", async () => {
  const t = offsetIso(6 * 60 * 60 * 1000);
  const eq = await postJson("/focus-blocks", {
    title: "Bad equal",
    start: t,
    end: t,
  });
  assert.equal(eq.status, 400, `expected 400 for start==end, got ${eq.status}`);

  const start = offsetIso(7 * 60 * 60 * 1000);
  const end = offsetIso(6 * 60 * 60 * 1000); // before start
  const inv = await postJson("/focus-blocks", {
    title: "Bad inverted",
    start,
    end,
  });
  assert.equal(inv.status, 400, `expected 400 for start>end, got ${inv.status}`);
});

test("POST /focus-blocks for a non-today day → not in /today, present in list for that day", async () => {
  // +3 days to be safely outside "today" in any reasonable tz
  const base = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  base.setHours(10, 0, 0, 0);
  const start = base.toISOString();
  const end = new Date(base.getTime() + 60 * 60 * 1000).toISOString();
  const created = await postJson("/focus-blocks", {
    title: "Future block",
    start,
    end,
  });
  assert.equal(created.status, 200);
  const id = created.body.id;

  // Listing for that day should include it
  const day = isoDate(base);
  const listed = await getJson(`/focus-blocks?day=${day}`);
  assert.equal(listed.status, 200);
  assert.ok(Array.isArray(listed.body));
  assert.ok(listed.body.find((b) => b.id === id), "future block present in that day's list");

  // /today should NOT include it
  const today = await getJson("/today");
  assert.equal(today.status, 200);
  assert.ok(
    !today.body.focusBlocks.find((b) => b.id === id),
    "future block must not appear in today.focusBlocks",
  );
  assert.ok(
    !today.body.all.find((b) => b.id === id),
    "future block must not appear in today.all",
  );

  await del(`/focus-blocks/${id}`);
});

test("Two overlapping focus blocks → each conflictsWith the other, conflictCount=2", async () => {
  const aStart = todayAt(11, 0);
  const aEnd = todayAt(13, 0);
  const bStart = todayAt(12, 0); // overlaps
  const bEnd = todayAt(14, 0);

  const a = await postJson("/focus-blocks", { title: "A", start: aStart, end: aEnd });
  const b = await postJson("/focus-blocks", { title: "B", start: bStart, end: bEnd });
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  const aId = a.body.id;
  const bId = b.body.id;

  const { status, body } = await getJson("/today");
  assert.equal(status, 200);
  const aItem = body.focusBlocks.find((x) => x.id === aId);
  const bItem = body.focusBlocks.find((x) => x.id === bId);
  assert.ok(aItem && bItem, "both blocks present");
  assert.ok(aItem.conflictsWith.includes(bId), "A conflictsWith B");
  assert.ok(bItem.conflictsWith.includes(aId), "B conflictsWith A");
  assert.equal(body.conflictCount, 2);

  await del(`/focus-blocks/${aId}`);
  await del(`/focus-blocks/${bId}`);
});

test("Three overlapping focus blocks → conflictCount=3, each conflictsWith has the other two", async () => {
  const s1 = todayAt(15, 0);
  const e1 = todayAt(18, 0);
  const s2 = todayAt(16, 0);
  const e2 = todayAt(19, 0);
  const s3 = todayAt(17, 0);
  const e3 = todayAt(20, 0);

  const r1 = await postJson("/focus-blocks", { title: "one", start: s1, end: e1 });
  const r2 = await postJson("/focus-blocks", { title: "two", start: s2, end: e2 });
  const r3 = await postJson("/focus-blocks", { title: "three", start: s3, end: e3 });
  assert.equal(r1.status, 200);
  assert.equal(r2.status, 200);
  assert.equal(r3.status, 200);
  const ids = [r1.body.id, r2.body.id, r3.body.id];

  const { status, body } = await getJson("/today");
  assert.equal(status, 200);
  const items = ids.map((id) => body.focusBlocks.find((x) => x.id === id));
  assert.ok(items.every(Boolean), "all three blocks present in today");

  for (const item of items) {
    const others = ids.filter((id) => id !== item.id);
    for (const otherId of others) {
      assert.ok(
        item.conflictsWith.includes(otherId),
        `${item.id} should conflictsWith ${otherId}; got ${JSON.stringify(item.conflictsWith)}`,
      );
    }
  }
  assert.equal(body.conflictCount, 3);

  for (const id of ids) await del(`/focus-blocks/${id}`);
});

test("DELETE /focus-blocks/:id → ok:true → GET /today no longer includes it", async () => {
  const start = todayAt(21, 0);
  const end = todayAt(22, 0);
  const created = await postJson("/focus-blocks", {
    title: "To delete",
    start,
    end,
  });
  assert.equal(created.status, 200);
  const id = created.body.id;

  const before = await getJson("/today");
  assert.ok(before.body.focusBlocks.find((b) => b.id === id), "present before delete");

  const delRes = await del(`/focus-blocks/${id}`);
  assert.equal(delRes.status, 200);
  assert.equal(delRes.body?.ok, true);

  const after = await getJson("/today");
  assert.ok(!after.body.focusBlocks.find((b) => b.id === id), "absent after delete");
  assert.ok(!after.body.all.find((b) => b.id === id), "absent in all after delete");
});

test("DELETE /focus-blocks/:id for unknown id → 404", async () => {
  const res = await del("/focus-blocks/does-not-exist-xyz-123");
  assert.equal(res.status, 404, `expected 404 for unknown id, got ${res.status}`);
});

test("Audit chain verifies after the full round", async () => {
  const { status, body } = await getJson("/audit/verify");
  assert.equal(status, 200);
  assert.ok(body, "audit verify returned body");
  const ok = body.ok ?? body.valid ?? body.verified;
  assert.equal(ok, true, `audit chain should verify; got ${JSON.stringify(body)}`);
});
