import test from "node:test";
import assert from "node:assert/strict";
import { classifyGesture, GestureSmoother } from "../lib/gesture-classifier";
import type { Point } from "../lib/gestures";

function makePose(kind: "open" | "pinch" | "fist" | "peace", tilt = 0, mirror = 1, aspect = 1): Point[] {
  const p: [number, number][] = Array.from({ length: 21 }, () => [0, 0]);
  p[0] = [0, 0];
  p[1] = [-0.28, -0.22];
  p[2] = [-0.46, -0.45];
  p[5] = [-0.36, -0.95];
  p[9] = [-0.08, -1.0];
  p[13] = [0.18, -0.94];
  p[17] = [0.42, -0.82];

  const ext = (mcp: number, pip: number, dip: number, tip: number, up: boolean) => {
    const [mx, my] = p[mcp];
    if (up) {
      p[pip] = [mx, my - 0.36];
      p[dip] = [mx, my - 0.62];
      p[tip] = [mx, my - 0.88];
    } else {
      p[pip] = [mx, my - 0.25];
      p[dip] = [mx * 0.7, my + 0.12];
      p[tip] = [mx * 0.5, my + 0.32];
    }
  };

  if (kind === "open") {
    p[3] = [-0.62, -0.72];
    p[4] = [-0.84, -1.02];
    ext(5, 6, 7, 8, true);
    ext(9, 10, 11, 12, true);
    ext(13, 14, 15, 16, true);
    ext(17, 18, 19, 20, true);
  } else if (kind === "pinch") {
    p[3] = [-0.48, -1.02];
    p[4] = [-0.32, -1.48];
    p[6] = [-0.38, -1.32];
    p[7] = [-0.35, -1.46];
    p[8] = [-0.32, -1.48];
    ext(9, 10, 11, 12, true);
    ext(13, 14, 15, 16, true);
    ext(17, 18, 19, 20, true);
  } else if (kind === "fist") {
    p[3] = [-0.25, -0.58];
    p[4] = [-0.04, -0.66];
    ext(5, 6, 7, 8, false);
    ext(9, 10, 11, 12, false);
    ext(13, 14, 15, 16, false);
    ext(17, 18, 19, 20, false);
  } else {
    p[3] = [-0.2, -0.58];
    p[4] = [0.08, -0.64];
    ext(5, 6, 7, 8, true);
    ext(9, 10, 11, 12, true);
    p[8][0] -= 0.14;
    p[12][0] += 0.14;
    ext(13, 14, 15, 16, false);
    ext(17, 18, 19, 20, false);
  }

  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  return p.map(([lx, ly]) => {
    const mx = lx * mirror;
    return {
      x: 0.5 + ((mx * cos - ly * sin) * 0.12) / aspect,
      y: 0.5 + (mx * sin + ly * cos) * 0.12,
    };
  });
}

test("trained gesture MLP classifies open, pinch, fist, and peace across hand tilt and mirroring", () => {
  for (const kind of ["open", "pinch", "fist", "peace"] as const) {
    const upright = classifyGesture(makePose(kind, 0, 1, 4 / 3), 4 / 3);
    assert.equal(upright.label, kind);
    assert.ok(upright.confidence > 0.85, `${kind} upright confidence=${upright.confidence}`);

    const tiltedMirrored = classifyGesture(makePose(kind, 0.45, -1, 16 / 9), 16 / 9);
    assert.equal(tiltedMirrored.label, kind);
    assert.ok(
      tiltedMirrored.confidence > 0.8,
      `${kind} tilted+mirrored confidence=${tiltedMirrored.confidence}`,
    );
  }
});

test("GestureSmoother damps single-frame classification noise", () => {
  const smoother = new GestureSmoother();
  const openPred = classifyGesture(makePose("open"), 1);
  const fistPred = classifyGesture(makePose("fist"), 1);
  smoother.update(openPred);
  smoother.update(openPred);
  const noisy = smoother.update(fistPred, 0.35);
  assert.equal(noisy.label, "open");
});
