import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import {
  LABEL_FLOOR_PX,
  MAX_ZOOM,
  SCENE_MIN_PX,
  clampZoom,
  labelFloorZoom,
  labelPx,
  scrollAfterZoom,
  scrollToReveal,
  stepZoom,
  zoomPercent,
} from "../../lib/sceneCamera";

/**
 * Zoom, pan and fit for the painted Fortress scene (D2). The scene keeps its own geometry; this
 * only changes how wide it is drawn inside the frame. The scroll bars (and a mouse drag, and
 * Ctrl + wheel) pan it. A phone still scrolls sideways at the fitted size. The bar says in words
 * how large the smallest label is, and one button zooms until it reaches the floor.
 */

const BTN =
  "rounded border border-[#6b5126] bg-[#2a1d12] px-2 py-0.5 text-xs font-semibold text-[#e8d6ae] hover:bg-[#3a2a19] disabled:cursor-not-allowed disabled:opacity-40";

// useLayoutEffect warns when rendered on the server (the tests do); the effect only matters in the browser.
const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export default function SceneCamera({ children, selectedId }: { children: ReactNode; selectedId: string | null }) {
  const viewRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [containerPx, setContainerPx] = useState(SCENE_MIN_PX);
  const pending = useRef<{ left: number; top: number } | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);

  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const measure = () => setContainerPx(el.clientWidth || SCENE_MIN_PX);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const zoomTo = useCallback(
    (next: number, anchorX?: number, anchorY?: number) => {
      const el = viewRef.current;
      const target = clampZoom(next);
      if (el) {
        const ax = anchorX ?? el.clientWidth / 2;
        const ay = anchorY ?? el.clientHeight / 2;
        pending.current = {
          left: scrollAfterZoom(el.scrollLeft, ax, zoom, target),
          top: scrollAfterZoom(el.scrollTop, ay, zoom, target),
        };
      }
      setZoom(target);
    },
    [zoom],
  );

  // Apply the scroll that keeps the anchor fixed only after the wider scene has been laid out.
  useBrowserLayoutEffect(() => {
    const el = viewRef.current;
    if (el && pending.current) {
      el.scrollLeft = pending.current.left;
      el.scrollTop = pending.current.top;
    }
    pending.current = null;
  }, [zoom]);

  // Ctrl/Cmd + wheel zooms at the pointer; a plain wheel still scrolls the page.
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomTo(stepZoom(zoom, e.deltaY < 0 ? 1 : -1), e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoom, zoomTo]);

  // Bring a newly selected tower into view when the picture is zoomed past the frame.
  useEffect(() => {
    const el = viewRef.current;
    if (!el || !selectedId || zoom <= 1) return;
    const node = el.querySelector<SVGGElement>(`[data-tower-id="${CSS.escape(selectedId)}"]`);
    if (!node) return;
    const box = node.getBoundingClientRect();
    const view = el.getBoundingClientRect();
    const left = scrollToReveal(box.left - view.left, box.width, el.clientWidth, el.scrollLeft);
    const top = scrollToReveal(box.top - view.top, box.height, el.clientHeight, el.scrollTop);
    if (left !== null) el.scrollLeft = left;
    if (top !== null) el.scrollTop = top;
  }, [selectedId, zoom]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "+" || e.key === "=") zoomTo(stepZoom(zoom, 1));
    else if (e.key === "-" || e.key === "_") zoomTo(stepZoom(zoom, -1));
    else if (e.key === "0") zoomTo(1);
    else return;
    e.preventDefault();
  };

  // Mouse drag pans a zoomed picture. Touch keeps its native scrolling; a drag never selects a tower.
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const el = viewRef.current;
    if (!el || zoom <= 1 || e.pointerType !== "mouse" || e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = viewRef.current;
    const d = drag.current;
    if (!el || !d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    d.moved = true;
    el.scrollLeft = d.left - dx;
    el.scrollTop = d.top - dy;
  };
  const endDrag = () => {
    if (drag.current?.moved) {
      justDragged.current = true;
      window.setTimeout(() => {
        justDragged.current = false;
      }, 0);
    }
    drag.current = null;
  };

  const px = labelPx(containerPx, zoom);
  const floorZoom = labelFloorZoom(containerPx);
  const atFloor = px >= LABEL_FLOOR_PX - 0.05;
  const widthPx = SCENE_MIN_PX * zoom;

  return (
    // The key handler belongs to the whole camera so +, - and 0 work from any focused tower or control.
    <div onKeyDown={onKeyDown}>
      <div
        className="flex flex-wrap items-center justify-between gap-2 bg-[#1a120b] px-2 py-1 text-[#e8d6ae] print:hidden"
        role="group"
        aria-label="Scene camera"
      >
        <div className="flex items-center gap-1">
          <button type="button" className={BTN} onClick={() => zoomTo(stepZoom(zoom, -1))} disabled={zoom <= 1} aria-label="Zoom out" title="Zoom out (-)">
            −
          </button>
          <button type="button" className={BTN} onClick={() => zoomTo(stepZoom(zoom, 1))} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in" title="Zoom in (+)">
            +
          </button>
          <button type="button" className={BTN} onClick={() => zoomTo(1)} disabled={zoom === 1} title="Fit the whole scene (0)">
            Fit
          </button>
          <button
            type="button"
            className={BTN}
            onClick={() => zoomTo(floorZoom)}
            disabled={Math.abs(zoom - floorZoom) < 0.01}
            title={`Zoom until the smallest label is ${LABEL_FLOOR_PX} px`}
          >
            Read labels
          </button>
        </div>
        <p className="text-xs" aria-live="polite">
          <span className="tabular">{zoomPercent(zoom)}%</span> · smallest label{" "}
          <span className="tabular">{px.toFixed(0)} px</span>
          {atFloor ? "" : ` (under ${LABEL_FLOOR_PX}: press Read labels)`}
          <span className="hidden text-[#b9a77c] sm:inline"> · drag to pan · Ctrl + wheel to zoom</span>
        </p>
      </div>
      <div
        ref={viewRef}
        className="game-frame-inner"
        style={zoom > 1 ? { overflowY: "auto", maxHeight: "78vh", cursor: "grab" } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={(e) => {
          if (justDragged.current) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
      >
        <div style={{ width: `${zoom * 100}%`, minWidth: widthPx }}>{children}</div>
      </div>
    </div>
  );
}
