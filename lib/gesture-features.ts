import type { Point } from "./gestures";

export const GESTURE_LABELS = ["open", "pinch", "fist", "peace"] as const;
export type GestureLabel = (typeof GESTURE_LABELS)[number];
export const FEATURE_COUNT = 26;

function dist2d(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

/**
 * Extract 26 translation-, scale-, aspect-, and rotation-invariant features
 * from MediaPipe's 21 hand landmarks.
 */
export function extractGestureFeatures(points: Point[], aspect = 1): number[] {
  if (points.length < 21) return new Array(FEATURE_COUNT).fill(0);
  const c = points.map((p) => ({ x: p.x * aspect, y: p.y }));
  const wrist = c[0];
  const indexMcp = c[5];
  const middleMcp = c[9];
  const pinkyMcp = c[17];

  const palmWidth = Math.max(dist2d(indexMcp.x, indexMcp.y, pinkyMcp.x, pinkyMcp.y), 0.03);
  const palmHeight = Math.max(dist2d(wrist.x, wrist.y, middleMcp.x, middleMcp.y), 0.03);
  const palmScale = (palmWidth + palmHeight) * 0.5;

  // Palm orthonormal basis: v points wrist -> middle MCP; u is perpendicular in image plane.
  const vx = (middleMcp.x - wrist.x) / palmHeight;
  const vy = (middleMcp.y - wrist.y) / palmHeight;
  let ux = -vy;
  let uy = vx;
  // Flip u if needed so index MCP -> pinky MCP always has positive u projection (left/right hand invariance).
  const ipx = pinkyMcp.x - indexMcp.x;
  const ipy = pinkyMcp.y - indexMcp.y;
  if (ipx * ux + ipy * uy < 0) {
    ux = -ux;
    uy = -uy;
  }

  const features: number[] = [];
  const keyIndices = [4, 8, 12, 16, 20, 3, 6, 10, 14, 18];
  for (const idx of keyIndices) {
    const dx = (c[idx].x - wrist.x) / palmScale;
    const dy = (c[idx].y - wrist.y) / palmScale;
    features.push(dx * ux + dy * uy, dx * vx + dy * vy);
  }

  const thumbIndex = dist2d(c[4].x, c[4].y, c[8].x, c[8].y) / palmWidth;
  const thumbMiddle = dist2d(c[4].x, c[4].y, c[12].x, c[12].y) / palmWidth;
  const extRatio = (tip: number, pip: number) =>
    dist2d(c[tip].x, c[tip].y, wrist.x, wrist.y) /
    Math.max(dist2d(c[pip].x, c[pip].y, wrist.x, wrist.y), 0.02);

  features.push(
    thumbIndex,
    thumbMiddle,
    extRatio(8, 6),
    extRatio(12, 10),
    extRatio(16, 14),
    extRatio(20, 18),
  );

  return features;
}
