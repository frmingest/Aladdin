import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { TOWER_BOX, fogSlots, towerAriaLabel } from "../../../lib/realmMap";
import type { MapFlag } from "../../../lib/realmMap";
import { weightText } from "../../../lib/rituals";
import type { TowerFog } from "../../../lib/survey";
import {
  CAPITAL,
  WORLD,
  buildWorld,
  chooseLabels,
  clampView,
  ensureVisible,
  initialView,
  isDirKey,
  nearestInDirection,
  panBy,
  placeRealm,
  toScreen,
  viewBox,
  zoomAt,
  type Glyph,
  type PlaceInput,
  type Pt,
  type View,
} from "../../../lib/worldMap";
import { useSceneRunning } from "../useScenePause";
import { FlagMark } from "./CommissionSeal";
import { TowerFigure } from "./FogPatch";
import "./worldMap.css";

/** The Cartographer's world map (game mode). A generated fantasy continent: provinces are sectors,
 * settlements are holdings, the five fog patches on each settlement are the survey. The land is scenery;
 * it never encodes a state. The map pans (drag, touch), zooms (buttons, ctrl + wheel, pinch) and keeps
 * one tab stop: arrow keys step to the nearest tower. Seas drift and ships sail only when motion is
 * allowed and the map is on screen. Every tower is a real button with its fog said as what is missing;
 * the survey list under the map stays the text source of truth. */

const PROVINCE_TINT = ["#b5542e", "#6f7fa8", "#c49a3a", "#8a5a86", "#4f8a94", "#a65f4f", "#8d8a55", "#b07a45"];

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduce(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduce;
}

// --- Painted pieces (decorative, aria-hidden) -------------------------------------------------------------

function Mountain({ g }: { g: Glyph }) {
  const k = g.s;
  return (
    <g transform={`translate(${g.x} ${g.y}) scale(${k})`}>
      <path d="M-11 6 L-3 -8 L2 -1 L6 -11 L14 6 Z" fill="#a38a5c" stroke="#2b2118" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M6 -11 L14 6 L7 6 L4 -2 Z M-3 -8 L2 -1 L-2 6 L-6 6 Z" fill="#6a5535" fillOpacity="0.8" />
      <path d="M6 -11 L3.5 -6 L6 -7 L8 -5 Z" fill="#f1e6c8" />
    </g>
  );
}
function Hill({ g }: { g: Glyph }) {
  return <path d="M-9 4 Q0 -7 9 4" transform={`translate(${g.x} ${g.y}) scale(${g.s})`} fill="none" stroke="#3a2a14" strokeWidth="1.2" strokeLinecap="round" />;
}
function Tree({ g }: { g: Glyph }) {
  const pine = g.v > 0.5;
  return (
    <g transform={`translate(${g.x} ${g.y}) scale(${g.s})`}>
      <path d="M0 5 V9" stroke="#2b2118" strokeWidth="1.4" />
      {pine ? (
        <path d="M0 -8 L5 1 H2.5 L6 6 H-6 L-2.5 1 H-5 Z" fill="#6e6240" stroke="#2b2118" strokeWidth="0.9" strokeLinejoin="round" />
      ) : (
        <circle cx="0" cy="0" r="6" fill="#7a6d45" stroke="#2b2118" strokeWidth="0.9" />
      )}
    </g>
  );
}

function Keep({ at }: { at: Pt }) {
  return (
    <g transform={`translate(${at.x} ${at.y})`}>
      <ellipse cx="0" cy="3" rx="46" ry="12" fill="#2b2118" fillOpacity="0.35" />
      <g stroke="#2b2118" strokeWidth="1.8" strokeLinejoin="round">
        <path d="M-40 2 V-18 h6 v-5 h6 v5 h6 v-5 h6 v5 h6 V2 Z" fill="#d9c697" />
        <path d="M16 2 V-18 h6 v-5 h6 v5 h6 v-5 h6 v5 h6 V2 Z" fill="#d9c697" />
        <path d="M-16 4 V-34 h8 v-7 h8 v7 h8 v-7 h8 v7 h6 V4 Z" fill="#ead9aa" />
        <path d="M-6 4 v-14 a6 6 0 0 1 12 0 v14 Z" fill="#2b2118" />
        <path d="M0 -41 V-62" fill="none" />
      </g>
      <g className="wm-banner">
        <path d="M0 -62 H20 L15 -56 L20 -50 H0 Z" fill="#8c2a22" stroke="#2b2118" strokeWidth="1.2" strokeLinejoin="round" />
      </g>
      <g className="wm-flame">
        <circle cx="-25" cy="-8" r="2.2" fill="#ff9a2e" />
        <circle cx="25" cy="-8" r="2.2" fill="#ff9a2e" />
      </g>
    </g>
  );
}

