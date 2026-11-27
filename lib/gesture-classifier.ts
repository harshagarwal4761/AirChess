import modelWeights from "./gesture-model-weights.json";
import { extractGestureFeatures, GESTURE_LABELS, type GestureLabel } from "./gesture-features";
import type { Point } from "./gestures";

export type GesturePrediction = {
  label: GestureLabel;
  confidence: number;
  probabilities: Record<GestureLabel, number>;
};

export type RecordedGestureSample = {
  label: GestureLabel;
  aspect: number;
  points: Point[];
  capturedAt: number;
};

type ModelArtifact = {
  labels: GestureLabel[];
  mean: number[];
  std: number[];
  w1: number[][];
  b1: number[];
  w2: number[][];
  b2: number[];
};

const model = modelWeights as ModelArtifact;

/** Run pure-TypeScript MLP inference (<0.05ms) on 21 normalized hand landmarks. */
export function classifyGesture(points: Point[], aspect = 1): GesturePrediction {
  const raw = extractGestureFeatures(points, aspect);
  const x = raw.map((v, i) => (v - model.mean[i]) / model.std[i]);

  const hidden = model.w1.map((row, i) => {
    let sum = model.b1[i];
    for (let j = 0; j < x.length; j++) sum += row[j] * x[j];
    return sum > 0 ? sum : 0;
  });

  const logits = model.w2.map((row, c) => {
    let sum = model.b2[c];
    for (let i = 0; i < hidden.length; i++) sum += row[i] * hidden[i];
    return sum;
  });

  const maxLogit = Math.max(...logits);
  const exps = logits.map((v) => Math.exp(v - maxLogit));
  const total = exps.reduce((a, b) => a + b, 0) || 1;
  const probs = exps.map((v) => v / total);

  let bestIdx = 0;
  for (let i = 1; i < probs.length; i++) {
    if (probs[i] > probs[bestIdx]) bestIdx = i;
  }

  const probabilities = {
    open: probs[0] ?? 0,
    pinch: probs[1] ?? 0,
    fist: probs[2] ?? 0,
    peace: probs[3] ?? 0,
  };

  return {
    label: GESTURE_LABELS[bestIdx] ?? "open",
    confidence: probs[bestIdx] ?? 0,
    probabilities,
  };
}

/** Exponential moving average over class probabilities to eliminate single-frame class flicker. */
export class GestureSmoother {
  private probs: Record<GestureLabel, number> = { open: 1, pinch: 0, fist: 0, peace: 0 };
  private initialized = false;

  reset() {
    this.probs = { open: 1, pinch: 0, fist: 0, peace: 0 };
    this.initialized = false;
  }

  update(prediction: GesturePrediction, alpha = 0.45): GesturePrediction {
    if (!this.initialized) {
      this.probs = { ...prediction.probabilities };
      this.initialized = true;
    } else {
      for (const label of GESTURE_LABELS) {
        this.probs[label] =
          this.probs[label] * (1 - alpha) + prediction.probabilities[label] * alpha;
      }
    }
    let best: GestureLabel = "open";
    for (const label of GESTURE_LABELS) {
      if (this.probs[label] > this.probs[best]) best = label;
    }
    return {
      label: best,
      confidence: this.probs[best],
      probabilities: { ...this.probs },
    };
  }
}
