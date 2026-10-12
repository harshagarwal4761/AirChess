export type Offset = { x: number; y: number };
export type PanelRect = { left: number; top: number; width: number; height: number };
export const LAYOUT_PREFIX = "airchess.layout.v1.";
export function readOffset(value: string | null): Offset {
  try {
    const point = JSON.parse(value ?? "null");
    if (Number.isFinite(point?.x) && Number.isFinite(point?.y)) return { x: point.x, y: point.y };
  } catch { /* Preferences are optional. */ }
  return { x: 0, y: 0 };
}
// Keep the whole panel on-screen where possible, and its handle reachable otherwise.
export function clampPanel(offset: Offset, base: PanelRect, viewport: { width: number; height: number }): Offset {
  const maxLeft = Math.max(8, viewport.width - base.width - 8);
  const maxTop = Math.max(8, viewport.height - base.height - 8);
  return {
    x: Math.max(8, Math.min(maxLeft, base.left + offset.x)) - base.left,
    y: Math.max(8, Math.min(maxTop, base.top + offset.y)) - base.top,
  };
}
export function resetPanelLayout() {
  try {
    Object.keys(localStorage).filter(key => key.startsWith(LAYOUT_PREFIX)).forEach(key => localStorage.removeItem(key));
  } catch { /* Storage may be disabled. */ }
  window.dispatchEvent(new Event("airchess-layout-reset"));
}
