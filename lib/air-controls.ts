import type { Chess, Color, Square } from "chess.js";
import type { Point } from "./gestures";
export type HandId = 0 | 1;
export type Observation = { wrist: Point; label: string };
// Model output order is not an identity. Match to previous wrists with a handedness preference.
export function matchHands(
  previous: (Observation | null)[],
  detected: Observation[],
): (number | null)[] {
  if (!detected.length) return [null, null];
  const cost = (slot: number, index: number) => {
    const prev = previous[slot],
      next = detected[index];
    if (!prev) return 0.8;
    return (
      Math.hypot(prev.wrist.x - next.wrist.x, prev.wrist.y - next.wrist.y) +
      (prev.label !== next.label ? 0.3 : 0)
    );
  };
  const direct = detected.length === 1 ? cost(0, 0) : cost(0, 0) + cost(1, 1);
  const swapped = detected.length === 1 ? cost(1, 0) : cost(0, 1) + cost(1, 0);
  // If crossing/occlusion makes identity ambiguous, cancel rather than transfer a pickup.
  if (previous[0] && previous[1] && Math.abs(direct - swapped) < 0.08)
    return [null, null];
  if (detected.length === 1) return direct <= swapped ? [0, null] : [null, 0];
  return direct <= swapped ? [0, 1] : [1, 0];
}
export type Pickup = { handId: HandId; square: Square } | null;
export function airBoardAction(
  pickup: Pickup,
  event: { type: "grab" | "release" | "cancel"; handId: HandId },
  square: Square | undefined,
  chess: Chess,
  allowed: boolean,
): { pickup: Pickup; move?: { from: Square; to: Square } } {
  if (event.type === "cancel")
    return { pickup: pickup?.handId === event.handId ? null : pickup };
  if (!allowed) return { pickup: null };
  if (event.type === "grab") {
    if (!pickup && square && chess.get(square)?.color === chess.turn())
      return { pickup: { handId: event.handId, square } };
    return { pickup };
  }
  if (pickup?.handId !== event.handId) return { pickup };
  return {
    pickup: null,
    ...(square && square !== pickup.square
      ? { move: { from: pickup.square, to: square } }
      : {}),
  };
}
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
