import { useRef, useState, type MouseEvent, type PointerEvent, type RefObject } from "react";
import { DRAG_START_PX, isMove, levelForBand, pointerToPct, zoneAt, type CircleBand } from "../../../lib/circleMap";
import type { CompetenceLevel } from "../../../lib/types";

/** Drag a sector onto a zone of the circle. The hook owns only the gesture: where the pointer is, which
 * zone is under it, and what happens on release. It never writes anything itself; a drop that changes the
 * level calls `onPlace`, a press that never moved calls `onTap`, and a release outside the map or on the
 * zone the sector is already in does nothing. Mouse, touch and pen all go through pointer events. */

export interface DragState {
  sector: string;
  /** Pointer position on screen, for the floating copy of the marker. */
  x: number;
  y: number;
  /** The zone under the pointer, null when it is clear of the map. */
  zone: CircleBand | null;
  size: number;
}

interface Press {
  id: number;
  x: number;
  y: number;
  sector: string;
  level: CompetenceLevel | null;
  size: number;
  moved: boolean;
}

export function useZoneDrag({
  mapRef,
  disabled,
  onPlace,
  onTap,
}: {
  mapRef: RefObject<HTMLElement | null>;
  disabled: boolean;
  onPlace: (sector: string, level: CompetenceLevel | "") => void;
  onTap: (sector: string) => void;
}) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const press = useRef<Press | null>(null);
  const swallowClick = useRef(false);

  const zoneUnder = (clientX: number, clientY: number): CircleBand | null => {
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const { dx, dy } = pointerToPct(clientX, clientY, rect);
    return zoneAt(dx, dy);
  };

  const end = () => {
    press.current = null;
    setDrag(null);
  };

  /** Props for the thing being dragged: a marker on the map or a chip in the tray. */
  const bind = (sector: string, level: CompetenceLevel | null, size: number) => ({
    onPointerDown(e: PointerEvent<HTMLElement>) {
      if (disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
      press.current = { id: e.pointerId, x: e.clientX, y: e.clientY, sector, level, size, moved: false };
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const p = press.current;
      if (!p || p.id !== e.pointerId) return;
      if (!p.moved) {
        if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_START_PX) return;
        p.moved = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* a pointer that is already gone: the drop is simply cancelled below */
        }
      }
      setDrag({ sector, x: e.clientX, y: e.clientY, zone: zoneUnder(e.clientX, e.clientY), size });
    },
    onPointerUp(e: PointerEvent<HTMLElement>) {
      const p = press.current;
      if (!p || p.id !== e.pointerId) return;
      if (p.moved) {
        swallowClick.current = true;
        window.setTimeout(() => {
          swallowClick.current = false;
        }, 0);
        const zone = zoneUnder(e.clientX, e.clientY);
        if (zone && isMove(p.level, zone)) onPlace(p.sector, levelForBand(zone));
      }
      end();
    },
    onPointerCancel() {
      end();
    },
    onClick(e: MouseEvent<HTMLElement>) {
      if (swallowClick.current) {
        swallowClick.current = false;
        e.preventDefault();
        return;
      }
      onTap(sector);
    },
    onKeyDown(e: { key: string }) {
      if (e.key === "Escape") end();
    },
  });

  return { drag, bind };
}
