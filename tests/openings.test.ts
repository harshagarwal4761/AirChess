import assert from "node:assert/strict";
import test from "node:test";
import { detectOpening } from "../lib/openings";

test("detectOpening returns null for an empty move list", () => {
  assert.equal(detectOpening([]), null);
});

test("detectOpening matches deepest opening line", () => {
  assert.deepEqual(detectOpening(["e4", "c5"]), {
    eco: "B20",
    name: "Sicilian Defense",
  });
  assert.deepEqual(
    detectOpening(["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6", "Be3"]),
    {
      eco: "B90",
      name: "Sicilian: Najdorf",
    },
  );
  assert.deepEqual(detectOpening(["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3"]), {
    eco: "C53",
    name: "Italian Game: Giuoco Piano",
  });
});

test("detectOpening strips check markers before matching", () => {
  assert.deepEqual(detectOpening(["e4", "e5", "Nf3", "Nc6", "Bb5+"]), {
    eco: "C60",
    name: "Ruy Lopez",
  });
});
