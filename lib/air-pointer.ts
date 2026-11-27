import type { Point } from "./gestures";
import type { Target } from "./double-pinch";

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
 * Adaptive One-Euro Filter: holds rock-steady when aiming still on a square
 * while ramping cutoff up automatically during fast hand movements.
 */
export function followPointer(previous: PointerState, raw: Point, now: number): PointerState {
  if (!previous || now - previous.time > 350) {
    return { point: raw, time: now, dx: 0, dy: 0 };
  }
  const dtMs = Math.max(4, now - previous.time);
  const dtSec = dtMs / 1000;

  const rawDx = (raw.x - previous.point.x) / dtSec;
  const rawDy = (raw.y - previous.point.y) / dtSec;
  const dAlpha = smoothingAlpha(dtSec, 1.0);
  const dx = (previous.dx ?? 0) + (rawDx - (previous.dx ?? 0)) * dAlpha;
  const dy = (previous.dy ?? 0) + (rawDy - (previous.dy ?? 0)) * dAlpha;

  const speed = Math.hypot(dx, dy);
  const cutoff = 1.15 + 0.015 * speed;
  const alpha = smoothingAlpha(dtSec, cutoff);

  return {
    point: {
      x: previous.point.x + (raw.x - previous.point.x) * alpha,
      y: previous.point.y + (raw.y - previous.point.y) * alpha,
    },
    time: now,
    dx,
    dy,
  };
}

export type HoverState = { target: Target | null; since: number; blocked: string | null };
export const newHover = (blocked: string | null = null): HoverState => ({ target: null, since: 0, blocked });
export const HOVER_MS = 1100;

export function hoverSelect(state: HoverState, target: Target | null, now: number) {
  let next = { ...state };
  // An activated square stays latched until the pointer leaves it.
  if (next.blocked && target?.square === next.blocked) return { state: next, progress: 0, confirmed: null };
  if (target?.square !== next.blocked) next.blocked = null;
  if (!target) return { state: newHover(next.blocked), progress: 0, confirmed: null };
  if (target.square !== next.target?.square) next = { target, since: now, blocked: next.blocked };
  const progress = Math.min(1, (now - next.since) / HOVER_MS);
  if (progress >= 1) return { state: newHover(target.square), progress: 1, confirmed: target.square };
  return { state: next, progress, confirmed: null };
}
