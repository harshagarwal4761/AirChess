export type Point = { x: number; y: number; z?: number };
export type GestureState = {
  pinched: boolean;
  candidate: boolean;
  since: number;
  armed: boolean;
};
export const initialGesture = (): GestureState => ({
  pinched: false,
  candidate: false,
  since: 0,
  armed: false,
});
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export function pinchRatio(points: Point[]) {
  return (
    distance(points[4], points[8]) /
    Math.max(distance(points[5], points[17]), 0.03)
  );
}
// Hysteresis + 90ms stability suppresses noise. A newly acquired hand must open first.
export function advanceGesture(
  state: GestureState,
  ratio: number | null,
  now: number,
): { state: GestureState; event: "grab" | "release" | "cancel" | null } {
  if (ratio === null)
    return { state: initialGesture(), event: state.pinched ? "cancel" : null };
  if (!state.armed)
    return { state: { ...state, armed: ratio > 0.65 }, event: null };
  const wantsPinch = state.pinched ? ratio < 0.65 : ratio < 0.38;
  if (wantsPinch === state.pinched)
    return {
      state: { ...state, candidate: wantsPinch, since: now },
      event: null,
    };
  if (state.candidate !== wantsPinch)
    return {
      state: { ...state, candidate: wantsPinch, since: now },
      event: null,
    };
  if (now - state.since < 90) return { state, event: null };
  return {
    state: { ...state, pinched: wantsPinch, since: now },
    event: wantsPinch ? "grab" : "release",
  };
}
// Match the mirrored, object-fit:cover camera background exactly, including cropping.
export function projectPoint(
  point: Point,
  video: { width: number; height: number },
  view: { width: number; height: number },
): Point {
  const scale = Math.max(view.width / video.width, view.height / video.height);
  return {
    x:
      (1 - point.x) * video.width * scale -
      (video.width * scale - view.width) / 2,
    y:
      point.y * video.height * scale - (video.height * scale - view.height) / 2,
  };
}
