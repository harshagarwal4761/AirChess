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
export type PointerState = { point: Point; time: number } | null;
// Follow fast motion promptly, soften small tremors; never gate motion on a pinch.
export function followPointer(previous: PointerState, raw: Point, now: number): PointerState {
  if (!previous || now - previous.time > 350) return { point: raw, time: now };
  const dt = Math.max(1, now - previous.time);
  const distance = Math.hypot(raw.x - previous.point.x, raw.y - previous.point.y);
  const tau = distance > 24 ? 28 : 65;
  const alpha = 1 - Math.exp(-dt / tau);
  return { point: { x: previous.point.x + (raw.x - previous.point.x) * alpha, y: previous.point.y + (raw.y - previous.point.y) * alpha }, time: now };
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
