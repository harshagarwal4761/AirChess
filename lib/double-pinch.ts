import type { Point } from "./gestures";
export type Target = { square: string; x: number; y: number; size: number };
export type DoublePinch = {
  hover: Target | null;
  hoverSince: number;
  hoverPalm: Point | null;
  locked: Target | null;
  anchor: Point | null;
  started: number;
  closedAt: number;
  count: number;
  closing: boolean;
  cooldown: number;
};
export const newDoublePinch = (): DoublePinch => ({
  hover: null,
  hoverSince: 0,
  hoverPalm: null,
  locked: null,
  anchor: null,
  started: 0,
  closedAt: 0,
  count: 0,
  closing: false,
  cooldown: 0,
});
export type Sample = {
  now: number;
  target: Target | null;
  palm: Point;
  edge: "grab" | "release" | "cancel" | null;
  visible: boolean;
  open: boolean;
};
export function stepDoublePinch(
  current: DoublePinch,
  sample: Sample,
): { state: DoublePinch; confirmed: string | null; cancelled: boolean } {
  const { now, target, palm, edge, visible, open } = sample;
  let s = { ...current };
  const cancel = () => ({
    state: { ...newDoublePinch(), cooldown: now + 250 },
    confirmed: null,
    cancelled: Boolean(s.locked),
  });
  if (!visible || edge === "cancel") return cancel();
  if (now < s.cooldown) return { state: s, confirmed: null, cancelled: false };
  if (s.locked) {
    if (
      now - s.started > 3500 ||
      Math.hypot(palm.x - s.anchor!.x, palm.y - s.anchor!.y) >
        Math.max(24, s.locked.size * 0.65) ||
      (s.closing && now - s.closedAt > 1500)
    )
      return cancel();
    if (edge === "grab") {
      if (s.closing) return cancel();
      s.closing = true;
      s.closedAt = now;
    }
    if (edge === "release") {
      if (!s.closing) return cancel();
      s.closing = false;
      s.count++;
      if (s.count === 2)
        return {
          state: { ...newDoublePinch(), cooldown: now + 450 },
          confirmed: s.locked.square,
          cancelled: false,
        };
    }
    return { state: s, confirmed: null, cancelled: false };
  }
  // Acquire a target only with fingers open; curl cannot choose a different square.
  if (open) {
    s.hoverPalm = palm;
    if (target?.square !== s.hover?.square)
      s = { ...s, hover: target, hoverSince: now };
    else if (target) s.hover = target;
  }
  if (edge === "grab") {
    if (
      !s.hover ||
      !s.hoverPalm ||
      now - s.hoverSince < 160 ||
      Math.hypot(palm.x - s.hoverPalm.x, palm.y - s.hoverPalm.y) >
        Math.max(24, s.hover.size * 0.65)
    )
      return cancel();
    s = {
      ...s,
      locked: s.hover,
      anchor: s.hoverPalm,
      started: now,
      closedAt: now,
      count: 0,
      closing: true,
    };
  }
  return { state: s, confirmed: null, cancelled: false };
}
export function centerTarget(
  square: string,
  rect: { left: number; top: number; width: number; height: number },
  point: Point,
): Target | null {
  const margin = 0.06;
  if (
    point.x < rect.left + rect.width * margin ||
    point.x > rect.left + rect.width * (1 - margin) ||
    point.y < rect.top + rect.height * margin ||
    point.y > rect.top + rect.height * (1 - margin)
  )
    return null;
  return {
    square,
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    size: Math.min(rect.width, rect.height),
  };
}
// Pinch-independent palm reference for drift cancellation.
export function palmPoint(points: Point[]): Point {
  return {
    x: (points[0].x + points[5].x + points[17].x) / 3,
    y: (points[0].y + points[5].y + points[17].y) / 3,
  };
}
export function openPalm(points: Point[]): boolean {
  const d = (a: number, b: number) =>
    Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y);
  return [
    [8, 6],
    [12, 10],
    [16, 14],
    [20, 18],
  ].every(([tip, pip]) => d(tip, 0) > d(pip, 0) * 1.15);
}
// Ambiguous labels never grant either hand control.
export function controllerIndex(
  labels: string[],
  controller: string | null,
): number {
  if (!controller) return -1;
  const matches = labels
    .map((label, i) => (label === controller ? i : -1))
    .filter((i) => i >= 0);
  return matches.length === 1 ? matches[0] : -1;
}
