import assert from "node:assert/strict";
import { test } from "node:test";

import { reducer, type PageEntry, type State } from "../../dist/reducer.js";

const page = (key: string, extra: Partial<PageEntry> = {}): PageEntry => ({
  key,
  locationKey: `loc-${key}`,
  outlet: null,
  pathname: `/${key}`,
  entered: false,
  earlyReady: false,
  ...extra,
});

const rest = (): State => ({ gen: 0, initial: true, interrupted: false, pages: [page("page-1")] });

const navigate = (state: State, key: string) =>
  reducer(state, { type: "NAVIGATE", next: page(key), prevOutlet: "frozen" });

test("NAVIGATE freezes the outgoing outlet and clears initial", () => {
  const next = navigate(rest(), "page-2");
  assert.equal(next.gen, 1);
  assert.equal(next.initial, false);
  assert.equal(next.interrupted, false);
  assert.deepEqual(
    next.pages.map((p) => [p.key, p.outlet]),
    [
      ["page-1", "frozen"],
      ["page-2", null],
    ],
  );
  // The outgoing page keeps the navigation it belongs to; the loader-data
  // snapshot is keyed on it.
  assert.deepEqual(
    next.pages.map((p) => p.locationKey),
    ["loc-page-1", "loc-page-2"],
  );
});

test("a navigation while the incoming page is still entering is interrupted", () => {
  const mid = navigate(rest(), "page-2");
  const again = navigate(mid, "page-3");
  assert.equal(again.interrupted, true);
  // The page that never finished entering becomes the outgoing one.
  assert.deepEqual(
    again.pages.map((p) => p.key),
    ["page-2", "page-3"],
  );
});

test("ENTERED_AND_TRIM leaves one entered page and the next navigation is not interrupted", () => {
  const mid = navigate(rest(), "page-2");
  const done = reducer(mid, { type: "ENTERED_AND_TRIM", key: "page-2" });
  assert.deepEqual(
    done.pages.map((p) => [p.key, p.entered]),
    [["page-2", true]],
  );
  assert.equal(navigate(done, "page-3").interrupted, false);
});

test("ENTERED (retained pages) keeps both pages and the next navigation is not interrupted", () => {
  const mid = navigate(rest(), "page-2");
  const retained = reducer(mid, { type: "ENTERED", key: "page-2" });
  assert.equal(retained.pages.length, 2);
  assert.equal(retained.pages[1].entered, true);
  assert.equal(retained.pages[0].entered, false);
  const next = navigate(retained, "page-3");
  assert.equal(next.interrupted, false);
  // The old outgoing page is dropped; the retained incoming page becomes outgoing.
  assert.deepEqual(
    next.pages.map((p) => p.key),
    ["page-2", "page-3"],
  );
});

test("READY, ENTERED and ENTERED_AND_TRIM ignore stale keys and are idempotent", () => {
  const mid = navigate(rest(), "page-2");
  assert.equal(reducer(mid, { type: "READY", key: "page-1" }), mid);
  assert.equal(reducer(mid, { type: "ENTERED", key: "page-1" }), mid);
  assert.equal(reducer(mid, { type: "ENTERED_AND_TRIM", key: "page-1" }), mid);
  const ready = reducer(mid, { type: "READY", key: "page-2" });
  assert.equal(ready.pages[1].earlyReady, true);
  assert.equal(reducer(ready, { type: "READY", key: "page-2" }), ready);
  const entered = reducer(ready, { type: "ENTERED", key: "page-2" });
  assert.equal(reducer(entered, { type: "ENTERED", key: "page-2" }), entered);
});

test("first load: ENTERED_AND_TRIM on the only page clears initial", () => {
  const done = reducer(rest(), { type: "ENTERED_AND_TRIM", key: "page-1" });
  assert.equal(done.initial, false);
  assert.deepEqual(
    done.pages.map((p) => [p.key, p.entered]),
    [["page-1", true]],
  );
});
