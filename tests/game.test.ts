import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { applyAction, newGame, outcome, replay } from "../lib/game";
test("legal moves alternate and reject wrong player and illegal moves", () => {
  const state = applyAction(newGame(), "w", {
    type: "move",
    from: "e2",
    to: "e4",
  });
  assert.deepEqual(state.moves, ["e4"]);
  assert.throws(
    () => applyAction(state, "w", { type: "move", from: "d2", to: "d4" }),
    /turn/,
  );
  assert.throws(
    () => applyAction(state, "b", { type: "move", from: "e7", to: "e4" }),
    /legal/,
  );
});
test("castling moves both king and rook and cannot cross attacked squares", () => {
  const c = replay(["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "O-O"]);
  assert.equal(c.get("g1")?.type, "k");
  assert.equal(c.get("f1")?.type, "r");
  assert.equal(c.get("h1"), undefined);
  const attacked = new Chess("r3k2r/8/8/8/2b5/8/8/R3K2R w KQkq - 0 1");
  assert.ok(!attacked.moves().includes("O-O"));
});
test("en passant capture removes the passed pawn", () => {
  const c = replay(["e4", "a6", "e5", "d5", "exd6"]);
  assert.equal(c.get("d6")?.color, "w");
  assert.equal(c.get("d5"), undefined);
});
test("promotion supports all four choices", () => {
  for (const piece of ["q", "r", "b", "n"]) {
    const c = new Chess("7k/P7/8/8/8/8/8/7K w - - 0 1");
    c.move({ from: "a7", to: "a8", promotion: piece });
    assert.equal(c.get("a8")?.type, piece);
  }
});
test("checkmate ends the game and prevents further actions", () => {
  const s = { ...newGame(), moves: ["f3", "e5", "g4"] };
  const next = applyAction(s, "b", { type: "move", from: "d8", to: "h4" });
  assert.equal(next.result?.winner, "b");
  assert.match(next.result!.text, /checkmate/);
  assert.throws(
    () => applyAction(next, "w", { type: "move", from: "e2", to: "e4" }),
    /ended/,
  );
});
test("stalemate, material and fifty-move draws are recognized", () => {
  assert.match(
    outcome(new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"))!.text,
    /stalemate/,
  );
  assert.match(
    outcome(new Chess("7k/8/6K1/8/8/8/8/8 w - - 0 1"))!.text,
    /material/,
  );
  assert.match(
    outcome(new Chess("7k/8/6K1/8/8/8/8/R7 w - - 100 51"))!.text,
    /fifty/,
  );
});
test("replaying complete history preserves repetition detection", () => {
  const c = replay(["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1", "Ng8"]);
  assert.match(outcome(c)!.text, /threefold/);
});
test("draw agreement needs opponent consent and rematch needs both players", () => {
  let s = applyAction(newGame(), "w", { type: "offer-draw" });
  assert.throws(() => applyAction(s, "w", { type: "accept-draw" }), /opponent/);
  s = applyAction(s, "b", { type: "accept-draw" });
  assert.equal(s.result?.winner, null);
  s = applyAction(s, "w", { type: "rematch" });
  assert.ok(s.result);
  assert.equal(s.rematch, "w");
  const same = applyAction(s, "w", { type: "rematch" });
  assert.ok(same.result);
  s = applyAction(s, "b", { type: "rematch" });
  assert.equal(s.result, null);
  assert.equal(s.game, 2);
  assert.deepEqual(s.moves, []);
});
test("resignation awards the opponent and cannot be undone", () => {
  const s = applyAction(newGame(), "b", { type: "resign" });
  assert.equal(s.result?.winner, "w");
  assert.throws(() => applyAction(s, "w", { type: "offer-draw" }), /ended/);
});
