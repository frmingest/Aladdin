import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatFigure, gaugeTicks, moveStake, sceneY, valueFromSceneY } from "../../../lib/blindfold";
import { getObjectArt, useArtMode } from "../../../lib/stitchArt";
import "./blindfold.css";

/**
 * The river bank of Blindfold Years (E1, visual verb: stake the flood line). The gauge post is the scale;
 * the owner earnings of the years shown are tide marks on the bank; your two stakes stand on the gauge at
 * your low and high figures, and on reveal the water rises to the answer. Play happens in the picture: drag
 * the two pills (or tap the gauge, or use the arrow keys on a focused pill) to move the stakes. Every fact (marks,
 * stakes, water level) is drawn by code over neutral pictures, and the page states each of them in words
 * and in a table, so the scene itself is hidden from assistive technology. Art off: the same scene with
 * drawn markers only. The water rises once; it never loops, and not at all under reduced motion.
 */

export const SCENE_W = 420;
export const SCENE_H = 320;
const TOP = 46;
const BOTTOM = 266;
const AXIS_X = 215;
const MARK_X0 = 76;
const MARK_X1 = 176;
const POST_W = 26;
const STAKE_W = 26;
const PILL_X = AXIS_X + 46;
const PILL_W = 132;
const PILL_H = 24;
// A pale outline under every label so it stays readable across a line or the water.
const HALO = { paintOrder: "stroke", stroke: "#f6e9d2", strokeWidth: 3, strokeLinejoin: "round" } as const;

export interface ScenePoint {
  label: string;
  value: number;
}

export type ScenePosition = "below" | "inside" | "above";

function Art({ id, x, y, w, flip = false, anchor = "top" }: { id: string; x: number; y: number; w: number; flip?: boolean; anchor?: "top" | "bottom" }) {
  const mode = useArtMode();
  const art = getObjectArt(id);
  if (mode !== "stitch" || !art) return null;
  const h = (w * art.height) / art.width;
  const top = anchor === "bottom" ? y - h : y;
  return (
    <img
      src={art.src}
      alt=""
      aria-hidden="true"
      width={art.width}
      height={art.height}
      decoding="async"
      className="bf-art"
      style={{
        left: `${((x - w / 2) / SCENE_W) * 100}%`,
        top: `${(top / SCENE_H) * 100}%`,
        width: `${(w / SCENE_W) * 100}%`,
        transform: flip ? "scaleX(-1)" : undefined,
      }}
    />
  );
}

/** A grab pill: a word and a figure on a dark chip, with grip lines when it can be moved. */
function Pill({ y, word, figure, grip, light = false }: { y: number; word: string; figure: string; grip: boolean; light?: boolean }) {
  const fill = light ? "#f6e9d2" : "#26253b";
  const ink = light ? "#26253b" : "#f6e9d2";
  return (
    <g>
      <rect x={PILL_X} y={y - PILL_H / 2} width={PILL_W} height={PILL_H} rx="12" fill={fill} stroke={light ? "#26253b" : "#d6a85a"} strokeWidth="1.5" />
      {grip && (
        <g stroke="#d6a85a" strokeWidth="1.5" strokeLinecap="round">
          <line x1={PILL_X + 10} x2={PILL_X + 18} y1={y - 3} y2={y - 3} />
          <line x1={PILL_X + 10} x2={PILL_X + 18} y1={y + 3} y2={y + 3} />
        </g>
      )}
      <text x={PILL_X + (grip ? 24 : 12)} y={y + 4} fontSize="12" fontWeight="700" fill={ink}>
        {word}
      </text>
      <text x={PILL_X + PILL_W - 10} y={y + 4} fontSize="12" textAnchor="end" fill={ink}>
        {figure}
      </text>
    </g>
  );
}

