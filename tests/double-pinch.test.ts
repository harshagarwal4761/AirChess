import test from "node:test";
import assert from "node:assert/strict";
import {
  centerTarget,
  controllerIndex,
  newDoublePinch,
  stepDoublePinch,
  openPalm,
  type Sample,
} from "../lib/double-pinch";
import { pinchRatio, advanceGesture, initialGesture } from "../lib/gestures";
const a = { square: "e2", x: 50, y: 50, size: 100 },
  b = { square: "d2", x: 150, y: 50, size: 100 },
  palm = { x: 50, y: 120 };
function harness() {
  let s = newDoublePinch();
  return (change: Partial<Sample>) => {
    const n = stepDoublePinch(s, {
      now: 0,
      target: a,
      palm,
      edge: null,
      visible: true,
      open: true,
      ...change,
    });
    s = n.state;
    return n;
  };
}
function firstPinch(run: ReturnType<typeof harness>) {
  run({ now: 0 });
  run({ now: 400 });
  run({ now: 500, edge: "grab", open: false });
  return run({ now: 650, edge: "release" });
}
test("two complete pinches confirm one stable square exactly once", () => {
  const run = harness();
  assert.equal(firstPinch(run).state.count, 1);
  run({ now: 850, edge: "grab", open: false });
  assert.equal(run({ now: 1000, edge: "release" }).confirmed, "e2");
  assert.equal(run({ now: 1100, edge: "release" }).confirmed, null);
});
test("a single pinch never selects or moves", () => {
  const run = harness();
  assert.equal(firstPinch(run).confirmed, null);
  assert.equal(run({ now: 3000 }).confirmed, null);
});
test("a target must settle before pinching", () => {
  const run = harness();
  run({ now: 0 });
  const n = run({ now: 100, edge: "grab", open: false });
  assert.equal(n.state.locked, null);
  assert.equal(n.confirmed, null);
});
test("changing hover squares resets the settling timer", () => {
  const run = harness();
  run({ now: 0 });
  run({ now: 400, target: b });
  assert.equal(
    run({ now: 500, target: b, edge: "grab", open: false }).state.locked,
    null,
  );
});
test("first pinch locks the displayed target despite fingertip curl", () => {
  const run = harness();
  firstPinch(run);
  run({ now: 850, edge: "grab", open: false, target: b });
  assert.equal(run({ now: 1000, edge: "release", target: b }).confirmed, "e2");
});
test("moving the palm to a neighboring square cancels instead of retargeting", () => {
  const run = harness();
  firstPinch(run);
  const n = run({ now: 800, palm: { x: 125, y: 120 }, target: b });
  assert.equal(n.cancelled, true);
  assert.equal(n.state.locked, null);
  assert.equal(run({ now: 1000, edge: "release", target: b }).confirmed, null);
});
test("moving while starting a pinch cannot reuse an old hover target", () => {
  const run = harness();
  run({ now: 0 });
  run({ now: 400 });
  assert.equal(
    run({ now: 500, edge: "grab", open: false, palm: { x: 120, y: 120 } }).state
      .locked,
    null,
  );
});
test("tracking loss clears a half-finished sequence", () => {
  const run = harness();
  firstPinch(run);
  assert.equal(run({ now: 800, visible: false }).state.count, 0);
  assert.equal(run({ now: 950, edge: "release" }).confirmed, null);
});
test("timeout clears stale first pinch", () => {
  const run = harness();
  firstPinch(run);
  assert.equal(run({ now: 4100 }).cancelled, true);
});
test("holding a pinch does not count as repeated pinches", () => {
  const run = harness();
  run({ now: 0 });
  run({ now: 400 });
  run({ now: 500, edge: "grab", open: false });
  assert.equal(run({ now: 2100, open: false }).cancelled, true);
});
test("center targeting rejects square borders rather than snapping to a neighbor", () => {
  const rect = { left: 0, top: 0, width: 100, height: 100 };
  assert.equal(centerTarget("e2", rect, { x: 2, y: 50 }), null);
  assert.equal(centerTarget("e2", rect, { x: 98, y: 50 }), null);
  assert.equal(centerTarget("e2", rect, { x: 50, y: 50 })?.square, "e2");
});
test("the support hand never becomes controller when the controller disappears", () => {
  assert.equal(controllerIndex(["Left", "Right"], "Right"), 1);
  assert.equal(controllerIndex(["Left"], "Right"), -1);
  assert.equal(controllerIndex(["Right", "Right"], "Right"), -1);
  assert.equal(controllerIndex(["Left"], null), -1);
});
test("closed or curled fingers do not activate the support effect", () => {
  const p = Array.from({ length: 21 }, () => ({ x: 0, y: 1 }));
  p[0] = { x: 0, y: 0 };
  for (const n of [8, 12, 16, 20]) p[n] = { x: 0, y: 2 };
  assert.equal(openPalm(p), true);
  p[12] = { x: 0, y: 0.7 };
  assert.equal(openPalm(p), false);
});
test("pinch ratio corrects rectangular camera pixels", () => {
  const points = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
  points[4] = { x: 0.1, y: 0 };
  points[8] = { x: 0.2, y: 0 };
  points[5] = { x: 0, y: 0 };
  points[17] = { x: 0, y: 0.2 };
  assert.ok(Math.abs(pinchRatio(points, 2) - 1) < 1e-9);
});
test("real pinch edge machine feeds double-pinch selection without drag", () => {
  let gesture = initialGesture(),
    s = newDoublePinch();
  const confirmations: string[] = [];
  for (const [now, ratio] of [
    [0, 0.9],
    [400, 0.9],
    [450, 0.2],
    [550, 0.2],
    [650, 0.9],
    [750, 0.9],
    [850, 0.2],
    [950, 0.2],
    [1050, 0.9],
    [1150, 0.9],
  ]) {
    const g = advanceGesture(gesture, ratio, now);
    gesture = g.state;
    const n = stepDoublePinch(s, {
      now,
      target: a,
      palm,
      edge: g.event,
      visible: true,
      open: ratio > 0.65 && !gesture.pinched,
    });
    s = n.state;
    if (n.confirmed) confirmations.push(n.confirmed);
  }
  assert.deepEqual(confirmations, ["e2"]);
});
