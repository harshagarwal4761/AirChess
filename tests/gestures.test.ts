import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceGesture,
  initialGesture,
  projectPoint,
  pinchRatio,
} from "../lib/gestures";
test("a hand acquired while pinched cannot accidentally grab", () => {
  let s = initialGesture();
  for (const t of [0, 100, 200, 400]) {
    const n = advanceGesture(s, 0.2, t);
    assert.equal(n.event, null);
    s = n.state;
  }
  assert.equal(s.armed, false);
});
test("open hand arms, stable pinch grabs, hysteresis resists jitter, release waits", () => {
  let s = advanceGesture(initialGesture(), 0.9, 0).state;
  s = advanceGesture(s, 0.2, 10).state;
  assert.equal(advanceGesture(s, 0.2, 80).event, null);
  let n = advanceGesture(s, 0.2, 110);
  assert.equal(n.event, "grab");
  s = n.state;
  n = advanceGesture(s, 0.5, 150);
  assert.equal(n.event, null);
  assert.equal(n.state.pinched, true);
  s = n.state;
  s = advanceGesture(s, 0.9, 200).state;
  assert.equal(advanceGesture(s, 0.9, 240).event, null);
  n = advanceGesture(s, 0.9, 300);
  assert.equal(n.event, "release");
});
test("tracking loss cancels and requires rearming", () => {
  const n = advanceGesture(
    { pinched: true, candidate: true, since: 0, armed: true },
    null,
    100,
  );
  assert.equal(n.event, "cancel");
  assert.equal(n.state.armed, false);
});
test("mirrored coordinates account for object-fit cover cropping", () => {
  assert.deepEqual(
    projectPoint(
      { x: 0.2, y: 0.3 },
      { width: 100, height: 100 },
      { width: 200, height: 200 },
    ),
    { x: 160, y: 60 },
  );
  assert.deepEqual(
    projectPoint(
      { x: 0.5, y: 0.5 },
      { width: 1920, height: 1080 },
      { width: 1000, height: 1000 },
    ),
    { x: 500, y: 500 },
  );
});
test("pinch measurement is independent of hand scale", () => {
  const p = Array.from({ length: 21 }, () => ({ x: 0.2, y: 0.2 }));
  p[17] = { x: 0.6, y: 0.2 };
  p[4] = { x: 0.3, y: 0.2 };
  p[8] = { x: 0.4, y: 0.2 };
  assert.ok(
    Math.abs(
      pinchRatio(p) -
        pinchRatio(p.map((v) => ({ x: v.x * 0.5, y: v.y * 0.5 }))),
    ) < 1e-9,
  );
});
