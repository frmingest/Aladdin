import {
  CLEAR_RING_R,
  FOG_OPACITY,
  MAP_COLORS as C,
  PATCH_LOOK,
  TOWER_BOX,
  VIEW,
  cloudPath,
} from "../../../lib/realmMap";
import type { FogSlot } from "../../../lib/realmMap";
import type { SurveyState } from "../../../lib/survey";

/** Fog patches (Cartographer's table, win 1). The three looks differ by shape, pattern and glyph, and
 * the slate prints the word as well, so colour is never the only carrier:
 *   fog        a scalloped cloud, diagonal hatch, an ink "?"      (hides the tower under it)
 *   clear      a small solid ring with a dot                      (the ground shows through)
 *   not judged a small dashed ring with a dash                    (an empty socket)
 * Static SVG: a <pattern> fill, no filter, no blur. Fog is always larger and at least as dark as clear. */

/** One hidden SVG that supplies the hatch pattern; every patch on the page refers to its id. */
export function FogDefs({ id }: { id: string }) {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
      <defs>
        <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill={C.mist} />
          <line x1="0" y1="0" x2="0" y2="6" stroke={C.hatchInk} strokeWidth="1.4" />
        </pattern>
      </defs>
    </svg>
  );
}

/** One patch, centred on (cx, cy). `r` is the cloud radius for fog; clear and not judged are sockets. */
export function Patch({ state, cx, cy, r, hatchId }: { state: SurveyState; cx: number; cy: number; r: number; hatchId: string }) {
  if (state === "fog") {
    return (
      <g data-patch="fog">
        <path d={cloudPath(cx, cy, r)} fill={`url(#${hatchId})`} fillOpacity={FOG_OPACITY} stroke={C.ink} strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx={cx} cy={cy} r={Math.round(r * 0.4 * 10) / 10} fill={C.paper} stroke={C.ink} strokeWidth="1" />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="14" fontWeight="700" fontFamily="Georgia, serif" fill={C.ink}>
          {PATCH_LOOK.fog.glyph}
        </text>
      </g>
    );
  }
  if (state === "clear") {
    return (
      <g data-patch="clear">
        <circle cx={cx} cy={cy} r={CLEAR_RING_R} fill={C.paper} stroke={C.ink} strokeWidth="1.6" />
        <circle cx={cx} cy={cy} r="2.6" fill={C.ink} />
      </g>
    );
  }
  return (
    <g data-patch="not-judged">
      <circle cx={cx} cy={cy} r={CLEAR_RING_R} fill={C.paper} stroke={C.ink} strokeWidth="1.6" strokeDasharray="2.5 2.5" />
      <line x1={cx - 3.2} y1={cy} x2={cx + 3.2} y2={cy} stroke={C.ink} strokeWidth="1.8" strokeLinecap="round" />
    </g>
  );
}

/** A single patch as its own small picture: the legend and the slate rows. */
export function PatchMark({ state, hatchId, size = 32 }: { state: SurveyState; hatchId: string; size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden focusable="false" className="shrink-0">
      <Patch state={state} cx={20} cy={20} r={state === "fog" ? 17 : CLEAR_RING_R} hatchId={hatchId} />
    </svg>
  );
}

/** The fixed tower silhouette. Identical for every holding and every survey state: surveying never
 * makes a tower prettier, and a tower is not drawn weak either. */
function Silhouette() {
  const { x, y, w, h } = TOWER_BOX;
  const r = x + w;
  const b = y + h;
  const d = `M${x} ${b} V${y + 8} H${x + 8} V${y} H${x + 18} V${y + 8} H${x + 26} V${y} H${x + 38} V${y + 8} H${x + 46} V${y} H${x + 56} V${y + 8} H${r} V${b} Z`;
  return (
    <g stroke={C.ink} strokeWidth="1.6" strokeLinejoin="round" fill={C.stone}>
      <path d={d} />
      <path d={`M${x + 24} ${b} V${b - 14} a8 8 0 0 1 16 0 V${b}`} fill={C.ink} fillOpacity="0.8" />
      <path d={`M${x - 14} ${b} H${r + 14}`} fill="none" />
    </g>
  );
}

/** A tower with its five patch slots. Sockets are drawn first so a cloud lies over a neighbour. */
export function TowerPicture({ slots, hatchId, className = "" }: { slots: FogSlot[]; hatchId: string; className?: string }) {
  const ordered = [...slots.filter((s) => s.state !== "fog"), ...slots.filter((s) => s.state === "fog")];
  return (
    <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} width={VIEW.w} height={VIEW.h} aria-hidden focusable="false" className={className}>
      <Silhouette />
      {ordered.map((s) => (
        <Patch key={s.id} state={s.state} cx={s.cx} cy={s.cy} r={s.r} hatchId={hatchId} />
      ))}
    </svg>
  );
}
