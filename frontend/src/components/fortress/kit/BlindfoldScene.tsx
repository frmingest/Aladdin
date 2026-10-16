import { useEffect, useState } from "react";
import { formatFigure, gaugeTicks, sceneY } from "../../../lib/blindfold";
import { getObjectArt, useArtMode } from "../../../lib/stitchArt";
import "./blindfold.css";

/**
 * The river bank of Blindfold Years (E1, visual verb: stake the flood line). The gauge post is the scale;
 * the owner earnings of the years shown are tide marks on the bank; your two stakes stand on the gauge at
 * your low and high figures, and on reveal the water rises to the stored figure. Every fact (marks,
 * stakes, water level) is drawn by code over neutral pictures, and the page states each of them in words
 * and in a table, so the scene itself is hidden from assistive technology. Art off: the same scene with
 * drawn markers only. The water rises once; it never loops, and not at all under reduced motion.
 */

export const SCENE_W = 360;
export const SCENE_H = 300;
const TOP = 30;
const BOTTOM = 266;
const AXIS_X = 222;
const MARK_X0 = 30;
const MARK_X1 = 156;
const POST_W = 26;
const STAKE_W = 26;
// A pale outline under every label so it stays readable across a line or the water.
const HALO = { paintOrder: "stroke", stroke: "#f6e9d2", strokeWidth: 3, strokeLinejoin: "round" } as const;

export interface ScenePoint {
  label: string;
  value: number;
}

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

export default function BlindfoldScene({
  points,
  min,
  max,
  low,
  high,
  actual,
}: {
  points: ScenePoint[];
  min: number;
  max: number;
  low: number | null;
  high: number | null;
  actual: number | null;
}) {
  const y = (v: number) => sceneY(v, min, max, TOP, BOTTOM);
  const [risen, setRisen] = useState(false);
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
  const band = low !== null && high !== null ? { top: y(Math.max(low, high)), bottom: y(Math.min(low, high)) } : null;
  const lowY = low !== null ? y(low) : null;
  const highY = high !== null ? y(high) : null;
  const waterY = actual !== null ? y(actual) : BOTTOM;

  return (
    <div className="bf-scene" aria-hidden="true" data-testid="blindfold-scene">
      <svg viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} preserveAspectRatio="xMidYMid slice" focusable="false">
        <defs>
          <linearGradient id="bf-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f6e9d2" />
            <stop offset="1" stopColor="#bfdde0" />
          </linearGradient>
        </defs>
        <rect width={SCENE_W} height={SCENE_H} fill="url(#bf-sky)" />
        {/* the stored figure, as a water level that rises once on reveal */}
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
        {actual !== null && (
          <g>
            <line x1="0" x2={SCENE_W} y1={waterY} y2={waterY} stroke="#26253b" strokeWidth="1.5" strokeDasharray="2 3" />
            <text x="8" y={waterY - 6} fontSize="12" fontWeight="600" fill="#26253b" {...HALO}>
              Stored figure {formatFigure(String(actual), "money")}
            </text>
          </g>
        )}
        {/* the gauge scale */}
        <line x1={AXIS_X} x2={AXIS_X} y1={TOP - 6} y2={BOTTOM + 6} stroke="#26253b" strokeWidth="2" />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={AXIS_X + 5} x2={SCENE_W - 62} y1={y(t)} y2={y(t)} stroke="#26253b" strokeOpacity="0.22" strokeWidth="1" />
            <line x1={AXIS_X - 5} x2={AXIS_X + 5} y1={y(t)} y2={y(t)} stroke="#26253b" strokeWidth="1.5" />
            <text x={SCENE_W - 6} y={y(t) + 4} fontSize="12" textAnchor="end" fill="#26253b" {...HALO}>
              {formatFigure(String(t), "money")}
            </text>
          </g>
        ))}
        {/* tide marks: owner earnings of the years shown */}
        {marks.length > 1 && (
          <polyline points={marks.map((m) => `${m.x},${m.y}`).join(" ")} fill="none" stroke="#26253b" strokeWidth="1.5" strokeDasharray="4 3" />
        )}
        {marks.map((m) => (
          <g key={m.label}>
            <circle cx={m.x} cy={m.y} r="4.5" fill="#f6e9d2" stroke="#26253b" strokeWidth="1.5" />
            <text x={m.x} y={m.y - 9} fontSize="12" textAnchor="middle" fill="#26253b" {...HALO}>
              {m.label.replace("Year ", "Y").replace("-", "\u2212")}
            </text>
          </g>
        ))}
        {/* your range */}
        {band && <rect x={AXIS_X - 38} y={band.top} width="76" height={Math.max(band.bottom - band.top, 1)} fill="url(#bf-hatch)" fillOpacity="0.55" stroke="#0a7c85" strokeWidth="1.5" />}
        {lowY !== null && (
          <g>
            <polygon points={`${AXIS_X - 30},${lowY} ${AXIS_X - 37},${lowY + 9} ${AXIS_X - 23},${lowY + 9}`} fill="#26253b" />
            <text x={AXIS_X - 44} y={lowY + 8} fontSize="12" fontWeight="600" textAnchor="end" fill="#26253b" {...HALO}>
              Low
            </text>
          </g>
        )}
        {highY !== null && (
          <g>
            <polygon points={`${AXIS_X + 30},${highY} ${AXIS_X + 23},${highY - 9} ${AXIS_X + 37},${highY - 9}`} fill="#26253b" />
            <text x={AXIS_X + 44} y={highY - 2} fontSize="12" fontWeight="600" fill="#26253b" {...HALO}>
              High
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
