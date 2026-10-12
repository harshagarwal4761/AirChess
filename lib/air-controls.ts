import type { Color } from "chess.js";
import type { Point } from "./gestures";
export function practiceOrientation(
  turn: Color,
  followTurn: boolean,
  flipped: boolean,
): Color {
  return followTurn ? turn : flipped ? "b" : "w";
}
export function reachablePoint(
  point: Point,
  view: { width: number; height: number },
): Point {
  // The central 76% of the camera controls the whole viewport, so top ranks stay reachable.
  const axis = (value: number, size: number) =>
    Math.max(2, Math.min(size - 2, ((value / size - 0.12) / 0.76) * size));
  return { x: axis(point.x, view.width), y: axis(point.y, view.height) };
}
