"use client";
import { useCallback, useEffect, useRef, type HTMLAttributes, type PointerEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, GripHorizontal } from "lucide-react";
import { clampPanel, LAYOUT_PREFIX, readOffset, type Offset } from "../lib/panel-layout";

type Props = HTMLAttributes<HTMLElement> & { panelId: string; title: string; enabled: boolean; as?: "div" | "section" };
const changed = () => window.dispatchEvent(new Event("airchess-layout-change"));
export function MovableSurface({ panelId, title, enabled, as: Tag = "section", className = "", children, ...props }: Props) {
  const element = useRef<HTMLElement | null>(null);
  const offset = useRef<Offset>({ x: 0, y: 0 });
  const drag = useRef<{ pointerId: number; x: number; y: number; origin: Offset } | null>(null);
  const persist = () => {
    try { localStorage.setItem(LAYOUT_PREFIX + panelId, JSON.stringify(offset.current)); } catch { /* Optional preference. */ }
  };
  const apply = useCallback((next: Offset, constrain = true) => {
    const node = element.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const isDialog = panelId.startsWith("dialog-");
    const scrollY = isDialog ? 0 : window.scrollY;
    const scrollX = isDialog ? 0 : window.scrollX;
    const base = {
      left: rect.left + scrollX - offset.current.x,
      top: rect.top + scrollY - offset.current.y,
      width: rect.width,
      height: rect.height,
    };
    const headerBottom = isDialog ? 0 : Math.max(0, (document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 0) + scrollY);
    const previous = offset.current;
    offset.current = constrain
      ? clampPanel(
          next,
          { ...base, top: base.top - headerBottom },
          {
            width: scrollX + document.documentElement.clientWidth,
            height: scrollY + innerHeight - headerBottom,
          },
        )
      : next;
    node.style.transform = `translate3d(${offset.current.x}px, ${offset.current.y}px, 0)`;
    if (Math.abs(previous.x - offset.current.x) > 0.1 || Math.abs(previous.y - offset.current.y) > 0.1) changed();
  }, [panelId]);
  const raise = () => {
    document.querySelectorAll<HTMLElement>("[data-movable]").forEach(node => { node.style.zIndex = "10"; });
    if (element.current) element.current.style.zIndex = "30";
  };
  useEffect(() => {
    let saved = { x: 0, y: 0 };
    try { saved = readOffset(localStorage.getItem(LAYOUT_PREFIX + panelId)); } catch { /* Optional preference. */ }
    // Let the parent restore its saved focus view before measuring the layout.
    const restoreFrame = requestAnimationFrame(() => apply(saved, Boolean(saved.x || saved.y)));
    const reset = () => { apply({ x: 0, y: 0 }, false); };
    const reflow = () => {
      if ((offset.current.x || offset.current.y) && (panelId.startsWith("dialog-") || window.scrollY === 0)) {
        apply(offset.current);
      }
    };
    const resized = () => { reflow(); changed(); };
    const observer = new ResizeObserver(reflow);
    if (element.current) observer.observe(element.current);
    window.addEventListener("resize", resized);
    window.addEventListener("airchess-layout-reset", reset);
    return () => {
      cancelAnimationFrame(restoreFrame);
      observer.disconnect();
      window.removeEventListener("resize", resized);
      window.removeEventListener("airchess-layout-reset", reset);
      if (drag.current) delete document.documentElement.dataset.layoutDragging;
    };
  }, [panelId, apply]);
  const start = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, origin: { ...offset.current } };
    document.documentElement.dataset.layoutDragging = "true";
    element.current!.dataset.dragging = "true";
    raise(); changed();
  };
  const finish = () => {
    if (!drag.current) return;
    drag.current = null;
    delete document.documentElement.dataset.layoutDragging;
    if (element.current) delete element.current.dataset.dragging;
    persist(); changed();
  };
  const nudge = (x: number, y: number) => {
    raise(); apply({ x: offset.current.x + x, y: offset.current.y + y }); persist();
  };
  return <Tag {...props} ref={node => { element.current = node; }} className={`${className} movable-surface`} data-movable={panelId}>
    {enabled && <div className="panel-mover" role="group" aria-label={`Position ${title}`}>
      <button className="drag-handle" aria-label={`Move ${title}`} title="Drag to move. Arrow keys move in small steps."
        onPointerDown={start}
        onPointerMove={event => { const d = drag.current; if (d?.pointerId === event.pointerId) apply({ x: d.origin.x + event.clientX - d.x, y: d.origin.y + event.clientY - d.y }); }}
        onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
        onKeyDown={event => { const delta: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }; if (delta[event.key]) { event.preventDefault(); const [x,y] = delta[event.key]; nudge(x * (event.shiftKey ? 32 : 8), y * (event.shiftKey ? 32 : 8)); } }}>
        <GripHorizontal size={14}/><span>{title}</span>
      </button>
      {([[-24, 0, "left", ArrowLeft], [24, 0, "right", ArrowRight], [0, -24, "up", ArrowUp], [0, 24, "down", ArrowDown]] as const).map(([x,y,direction,Icon]) => <button type="button" data-air key={direction} aria-label={`Move ${title} ${direction}`} onClick={() => nudge(x,y)}><Icon size={12}/></button>)}
    </div>}
    {children}
  </Tag>;
}
