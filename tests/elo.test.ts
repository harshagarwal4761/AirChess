import test from "node:test";
import assert from "node:assert/strict";
import { calculateElo } from "../lib/elo";

test("calculateElo updates ratings symmetrically for wins and draws", () => {
  const whiteWin = calculateElo(1200, 1200, "w");
  assert.equal(whiteWin.whiteDelta, 16);
  assert.equal(whiteWin.blackDelta, -16);
  assert.equal(whiteWin.whiteAfter, 1216);
  assert.equal(whiteWin.blackAfter, 1184);

  const equalDraw = calculateElo(1200, 1200, null);
  assert.equal(equalDraw.whiteDelta, 0);
  assert.equal(equalDraw.blackDelta, 0);

  const upset = calculateElo(1000, 1400, "w");
  assert.ok(upset.whiteDelta >= 28);
  assert.ok(upset.blackDelta <= -28);
});