function Ship() {
  return (
    <g>
      <path d="M-9 0 Q0 7 9 0 L7 -3 H-7 Z" fill="#5a3d1a" stroke="#1a1209" strokeWidth="1" strokeLinejoin="round" />
      <path d="M0 -3 V-17" stroke="#1a1209" strokeWidth="1.2" />
      <path d="M1 -16 Q9 -10 1 -5 Z" fill="#f1e6c8" stroke="#1a1209" strokeWidth="0.9" />
      <path d="M-1 -14 Q-6 -9 -1 -5 Z" fill="#e0d2a8" stroke="#1a1209" strokeWidth="0.9" />
    </g>
  );
}

function Serpent({ at }: { at: Pt }) {
  return (
    <g transform={`translate(${at.x} ${at.y})`} className="wm-serpent">
      <path d="M-34 6 q8 -22 17 0 q8 -22 17 0 q8 -22 17 0" fill="none" stroke="#0b1a22" strokeWidth="6" strokeLinecap="round" />
      <path d="M-34 6 q8 -22 17 0 q8 -22 17 0 q8 -22 17 0" fill="none" stroke="#3d7d86" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M17 6 q6 -10 10 -22 q5 -3 8 0 q-1 5 -4 6 q-3 6 -6 16" fill="#3d7d86" stroke="#0b1a22" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="31" cy="-14" r="1.3" fill="#f1e6c8" />
    </g>
  );
}

function Compass({ at }: { at: Pt }) {
  const pts = (r: number, rr: number) => Array.from({ length: 8 }, (_, k) => { const a = (k * Math.PI) / 4 - Math.PI / 2; const q = k % 2 === 0 ? r : rr; return `${(Math.cos(a) * q).toFixed(1)},${(Math.sin(a) * q).toFixed(1)}`; }).join(" ");
  return (
    <g transform={`translate(${at.x} ${at.y})`} opacity="0.92">
      <circle r="44" fill="none" stroke="#d9a93e" strokeWidth="1.2" strokeOpacity="0.7" />
      <circle r="38" fill="none" stroke="#d9a93e" strokeWidth="0.6" strokeOpacity="0.6" strokeDasharray="2 3" />
      <polygon points={pts(42, 11)} fill="#d9a93e" fillOpacity="0.9" stroke="#2a1a06" strokeWidth="1" strokeLinejoin="round" />
      <polygon points={pts(26, 8).split(" ").map((p, k) => (k % 2 === 1 ? p : p)).join(" ")} fill="#f6dc9a" stroke="#2a1a06" strokeWidth="0.8" transform="rotate(22.5)" />
      <circle r="4" fill="#8c2a22" stroke="#2a1a06" strokeWidth="1" />
      <text y="-48" textAnchor="middle" fontSize="13" fontWeight="700" fontFamily="Georgia, serif" fill="#f6dc9a">N</text>
    </g>
  );
}