export default function BlindfoldScene({
  points,
  min,
  max,
  low,
  high,
  actual,
  position = null,
  onChange,
}: {
  points: ScenePoint[];
  min: number;
  max: number;
  low: number | null;
  high: number | null;
  actual: number | null;
  /** Where the answer fell, shown as a stamp once it is known. */
  position?: ScenePosition | null;
  /** When given (and the answer is not yet known) the stakes can be moved in the picture. */
  onChange?: (which: "low" | "high", value: number) => void;
}) {
  const y = (v: number) => sceneY(v, min, max, TOP, BOTTOM);
  const [risen, setRisen] = useState(false);
  const sceneRef = useRef<HTMLDivElement>(null);
  const drag = useRef<"low" | "high" | null>(null);
  useEffect(() => {
    if (actual === null) {
      setRisen(false);
      return;
    }
    const t = window.requestAnimationFrame(() => setRisen(true));
    return () => window.cancelAnimationFrame(t);
  }, [actual]);

  const ticks = gaugeTicks(min, max, 4);
  const step = points.length > 1 ? (MARK_X1 - MARK_X0) / (points.length - 1) : 0;
  const marks = points.map((p, i) => ({ ...p, x: MARK_X0 + i * step, y: y(p.value) }));
  const lo = low !== null && high !== null ? Math.min(low, high) : low;
  const hi = low !== null && high !== null ? Math.max(low, high) : high;
  const lowY = lo !== null ? y(lo) : null;
  const highY = hi !== null ? y(hi) : null;
  const band = lowY !== null && highY !== null ? { top: highY, bottom: lowY } : null;
  const waterY = actual !== null ? y(actual) : BOTTOM;
  const playable = !!onChange && actual === null && lo !== null && hi !== null;

  // The answer tag sits above the water line, or below it when a stake pill is in the way.
  const clash = (cy: number) => [lowY, highY].some((s) => s !== null && Math.abs(s - cy) < PILL_H);
  const answerY = actual !== null ? (clash(waterY - 16) && !clash(waterY + 16) ? waterY + 16 : waterY - 16) : 0;

  const move = (which: "low" | "high", value: number) => {
    if (!onChange || lo === null || hi === null) return;
    onChange(which, moveStake(which, value, lo, hi, min, max));
  };
  const sceneYFromEvent = (e: PointerEvent) => {
    const r = sceneRef.current?.getBoundingClientRect();
    if (!r || r.height === 0) return null;
    return ((e.clientY - r.top) / r.height) * SCENE_H;
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    const sy = sceneYFromEvent(e);
    if (!playable || sy === null || lowY === null || highY === null) return;
    drag.current = Math.abs(sy - lowY) <= Math.abs(sy - highY) ? "low" : "high";
    e.currentTarget.setPointerCapture(e.pointerId);
    move(drag.current, valueFromSceneY(sy, min, max, TOP, BOTTOM));
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const sy = sceneYFromEvent(e);
    if (drag.current && sy !== null) move(drag.current, valueFromSceneY(sy, min, max, TOP, BOTTOM));
  };
  const onUp = () => {
    drag.current = null;
  };
  const onKey = (which: "low" | "high", e: KeyboardEvent<HTMLDivElement>) => {
    const cur = which === "low" ? lo : hi;
    if (cur === null) return;
    const small = (max - min) / 50;
    const delta = { ArrowUp: small, ArrowRight: small, ArrowDown: -small, ArrowLeft: -small, PageUp: small * 5, PageDown: -small * 5 }[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    move(which, cur + delta);
  };

  return (
    <div className="bf-scene" ref={sceneRef} data-testid="blindfold-scene">
      <div aria-hidden="true" className="bf-layer">
        <svg viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} preserveAspectRatio="xMidYMid slice" focusable="false">
          <defs>
            <linearGradient id="bf-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f6e9d2" />
              <stop offset="1" stopColor="#bfdde0" />
            </linearGradient>
          </defs>
          <rect width={SCENE_W} height={SCENE_H} fill="url(#bf-sky)" />
          {/* the answer, as a water level that rises once on reveal */}
          <rect
            className="bf-water"
            x="0"
            width={SCENE_W}
            y={risen ? waterY : BOTTOM}
            height={risen ? BOTTOM - waterY + 14 : 14}
            fill="#3f8fa5"
            fillOpacity="0.78"
            data-testid="blindfold-water"
          />
          {/* the bank */}
          <rect x="0" y={BOTTOM + 14} width={SCENE_W} height={SCENE_H - BOTTOM - 14} fill="#4b4a5f" />
        </svg>
        <Art id="blindfold-gauge-post" x={AXIS_X} y={TOP - 14} w={POST_W} />
        {lowY !== null && <Art id="blindfold-stake" x={AXIS_X - 30} y={lowY} w={STAKE_W} anchor="bottom" />}
        {highY !== null && <Art id="blindfold-stake" x={AXIS_X + 30} y={highY} w={STAKE_W} flip anchor="bottom" />}
        {/* everything that carries a fact is drawn above the pictures: scale, marks, range, stakes, labels */}
        <svg viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} preserveAspectRatio="xMidYMid slice" focusable="false">
          <defs>
            <pattern id="bf-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="#0a7c85" strokeWidth="2" />
            </pattern>
          </defs>
          {actual !== null && <line x1="0" x2={SCENE_W} y1={waterY} y2={waterY} stroke="#26253b" strokeWidth="1.5" strokeDasharray="2 3" />}
          {/* the gauge scale: figures on the left edge, the post in the middle */}
          <line x1={AXIS_X} x2={AXIS_X} y1={TOP - 6} y2={BOTTOM + 6} stroke="#26253b" strokeWidth="2" />
          {ticks.map((t) => (
            <g key={t}>
              <line x1="50" x2={AXIS_X - 5} y1={y(t)} y2={y(t)} stroke="#26253b" strokeOpacity="0.18" strokeWidth="1" />
              <line x1={AXIS_X - 5} x2={AXIS_X + 5} y1={y(t)} y2={y(t)} stroke="#26253b" strokeWidth="1.5" />
              <text x="6" y={y(t) + 4} fontSize="11" fill="#26253b" {...HALO}>
                {formatFigure(String(t), "money")}
              </text>
            </g>
          ))}
          {/* tide marks: owner earnings of the years shown; the year names sit on the bank */}
          {marks.length > 1 && (
            <polyline points={marks.map((m) => `${m.x},${m.y}`).join(" ")} fill="none" stroke="#26253b" strokeWidth="1.5" strokeDasharray="4 3" />
          )}
          {marks.map((m) => (
            <g key={m.label}>
              <circle cx={m.x} cy={m.y} r="4.5" fill="#f6e9d2" stroke="#26253b" strokeWidth="1.5" />
              <text x={m.x} y={SCENE_H - 10} fontSize="12" textAnchor="middle" fill="#f6e9d2">
                {m.label.replace("Year ", "Y").replace("-", "\u2212")}
              </text>
            </g>
          ))}
          {/* your range */}
          {band && <rect x={AXIS_X - 38} y={band.top} width="76" height={Math.max(band.bottom - band.top, 1)} fill="url(#bf-hatch)" fillOpacity="0.55" stroke="#0a7c85" strokeWidth="1.5" />}
          {lowY !== null && lo !== null && <Pill y={lowY} word="Low" figure={formatFigure(String(lo), "money")} grip={playable} />}
          {highY !== null && hi !== null && <Pill y={highY} word="High" figure={formatFigure(String(hi), "money")} grip={playable} />}
          {actual !== null && <Pill y={answerY} word="Answer" figure={formatFigure(String(actual), "money")} grip={false} light />}
          {position && (
            <g>
              <rect x="10" y="8" width="146" height="28" rx="14" fill={position === "inside" ? "#0a7c85" : "#26253b"} stroke="#d6a85a" strokeWidth="1.5" />
              <text x="24" y="27" fontSize="14" fontWeight="700" fill="#f6e9d2">
                {position === "inside" ? "\u25CF Caught it!" : position === "above" ? "\u25B2 Missed: above" : "\u25BC Missed: below"}
              </text>
            </g>
          )}
        </svg>
      </div>
      {playable && (
        <div className="bf-drag" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} data-testid="blindfold-drag">
          {(
            [
              ["low", "Low stake", lo, lowY],
              ["high", "High stake", hi, highY],
            ] as const
          ).map(([which, label, value, sy]) => (
            <div
              key={which}
              role="slider"
              tabIndex={0}
              aria-label={label}
              aria-orientation="vertical"
              aria-valuemin={min}
              aria-valuemax={max}
              aria-valuenow={value ?? min}
              aria-valuetext={formatFigure(String(value ?? min), "money")}
              className="bf-handle"
              style={{ top: `${((sy ?? 0) / SCENE_H) * 100}%`, left: `${((PILL_X - (AXIS_X - 60)) / (SCENE_W - (AXIS_X - 60))) * 100}%`, width: `${(PILL_W / (SCENE_W - (AXIS_X - 60))) * 100}%` }}
              onKeyDown={(e) => onKey(which, e)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
