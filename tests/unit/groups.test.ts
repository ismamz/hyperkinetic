import assert from "node:assert/strict";
import { test } from "node:test";
import gsap from "gsap";

import { leaves } from "../../dist/groups.js";
import type { PageAnimationData, PageTransition } from "../../dist/types.js";

// GSAP tweens plain objects in Node; no DOM is needed to measure positions.
const data = {
  position: 0,
  reduced: false,
  initial: false,
  interrupted: false,
} as PageAnimationData;

const tween = (tl: gsap.core.Timeline, duration: number, position?: gsap.Position) =>
  tl.to({ v: 0 }, { v: 1, duration }, position);

test("leaveEnd measures the real end of each group's contributions on the master timeline", () => {
  const tl = gsap.timeline({ paused: true });
  const recipes: PageTransition[] = [
    { group: "titles", leave: (t) => void tween(t, 0.4) },
    // Starts later and ends later: the measured end follows the last tween.
    { group: "titles", leave: (t) => void tween(t, 0.3, 0.5) },
    { group: "identity", leave: (t) => void tween(t, 0.2, 0.1) },
    // Ungrouped leaves are never measured even though they share the timeline.
    { leave: (t) => void tween(t, 2, 0) },
  ];
  const leaveEnd = leaves(tl, recipes, data);
  // Ends are sums of GSAP positions, so compare with a float tolerance.
  assert.ok(Math.abs(leaveEnd("titles") - 0.8) < 1e-9);
  assert.ok(Math.abs(leaveEnd("identity") - 0.3) < 1e-9);
  assert.equal(tl.duration(), 2);
});

test("unknown groups and groups whose recipe added nothing measure 0", () => {
  const tl = gsap.timeline({ paused: true });
  const leaveEnd = leaves(tl, [{ group: "empty", leave: () => {} }], data);
  assert.equal(leaveEnd("empty"), 0);
  assert.equal(leaveEnd("missing"), 0);
});

test("recipes with leave: false or no leave are skipped", () => {
  const tl = gsap.timeline({ paused: true });
  const calls: string[] = [];
  const leaveEnd = leaves(
    tl,
    [
      { group: "a", leave: false },
      { group: "b" },
      {
        group: "c",
        leave: (t) => {
          calls.push("c");
          tween(t, 0.1);
        },
      },
    ],
    data,
  );
  assert.deepEqual(calls, ["c"]);
  assert.equal(leaveEnd("a"), 0);
  assert.equal(leaveEnd("c"), 0.1);
});
