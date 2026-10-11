import test from "node:test";
import assert from "node:assert/strict";
import {
  airBoardAction,
  matchHands,
  practiceOrientation,
  reachablePoint,
  type Pickup,
  type HandId,
} from "../lib/air-controls";
import { advanceGesture, initialGesture } from "../lib/gestures";
import { applyAction, newGame, replay } from "../lib/game";
import type { Square } from "chess.js";
const observation = (x: number, label: string) => ({
  wrist: { x, y: 0.5 },
  label,
});
test("both hands retain identity when detection order reverses", () => {
  const prev = [observation(0.2, "Left"), observation(0.8, "Right")];
  assert.deepEqual(
    matchHands(prev, [observation(0.78, "Right"), observation(0.22, "Left")]),
    [1, 0],
  );
  assert.deepEqual(matchHands(prev, [observation(0.79, "Right")]), [null, 0]);
  assert.deepEqual(matchHands(prev, []), [null, null]);
});
test("nearby wrists keep identity if a handedness label jitters", () => {
  assert.deepEqual(
    matchHands(
      [observation(0.2, "Left"), observation(0.8, "Right")],
      [observation(0.22, "Right"), observation(0.79, "Right")],
    ),
    [0, 1],
  );
});
test("another hand cannot steal, release, or cancel an owned pickup", () => {
  const chess = replay([]);
  let p: Pickup = airBoardAction(
    null,
    { type: "grab", handId: 0 },
    "e2",
    chess,
    true,
  ).pickup;
  assert.ok(p);
  for (const type of ["grab", "release", "cancel"] as const) {
    const next = airBoardAction(p, { type, handId: 1 }, "d2", chess, true);
    assert.deepEqual(next.pickup, p);
    assert.equal(next.move, undefined);
  }
  assert.equal(
    airBoardAction(p, { type: "cancel", handId: 0 }, undefined, chess, true)
      .pickup,
    null,
  );
});
for (const hands of [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
] as HandId[][]) {
  test(`gesture-only self-play: hand ${hands[0] + 1} plays White, hand ${hands[1] + 1} plays Black`, () => {
    let game = newGame(),
      pickup: Pickup = null;
    const states = [initialGesture(), initialGesture()];
    let now = 0;
    const frame = (handId: HandId, ratio: number, square: Square) => {
      const next = advanceGesture(states[handId], ratio, now);
      states[handId] = next.state;
      if (next.event) {
        const chess = replay(game.moves);
        const action = airBoardAction(
          pickup,
          { type: next.event, handId },
          square,
          chess,
          true,
        );
        pickup = action.pickup;
        if (action.move)
          game = applyAction(game, chess.turn(), {
            type: "move",
            ...action.move,
          });
      }
      now += 100;
    };
    for (const [i, from, to] of [
      [0, "e2", "e4"],
      [1, "e7", "e5"],
    ] as const) {
      const id = hands[i];
      frame(id, 0.9, from);
      frame(id, 0.2, from);
      frame(id, 0.2, from);
      frame(id, 0.2, to);
      frame(id, 0.9, to);
      frame(id, 0.9, to);
    }
    assert.deepEqual(game.moves, ["e4", "e5"]);
    assert.equal(pickup, null);
  });
}
test("practice follows the active color while manual orientation remains available", () => {
  assert.equal(practiceOrientation("w", true, true), "w");
  assert.equal(practiceOrientation("b", true, false), "b");
  assert.equal(practiceOrientation("b", false, false), "w");
});
test("reach assist maps the central camera area to the full board area", () => {
  const view = { width: 1000, height: 800 };
  assert.deepEqual(reachablePoint({ x: 500, y: 400 }, view), {
    x: 500,
    y: 400,
  });
  assert.deepEqual(reachablePoint({ x: 120, y: 96 }, view), { x: 2, y: 2 });
  assert.deepEqual(reachablePoint({ x: 880, y: 704 }, view), {
    x: 998,
    y: 798,
  });
});
test("wrong-turn pieces and disabled room input do not acquire a pickup", () => {
  const c = replay([]);
  assert.equal(
    airBoardAction(null, { type: "grab", handId: 0 }, "e7", c, true).pickup,
    null,
  );
  assert.equal(
    airBoardAction(null, { type: "grab", handId: 1 }, "e2", c, false).pickup,
    null,
  );
});

test("ambiguous crossing cancels matching rather than assigning a different owner", () => {
  const previous = [observation(0.48, "Left"), observation(0.52, "Left")];
  assert.deepEqual(matchHands(previous, [observation(0.5, "Left")]), [
    null,
    null,
  ]);
  assert.deepEqual(
    matchHands(previous, [observation(0.5, "Left"), observation(0.5, "Left")]),
    [null, null],
  );
});
