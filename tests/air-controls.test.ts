import test from "node:test";
import assert from "node:assert/strict";
import { practiceOrientation, reachablePoint } from "../lib/air-controls";
test("practice follows active color or preserves manual orientation", () => {
  assert.equal(practiceOrientation("w", true, true), "w");
  assert.equal(practiceOrientation("b", true, false), "b");
  assert.equal(practiceOrientation("b", false, false), "w");
});
test("optional reach assist maps center area to viewport", () => {
  const v = { width: 1000, height: 800 };
  assert.deepEqual(reachablePoint({ x: 500, y: 400 }, v), { x: 500, y: 400 });
  assert.deepEqual(reachablePoint({ x: 120, y: 96 }, v), { x: 2, y: 2 });
  assert.deepEqual(reachablePoint({ x: 880, y: 704 }, v), { x: 998, y: 798 });
});
