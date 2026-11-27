import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  extractGestureFeatures,
  FEATURE_COUNT,
  GESTURE_LABELS,
  type GestureLabel,
} from "../lib/gesture-features";
import type { Point } from "../lib/gestures";

type Sample = { features: number[]; labelIdx: number };

// Deterministic PRNG for reproducible dataset generation and train/val split.
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number) {
  const u = Math.max(1e-7, rand());
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Synthesize biomechanically varied 21-keypoint hand poses across scale, roll, and handedness. */
function synthesizePose(label: GestureLabel, rand: () => number): { points: Point[]; aspect: number } {
  const aspect = [1, 4 / 3, 16 / 9][Math.floor(rand() * 3)];
  const scale = 0.08 + rand() * 0.12;
  const tilt = (rand() - 0.5) * 1.1; // +-31 deg wrist roll
  const mirror = rand() < 0.5 ? -1 : 1;
  const cx = 0.2 + rand() * 0.6;
  const cy = 0.25 + rand() * 0.55;
  const noise = () => gaussian(rand) * 0.015;

  // Base hand coordinates in palm units (wrist at 0,0; middle MCP at 0, -1).
  const p: [number, number][] = Array.from({ length: 21 }, () => [0, 0]);
  p[0] = [0, 0];
  p[1] = [-0.28, -0.22];
  p[2] = [-0.46, -0.45];
  p[5] = [-0.36, -0.95];
  p[9] = [-0.08, -1.0];
  p[13] = [0.18, -0.94];
  p[17] = [0.42, -0.82];

  const setFinger = (mcp: number, pip: number, dip: number, tip: number, extended: number) => {
    const [mx, my] = p[mcp];
    const spread = (mcp - 9) * 0.03;
    if (extended > 0.65) {
      const len = 0.85 + (rand() - 0.5) * 0.16;
      p[pip] = [mx + spread * 0.6, my - len * 0.42];
      p[dip] = [mx + spread * 0.9, my - len * 0.72];
      p[tip] = [mx + spread * 1.1, my - len];
    } else {
      // Curled finger: PIP extends slightly, TIP folds back toward palm center.
      p[pip] = [mx + spread * 0.3, my - 0.28 + (rand() - 0.5) * 0.08];
      p[dip] = [mx * 0.7, my + 0.12 + (rand() - 0.5) * 0.08];
      p[tip] = [mx * 0.5, my + 0.32 + (rand() - 0.5) * 0.1];
    }
  };

  if (label === "open") {
    p[3] = [-0.62, -0.72];
    p[4] = [-0.78 - rand() * 0.15, -0.95 - rand() * 0.15];
    setFinger(5, 6, 7, 8, 1);
    setFinger(9, 10, 11, 12, 1);
    setFinger(13, 14, 15, 16, 1);
    setFinger(17, 18, 19, 20, 1);
  } else if (label === "pinch") {
    const targetX = -0.32 + (rand() - 0.5) * 0.12;
    const targetY = -1.48 + (rand() - 0.5) * 0.14;
    p[3] = [-0.48, -1.02];
    p[4] = [targetX + (rand() - 0.5) * 0.07, targetY + (rand() - 0.5) * 0.07];
    p[6] = [-0.38, -1.32];
    p[7] = [-0.35, -1.46];
    p[8] = [targetX, targetY];
    // Remaining fingers may stay open or naturally relaxed during pinch.
    const rest = rand() < 0.7 ? 1 : 0.2;
    setFinger(9, 10, 11, 12, rest);
    setFinger(13, 14, 15, 16, rest);
    setFinger(17, 18, 19, 20, rest);
  } else if (label === "fist") {
    p[3] = [-0.25, -0.58];
    p[4] = [-0.04 + (rand() - 0.5) * 0.12, -0.66 + (rand() - 0.5) * 0.1];
    setFinger(5, 6, 7, 8, 0);
    setFinger(9, 10, 11, 12, 0);
    setFinger(13, 14, 15, 16, 0);
    setFinger(17, 18, 19, 20, 0);
  } else {
    // Peace sign: index + middle extended, thumb/ring/pinky tucked.
    p[3] = [-0.2, -0.58];
    p[4] = [0.08 + (rand() - 0.5) * 0.1, -0.64 + (rand() - 0.5) * 0.08];
    setFinger(5, 6, 7, 8, 1);
    setFinger(9, 10, 11, 12, 1);
    p[8][0] -= 0.14;
    p[12][0] += 0.14;
    setFinger(13, 14, 15, 16, 0);
    setFinger(17, 18, 19, 20, 0);
  }

  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  const points: Point[] = p.map(([lx, ly]) => {
    const mx = lx * mirror + noise();
    const my = ly + noise();
    const rx = mx * cos - my * sin;
    const ry = mx * sin + my * cos;
    return {
      x: cx + (rx * scale) / aspect,
      y: cy + ry * scale,
    };
  });
  return { points, aspect };
}

function buildDataset(rand: () => number): Sample[] {
  const samples: Sample[] = [];
  for (let labelIdx = 0; labelIdx < GESTURE_LABELS.length; labelIdx++) {
    const label = GESTURE_LABELS[labelIdx];
    for (let i = 0; i < 650; i++) {
      const { points, aspect } = synthesizePose(label, rand);
      samples.push({ features: extractGestureFeatures(points, aspect), labelIdx });
    }
  }

  // Merge user-recorded webcam samples if available.
  const recordedPath = fileURLToPath(new URL("../ml/recorded-gestures.json", import.meta.url));
  if (existsSync(recordedPath)) {
    const recorded = JSON.parse(readFileSync(recordedPath, "utf8")) as {
      label: GestureLabel;
      points: Point[];
      aspect?: number;
    }[];
    for (const item of recorded) {
      const labelIdx = GESTURE_LABELS.indexOf(item.label);
      if (labelIdx >= 0 && Array.isArray(item.points)) {
        samples.push({
          features: extractGestureFeatures(item.points, item.aspect ?? 1),
          labelIdx,
        });
      }
    }
  }

  for (let i = samples.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [samples[i], samples[j]] = [samples[j], samples[i]];
  }
  return samples;
}

function main() {
  const rand = mulberry32(20261127);
  const all = buildDataset(rand);
  const split = Math.floor(all.length * 0.8);
  const train = all.slice(0, split);
  const val = all.slice(split);

  // Feature standardization computed strictly on training split.
  const mean = new Array(FEATURE_COUNT).fill(0);
  const std = new Array(FEATURE_COUNT).fill(0);
  for (const s of train) for (let i = 0; i < FEATURE_COUNT; i++) mean[i] += s.features[i];
  for (let i = 0; i < FEATURE_COUNT; i++) mean[i] /= train.length;
  for (const s of train) for (let i = 0; i < FEATURE_COUNT; i++) std[i] += (s.features[i] - mean[i]) ** 2;
  for (let i = 0; i < FEATURE_COUNT; i++) std[i] = Math.max(1e-4, Math.sqrt(std[i] / train.length));

  const norm = (x: number[]) => x.map((v, i) => (v - mean[i]) / std[i]);
  const trainX = train.map((s) => norm(s.features));
  const valX = val.map((s) => norm(s.features));

  const H = 24;
  const C = GESTURE_LABELS.length;
  const w1 = Array.from({ length: H }, () =>
    Array.from({ length: FEATURE_COUNT }, () => gaussian(rand) * Math.sqrt(2 / FEATURE_COUNT)),
  );
  const b1 = new Array(H).fill(0);
  const w2 = Array.from({ length: C }, () =>
    Array.from({ length: H }, () => gaussian(rand) * Math.sqrt(2 / H)),
  );
  const b2 = new Array(C).fill(0);

  // Adam state.
  const lr = 0.012;
  const beta1 = 0.9;
  const beta2 = 0.999;
  const eps = 1e-8;
  const wd = 1e-4;
  const mW1 = w1.map((r) => r.map(() => 0));
  const vW1 = w1.map((r) => r.map(() => 0));
  const mB1 = new Array(H).fill(0);
  const vB1 = new Array(H).fill(0);
  const mW2 = w2.map((r) => r.map(() => 0));
  const vW2 = w2.map((r) => r.map(() => 0));
  const mB2 = new Array(C).fill(0);
  const vB2 = new Array(C).fill(0);

  let step = 0;
  const epochs = 45;
  const batchSize = 64;

  for (let epoch = 0; epoch < epochs; epoch++) {
    for (let start = 0; start < trainX.length; start += batchSize) {
      step++;
      const end = Math.min(trainX.length, start + batchSize);
      const bs = end - start;
      const gW1 = w1.map((r) => r.map(() => 0));
      const gB1 = new Array(H).fill(0);
      const gW2 = w2.map((r) => r.map(() => 0));
      const gB2 = new Array(C).fill(0);

      for (let n = start; n < end; n++) {
        const x = trainX[n];
        const y = train[n].labelIdx;
        const hPre = new Array(H);
        const h = new Array(H);
        for (let i = 0; i < H; i++) {
          let sum = b1[i];
          for (let j = 0; j < FEATURE_COUNT; j++) sum += w1[i][j] * x[j];
          hPre[i] = sum;
          h[i] = sum > 0 ? sum : 0;
        }
        const logits = new Array(C);
        let maxLogit = -Infinity;
        for (let c = 0; c < C; c++) {
          let sum = b2[c];
          for (let i = 0; i < H; i++) sum += w2[c][i] * h[i];
          logits[c] = sum;
          if (sum > maxLogit) maxLogit = sum;
        }
        let expSum = 0;
        const probs = new Array(C);
        for (let c = 0; c < C; c++) {
          probs[c] = Math.exp(logits[c] - maxLogit);
          expSum += probs[c];
        }
        for (let c = 0; c < C; c++) probs[c] /= expSum;

        const dLogits = probs.map((p, c) => p - (c === y ? 1 : 0));
        const dH = new Array(H).fill(0);
        for (let c = 0; c < C; c++) {
          gB2[c] += dLogits[c];
          for (let i = 0; i < H; i++) {
            gW2[c][i] += dLogits[c] * h[i];
            dH[i] += dLogits[c] * w2[c][i];
          }
        }
        for (let i = 0; i < H; i++) {
          if (hPre[i] <= 0) continue;
          gB1[i] += dH[i];
          for (let j = 0; j < FEATURE_COUNT; j++) gW1[i][j] += dH[i] * x[j];
        }
      }

      const b1Corr = 1 - beta1 ** step;
      const b2Corr = 1 - beta2 ** step;
      const adamUpdate = (param: number, grad: number, m: number, v: number, decay = 0) => {
        const g = grad / bs + decay * param;
        const nm = beta1 * m + (1 - beta1) * g;
        const nv = beta2 * v + (1 - beta2) * g * g;
        const mHat = nm / b1Corr;
        const vHat = nv / b2Corr;
        return [param - (lr * mHat) / (Math.sqrt(vHat) + eps), nm, nv] as const;
      };

      for (let c = 0; c < C; c++) {
        [b2[c], mB2[c], vB2[c]] = adamUpdate(b2[c], gB2[c], mB2[c], vB2[c]);
        for (let i = 0; i < H; i++) {
          [w2[c][i], mW2[c][i], vW2[c][i]] = adamUpdate(w2[c][i], gW2[c][i], mW2[c][i], vW2[c][i], wd);
        }
      }
      for (let i = 0; i < H; i++) {
        [b1[i], mB1[i], vB1[i]] = adamUpdate(b1[i], gB1[i], mB1[i], vB1[i]);
        for (let j = 0; j < FEATURE_COUNT; j++) {
          [w1[i][j], mW1[i][j], vW1[i][j]] = adamUpdate(w1[i][j], gW1[i][j], mW1[i][j], vW1[i][j], wd);
        }
      }
    }
  }

  let correct = 0;
  const confusion = Array.from({ length: C }, () => new Array(C).fill(0));
  for (let n = 0; n < valX.length; n++) {
    const x = valX[n];
    const h = w1.map((row, i) => Math.max(0, b1[i] + row.reduce((acc, w, j) => acc + w * x[j], 0)));
    const logits = w2.map((row, c) => b2[c] + row.reduce((acc, w, i) => acc + w * h[i], 0));
    const pred = logits.indexOf(Math.max(...logits));
    if (pred === val[n].labelIdx) correct++;
    confusion[val[n].labelIdx][pred]++;
  }
  const valAccuracy = Math.round((correct / val.length) * 10000) / 10000;

  const roundArr = (arr: number[]) => arr.map((v) => Math.round(v * 1e5) / 1e5);
  const artifact = {
    version: 1,
    labels: [...GESTURE_LABELS],
    featureCount: FEATURE_COUNT,
    hiddenSize: H,
    trainSamples: train.length,
    valSamples: val.length,
    valAccuracy,
    confusion,
    mean: roundArr(mean),
    std: roundArr(std),
    w1: w1.map(roundArr),
    b1: roundArr(b1),
    w2: w2.map(roundArr),
    b2: roundArr(b2),
  };

  const outPath = fileURLToPath(new URL("../lib/gesture-model-weights.json", import.meta.url));
  writeFileSync(outPath, JSON.stringify(artifact, null, 2) + "\n");
  console.log(
    `Trained gesture MLP (${train.length} train / ${val.length} val) — valAccuracy=${(valAccuracy * 100).toFixed(2)}% -> ${outPath}`,
  );
}

main();
