import test from "node:test";
import assert from "node:assert/strict";
import { evalWinPercent, formatEval, parseBestMove, parseUciInfo, parseUciMove } from "../lib/stockfish";

test("parseUciMove parses standard and promotion moves and rejects invalid tokens", () => {
  assert.deepEqual(parseUciMove("e2e4"), { from: "e2", to: "e4", promotion: undefined });
  assert.deepEqual(parseUciMove("a7a8q"), { from: "a7", to: "a8", promotion: "q" });
  assert.equal(parseUciMove("(none)"), null);
  assert.equal(parseUciMove("invalid"), null);
});

test("parseUciInfo normalizes cp and mate scores to White perspective", () => {
  const whiteInfo = parseUciInfo(
    "info depth 10 seldepth 14 multipv 1 score cp 145 nodes 12000 pv e2e4 e7e5",
    "w",
  );
  assert.equal(whiteInfo?.depth, 10);
  assert.deepEqual(whiteInfo?.score, { type: "cp", value: 145 });
  assert.deepEqual(whiteInfo?.bestMove, { from: "e2", to: "e4", promotion: undefined });

  const blackAheadInfo = parseUciInfo(
    "info depth 9 score cp 210 pv d7d5",
    "b",
  );
  assert.deepEqual(blackAheadInfo?.score, { type: "cp", value: -210 });

  const blackMateInfo = parseUciInfo(
    "info depth 12 score mate 3 pv d8h4",
    "b",
  );
  assert.deepEqual(blackMateInfo?.score, { type: "mate", value: -3 });
});

test("parseBestMove extracts engine reply", () => {
  assert.deepEqual(parseBestMove("bestmove g1f3 ponder e7e5"), {
    from: "g1",
    to: "f3",
    promotion: undefined,
  });
  assert.equal(parseBestMove("bestmove (none)"), null);
});

test("formatEval and evalWinPercent reflect advantage cleanly", () => {
  assert.equal(formatEval(null), "0.0");
  assert.equal(formatEval({ type: "cp", value: 145 }), "+1.5");
  assert.equal(formatEval({ type: "cp", value: -82 }), "-0.8");
  assert.equal(formatEval({ type: "cp", value: 3 }), "0.0");
  assert.equal(formatEval({ type: "mate", value: 2 }), "+M2");
  assert.equal(formatEval({ type: "mate", value: -1 }), "-M1");

  assert.equal(evalWinPercent(null), 50);
  assert.ok(evalWinPercent({ type: "cp", value: 300 }) > 70);
  assert.ok(evalWinPercent({ type: "cp", value: -300 }) < 30);
  assert.equal(evalWinPercent({ type: "mate", value: 2 }), 100);
  assert.equal(evalWinPercent({ type: "mate", value: -2 }), 0);
});