function Scenery({ world, realm, hatchProv }: { world: ReturnType<typeof buildWorld>; realm: ReturnType<typeof placeRealm>; hatchProv: string }) {
  return (
    <>
      <path d={world.landPath} fill="#cdb078" />
      {world.islands.map((i, k) => (
        <path key={k} d={i.path} fill="#cdb078" stroke="#2b2118" strokeWidth="1.8" strokeLinejoin="round" />
      ))}
      <g clipPath="url(#wm-land)">
        {realm.provinces.map((p) => (
          <path key={p.index} d={p.path} fill={p.unsorted ? `url(#${hatchProv})` : PROVINCE_TINT[p.index % PROVINCE_TINT.length]} fillOpacity={p.unsorted ? 0.9 : 0.3} stroke="#2b2118" strokeOpacity="0.55" strokeWidth="1.6" strokeDasharray={p.unsorted ? "2 5" : "9 6"} />
        ))}
        {world.rivers.map((d, k) => (
          <path key={k} d={d} fill="none" stroke="#2a5a6a" strokeWidth="3.2" strokeLinecap="round" strokeOpacity="0.9" />
        ))}
        {realm.roads.map((d, k) => (
          <path key={k} d={d} fill="none" stroke="#5a3d1a" strokeWidth="1.8" strokeDasharray="1 6" strokeLinecap="round" strokeOpacity="0.85" />
        ))}
        {realm.hills.map((g, k) => <Hill key={k} g={g} />)}
        {realm.mountains.map((g, k) => <Mountain key={k} g={g} />)}
        {realm.forests.map((g, k) => <Tree key={k} g={g} />)}
      </g>
      <path d={world.landPath} fill="none" stroke="#2b2118" strokeWidth="2.4" strokeLinejoin="round" />
    </>
  );
}

// --- The map ---------------------------------------------------------------------------------------------

export interface WorldMapProps {
  towers: TowerFog[];
  /** holding id -> sector name, or null when none is set. */
  sectors: Record<string, string | null>;
  /** False when the sectors could not be read at all (the unsorted province is then named so). */
  sectorsKnown: boolean;
  hatchId: string;
  selectedId: string | null;
  flags: Map<string, MapFlag>;
  onSelect: (id: string) => void;
  onEscape: () => void;
}

const weightOf = (t: TowerFog) => weightText(t.weightPct === null ? null : String(t.weightPct));
const SPRITE_BASE_Y = TOWER_BOX.y + TOWER_BOX.h;

