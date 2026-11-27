import type { Point } from "./gestures";
import { controllerIndex, type Target } from "./double-pinch";

export type AimMode = "hover" | "double-pinch";
export type CameraRect = { left: number; top: number; width: number; height: number };

// Use the video's rendered rectangle, not innerWidth (which includes scrollbars).
export function cameraPoint(point: Point, video: { width: number; height: number }, rect: CameraRect): Point {
  const scale = Math.max(rect.width / video.width, rect.height / video.height);
  return {
    x: rect.left + (1 - point.x) * video.width * scale - (video.width * scale - rect.width) / 2,
    y: rect.top + point.y * video.height * scale - (video.height * scale - rect.height) / 2,
  };
}

export type PointerState = {
  point: Point;
  time: number;
  dx?: number;
  dy?: number;
} | null;

function smoothingAlpha(dtSec: number, cutoffHz: number) {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / dtSec);
}

/**
 * Adaptive One-Euro Filter with sub-pixel tremor damping:
 * holds rock-steady when aiming on a square while snapping promptly across fast swipes.
 */
export function followPointer(previous: PointerState, raw: Point, now: number): PointerState {
  if (!previous || now - previous.time > 450) {
    return { point: raw, time: now, dx: 0, dy: 0 };
  }
  const dtMs = Math.max(4, now - previous.time);
  const dtSec = dtMs / 1000;

  const deltaX = raw.x - previous.point.x;
  const deltaY = raw.y - previous.point.y;
  const stepDist = Math.hypot(deltaX, deltaY);

  const rawDx = deltaX / dtSec;
  const rawDy = deltaY / dtSec;
  const dAlpha = smoothingAlpha(dtSec, 1.2);
  const dx = (previous.dx ?? 0) + (rawDx - (previous.dx ?? 0)) * dAlpha;
  const dy = (previous.dy ?? 0) + (rawDy - (previous.dy ?? 0)) * dAlpha;

  const speed = Math.hypot(dx, dy);
  const cutoff = 1.0 + 0.016 * speed;
  let alpha = smoothingAlpha(dtSec, cutoff);
  // Attenuate micro-tremors (< 2.2 px) when practically stationary to steady the hover cursor.
  if (stepDist < 2.2 && speed < 35) {
    alpha = Math.min(alpha, 0.22);
  }

  return {
    point: {
      x: previous.point.x + deltaX * alpha,
      y: previous.point.y + deltaY * alpha,
    },
    time: now,
    dx,
    dy,
  };
}

export type HoverState = { target: Target | null; since: number; blocked: string | null };
export const newHover = (blocked: string | null = null): HoverState => ({ target: null, since: 0, blocked });
export const HOVER_MS = 1100;

export function hoverSelect(state: HoverState, target: Target | null, now: number, dwellMs = HOVER_MS) {
  let next = { ...state };
  // An activated square stays latched until the pointer leaves it.
  if (next.blocked && target?.square === next.blocked) return { state: next, progress: 0, confirmed: null };
  if (target?.square !== next.blocked) next.blocked = null;
  if (!target) return { state: newHover(next.blocked), progress: 0, confirmed: null };
  if (target.square !== next.target?.square) next = { target, since: now, blocked: next.blocked };
  const progress = Math.min(1, (now - next.since) / Math.max(250, dwellMs));
  if (progress >= 1) return { state: newHover(target.square), progress: 1, confirmed: target.square };
  return { state: next, progress, confirmed: null };
}

/**
 * Resolves the primary controller hand index while resisting brief Left/Right
 * handedness flickers when running in single-hand mode.
 */
export function resolveControllerHand(
  labels: string[],
  controller: string | null,
  twoHandPause: boolean,
  palm: Point | null,
  lastPalm: Point | null,
  maxJumpPx: number,
): number {
  const exact = controllerIndex(labels, controller);
  if (exact >= 0) return exact;
  if (!twoHandPause && controller && labels.length === 1) {
    if (!lastPalm || !palm || Math.hypot(palm.x - lastPalm.x, palm.y - lastPalm.y) <= maxJumpPx) {
      return 0;
    }
  }
  return -1;
}

/**
 * Scales palm jump tolerance by elapsed frame interval so fast swipes at
 * 12-15 FPS never falsely trigger a tracking-loss reset.
 */
export function exceededPalmJump(
  palm: Point,
  lastPalm: Point | null,
  dtMs: number,
  minViewportDim: number,
  multiHand: boolean,
): boolean {
  if (!lastPalm) return false;
  const dtSec = Math.max(0.016, Math.min(0.5, dtMs / 1000));
  const baseRatio = multiHand ? 0.22 : 0.28;
  const velocityRatio = multiHand ? 1.8 : 2.6;
  const threshold = minViewportDim * baseRatio + minViewportDim * velocityRatio * dtSec;
  return Math.hypot(palm.x - lastPalm.x, palm.y - lastPalm.y) > threshold;
}