export default function WorldMap({ towers, sectors, sectorsKnown, hatchId, selectedId, flags, onSelect, onEscape }: WorldMapProps) {
  const uid = useId().replace(/:/g, "");
  const hatchProv = `wm-hatch-${uid}`;
  const boxRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const reduce = usePrefersReducedMotion();
  const running = useSceneRunning(boxRef);
  const [size, setSize] = useState({ cw: 1000, ch: 640 });
  const [view, setViewRaw] = useState<View>({ cx: WORLD.w / 2, cy: WORLD.h / 2, z: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const setView = useCallback((v: View) => setViewRaw(clampView(v)), []);
  const measured = useRef(false);
  const anim = useRef<number | null>(null);
  const [hot, setHot] = useState<string | null>(null);
  const [stop, setStop] = useState(0);
  const btnRefs = useRef(new Map<string, HTMLButtonElement>());

  const world = useMemo(() => buildWorld(), []);
  const items = useMemo<PlaceInput[]>(() => towers.map((t) => ({ id: t.holdingId, weightPct: t.weightPct, sector: sectors[t.holdingId] ?? null })), [towers, sectors]);
  const realm = useMemo(() => placeRealm(items, sectorsKnown ? undefined : "Sector unknown"), [items, sectorsKnown]);
  const towerById = useMemo(() => new Map(towers.map((t) => [t.holdingId, t])), [towers]);
  const placed = useMemo(() => realm.settlements.map((s) => ({ s, t: towerById.get(s.id) as TowerFog })).filter((x) => x.t), [realm, towerById]);

  // Measure the box; the first measure picks the starting view (phones start zoomed on the capital).
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const apply = () => {
      const cw = el.clientWidth || 1000;
      const ch = el.clientHeight || 640;
      setSize({ cw, ch });
      if (!measured.current && el.clientWidth > 0) {
        measured.current = true;
        setViewRaw(initialView(cw));
      }
    };
    apply();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const flyTo = useCallback(
    (target: View) => {
      if (anim.current !== null) cancelAnimationFrame(anim.current);
      const to = clampView(target);
      if (reduce || typeof requestAnimationFrame === "undefined") {
        setViewRaw(to);
        return;
      }
      const from = viewRef.current;
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / 380);
        const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        setViewRaw({ cx: from.cx + (to.cx - from.cx) * e, cy: from.cy + (to.cy - from.cy) * e, z: from.z + (to.z - from.z) * e });
        anim.current = p < 1 ? requestAnimationFrame(step) : null;
      };
      anim.current = requestAnimationFrame(step);
    },
    [reduce],
  );
  useEffect(() => () => { if (anim.current !== null) cancelAnimationFrame(anim.current); }, []);

  // Pointer: drag to pan, two fingers to pinch.
  const pointers = useRef(new Map<number, Pt>());
  const pinch = useRef<number | null>(null);
  const drag = useRef<{ moved: boolean } | null>(null);
  const local = (e: { clientX: number; clientY: number }): Pt => {
    const r = boxRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    if (anim.current !== null) { cancelAnimationFrame(anim.current); anim.current = null; }
    pointers.current.set(e.pointerId, local(e));
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { moved: false };
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId) as Pt;
    const now = local(e);
    pointers.current.set(e.pointerId, now);
    const { cw, ch } = sizeRef.current;
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      setView(zoomAt(viewRef.current, d / pinch.current, mid, cw, ch));
      pinch.current = d;
      return;
    }
    if (drag.current) drag.current.moved = true;
    setView(panBy(viewRef.current, now.x - prev.x, now.y - prev.y, cw, ch));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) drag.current = null;
  };

  // ctrl / cmd + wheel zooms; a plain wheel keeps scrolling the page.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const { cw, ch } = sizeRef.current;
      setViewRaw((v) => zoomAt(v, Math.exp(-e.deltaY * 0.0022), { x: e.clientX - r.left, y: e.clientY - r.top }, cw, ch));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const { cw, ch } = size;
  const vb = viewBox(view, cw, ch);
  const s = vb.s;
  const zoomBy = (f: number) => flyTo(zoomAt(viewRef.current, f, { x: cw / 2, y: ch / 2 }, cw, ch));

  // Keyboard: one tab stop; arrows hop to the nearest tower that way; + - 0 zoom.
  const ids = placed.map((p) => p.s.id);
  const stopId = ids[Math.min(stop, Math.max(0, ids.length - 1))];
  const focusAt = (i: number) => {
    const id = ids[i];
    if (!id) return;
    setStop(i);
    const p = placed[i].s;
    flyTo(ensureVisible(viewRef.current, p, cw, ch));
    btnRefs.current.get(id)?.focus();
  };
  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key === "Escape") { e.preventDefault(); onEscape(); return; }
    if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomBy(1.4); return; }
    if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomBy(1 / 1.4); return; }
    if (e.key === "0") { e.preventDefault(); flyTo(initialView(cw)); return; }
    if (e.key === "Home") { e.preventDefault(); focusAt(0); return; }
    if (e.key === "End") { e.preventDefault(); focusAt(ids.length - 1); return; }
    if (!isDirKey(e.key)) return;
    e.preventDefault();
    focusAt(nearestInDirection(i, e.key, placed.map((p) => p.s)));
  };

  // Names: as many as fit, heaviest first; the pressed, hovered or focused one always.
  const pinned = useMemo(() => new Set([selectedId, hot].filter((x): x is string => !!x)), [selectedId, hot]);
  const labelItems = placed.map(({ s: st, t }) => {
    const sp = toScreen({ x: st.x, y: st.y }, view, cw, ch);
    return { id: st.id, text: t.name, sx: sp.x, sy: sp.y, weight: t.weightPct ?? 0 };
  });
  const labels = chooseLabels(labelItems, pinned, cw, ch, 4);

  const keepSp = toScreen(CAPITAL, view, cw, ch);
  const keepFlag = flags.get("keep");
  const motion = !reduce && running;

  useEffect(() => {
    const svg = svgRef.current as (SVGSVGElement & { pauseAnimations?: () => void; unpauseAnimations?: () => void }) | null;
    if (!svg) return;
    if (motion) svg.unpauseAnimations?.();
    else svg.pauseAnimations?.();
  }, [motion]);

  return (
    <div className="wm-wrap">
      <div
        ref={boxRef}
        className="wm-box"
        data-zoomed={view.z > 1.05 ? "true" : "false"}
        data-motion={motion ? "on" : "off"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="group"
        aria-label="Map of the realm: one settlement per holding, one province per sector"
      >
        <svg ref={svgRef} className="wm-svg" viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} preserveAspectRatio="none" aria-hidden focusable="false">
          <defs>
            <linearGradient id={`wm-sea-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1d4351" />
              <stop offset="1" stopColor="#0d222d" />
            </linearGradient>
            <pattern id={`wm-wave-${uid}`} width="46" height="22" patternUnits="userSpaceOnUse">
              <path d="M4 12 q5 -5 10 0 t10 0 t10 0" fill="none" stroke="#7fb2bd" strokeOpacity="0.34" strokeWidth="1.2" strokeLinecap="round" />
            </pattern>
            <pattern id={hatchProv} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="9" height="9" fill="#a4aab7" />
              <line x1="0" y1="0" x2="0" y2="9" stroke="#3a3f4a" strokeWidth="1.6" />
            </pattern>
            <clipPath id="wm-land"><path d={world.landPath} /></clipPath>
            <radialGradient id={`wm-glow-${uid}`} cx="50%" cy="46%" r="62%">
              <stop offset="0" stopColor="#ffe6a8" stopOpacity="0.22" />
              <stop offset="1" stopColor="#000" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect x="-1500" y="-1500" width="4000" height="3720" fill={`url(#wm-sea-${uid})`} />
          <g className="wm-drift wm-drift-a"><rect x="-1500" y="-1500" width="4046" height="3744" fill={`url(#wm-wave-${uid})`} /></g>
          {[11, 20, 29].map((k) => (
            <path key={k} d={world.landPath} fill="none" stroke="#6fa7b2" strokeOpacity={0.34 - k * 0.008} strokeWidth={k * 2} strokeLinejoin="round" />
          ))}
          {world.islands.flatMap((i, n) => [9, 17].map((k) => <path key={`${n}-${k}`} d={i.path} fill="none" stroke="#6fa7b2" strokeOpacity={0.3 - k * 0.008} strokeWidth={k * 2} strokeLinejoin="round" />))}
          <g className="wm-drift wm-drift-b">
            {world.waves.map((p, k) => (
              <path key={k} d={`M${p.x} ${p.y} q4 -4 8 0 t8 0 t8 0`} fill="none" stroke="#a5d0d8" strokeOpacity="0.4" strokeWidth="1.2" strokeLinecap="round" />
            ))}
          </g>
          <Compass at={world.compass} />
          <Serpent at={world.serpent} />
          <Scenery world={world} realm={realm} hatchProv={hatchProv} />
          <rect x="-1500" y="-1500" width="4000" height="3720" fill={`url(#wm-glow-${uid})`} pointerEvents="none" />
          {placed.map(({ s: st, t }) => (
            <g key={st.id} transform={`translate(${st.x} ${st.y})`}>
              <ellipse cx="0" cy="2" rx={44 * st.scale * 1.5} ry={9 * st.scale * 1.5} fill="#2b2118" fillOpacity="0.4" />
              <g transform={`scale(${st.scale}) translate(${-(TOWER_BOX.x + TOWER_BOX.w / 2)} ${-SPRITE_BASE_Y})`}>
                <TowerFigure slots={fogSlots(t)} hatchId={hatchId} />
              </g>
            </g>
          ))}
          <Keep at={CAPITAL} />
          {motion &&
            world.shipLoops.map((d, k) => (
              <g key={k}>
                <Ship />
                <animateMotion dur={`${90 + k * 40}s`} repeatCount="indefinite" path={d} begin={`-${k * 31}s`} />
              </g>
            ))}
          {!motion &&
            world.shipLoops.map((_, k) => {
              const p = world.coast[(k * 41 + 9) % world.coast.length];
              const x = Math.min(985, Math.max(15, CAPITAL.x + (p.x - CAPITAL.x) * (1.12 + k * 0.08)));
              const y = Math.min(705, Math.max(15, CAPITAL.y + (p.y - CAPITAL.y) * (1.12 + k * 0.08)));
              return <g key={k} transform={`translate(${x} ${y})`}><Ship /></g>;
            })}
        </svg>

        {realm.provinces.map((p) => {
          const sp = toScreen(p.label, view, cw, ch);
          return (
            <span key={p.index} className="wm-prov" data-unsorted={p.unsorted ? "true" : undefined} style={{ left: sp.x, top: sp.y }} aria-hidden>
              {p.name}
            </span>
          );
        })}
        {labels.map((l) => (
          <span key={l.id} className="wm-name" data-hot={pinned.has(l.id) ? "true" : undefined} style={{ left: l.x, top: l.y, width: l.w }} aria-hidden>
            {towerById.get(l.id)?.name}
          </span>
        ))}

        {keepFlag && (
          <span className="wm-keep-flag" style={{ left: keepSp.x + 22, top: keepSp.y - 74 * s }} aria-hidden>
            <FlagMark shape={keepFlag.shape} n={keepFlag.number} />
          </span>
        )}
        {placed.map(({ s: st, t }, i) => {
          const sp = toScreen({ x: st.x, y: st.y }, view, cw, ch);
          const spriteH = (TOWER_BOX.h + 14) * st.scale * s;
          const hit = Math.max(44, 70 * st.scale * s);
          const flag = flags.get(st.id);
          return (
            <button
              key={st.id}
              type="button"
              id={`wm-btn-${st.id}`}
              ref={(el) => {
                if (el) btnRefs.current.set(st.id, el);
                else btnRefs.current.delete(st.id);
              }}
              className="wm-tower"
              style={{ width: hit, height: Math.max(hit, spriteH), left: sp.x - hit / 2, top: sp.y - Math.max(hit, spriteH) + 6 * s }}
              aria-pressed={selectedId === st.id}
              aria-controls="map-slate"
              aria-label={towerAriaLabel(t, weightOf(t))}
              title={`${weightOf(t)} of the book`}
              tabIndex={st.id === stopId ? 0 : -1}
              onFocus={() => { setHot(st.id); setStop(i); }}
              onBlur={() => setHot((h) => (h === st.id ? null : h))}
              onMouseEnter={() => setHot(st.id)}
              onMouseLeave={() => setHot((h) => (h === st.id ? null : h))}
              onClick={() => { setStop(i); onSelect(st.id); flyTo(ensureVisible(viewRef.current, st, cw, ch)); }}
              onKeyDown={(e) => onKey(e, i)}
            >
              {flag && <FlagMark shape={flag.shape} n={flag.number} />}
            </button>
          );
        })}

        <div className="wm-controls">
          <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1.45)} disabled={view.z >= 4.4}>+</button>
          <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.45)} disabled={view.z <= 1.02}>−</button>
          <button type="button" aria-label="Show the whole realm" onClick={() => flyTo(initialView(cw))}>
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden focusable="false"><path d="M3 9 L10 3 L17 9 V17 H12 V12 H8 V17 H3 Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>
      <ul className="wm-legend" aria-label="Provinces">
        {realm.provinces.map((p) => (
          <li key={p.index}>
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden focusable="false">
              <rect x="1" y="1" width="14" height="14" rx="2" fill={p.unsorted ? "#a4aab7" : PROVINCE_TINT[p.index % PROVINCE_TINT.length]} fillOpacity={p.unsorted ? 1 : 0.55} stroke="currentColor" strokeWidth="1.4" strokeDasharray={p.unsorted ? "2 2" : undefined} />
              {p.unsorted && <path d="M2 14 L14 2 M2 9 L9 2 M7 14 L14 7" stroke="#3a3f4a" strokeWidth="1.2" />}
            </svg>
            <span>{p.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
