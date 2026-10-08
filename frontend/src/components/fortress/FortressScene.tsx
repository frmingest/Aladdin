import { useMemo, useRef, type KeyboardEvent } from "react";
import { isNavKey, nextTower } from "../../lib/sceneNav";
import { useSceneRunning } from "./useScenePause";
import {
  CURTAIN_HEIGHT,
  FRESHNESS_LABEL,
  LAND_LABEL,
  MOAT_LABEL,
  SCENE_WIDTH,
  SIEGE_LABEL,
  STRUCTURE_LABEL,
  WALL_EDGE,
  groundY,
  moatRuns,
  THESIS_LABEL,
  WALL_LABEL,
  describeTower,
  drawnShacks,
  ladderCount,
  landSignText,
  sharedWallLinks,
  siegeSky,
  type FortressLayout,
  type MoatRun,
  type PlacedKeep,
  type PlacedTower,
} from "../../lib/fortress";
import type { RealmLevel } from "../../lib/realmVerdict";
import LampLogo from "../LampLogo";
import type { FortressShantytown, FortressSiegeLevel, FortressWall, GameSiege, GameTower } from "../../lib/types";
import { worldPalette } from "../../lib/fortressArt";
import { SceneAmbience, SceneBackdrop, SceneDefs, SceneVignette } from "./sceneWorld";
import MarketSquare, { MARKET_HEIGHT, type MarketSquareProps } from "./MarketSquare";
import RavenMark from "./RavenMark";

/**
 * The Fortress home scene (F33): a painted 2.5D diorama of the real
 * portfolio. It is a picture of values the backend already decided — it
 * never computes how strong anything is (backend/app/domain/game_mapping).
 * Colours are fixed on purpose: the scene is a painting in a frame and reads
 * the same in the dark and light themes. Everything shown here is also in
 * the Ledger view, so the picture is never the only way to read a fact.
 *
 * Visual language (G7 art pass, 2026-10-01): light comes from the left, every
 * building has a lit and a shadowed side, a contact shadow and painterly grain.
 * The wall material decides both the masonry and the roof (slate for stone,
 * shingle for timber, a holed roof for rot), so quality reads twice.
 */

const SERIF = '"Marcellus", "Palatino Linotype", Palatino, Georgia, serif';

interface Material {
  base: string;
  dark: string;
  pattern: string;
  roof: string;
  trim: string;
  stone: boolean;
}

const MATERIAL: Record<FortressWall, Material> = {
  basalt: { base: "#3c4656", dark: "#1f2530", pattern: "fs-basalt", roof: "fs-roof-slate", trim: "url(#fs-gold)", stone: true },
  granite: { base: "#9097a1", dark: "#585d66", pattern: "fs-granite", roof: "fs-roof-slate", trim: "url(#fs-gold)", stone: true },
  brick: { base: "#a9553a", dark: "#5e2c1d", pattern: "fs-brick", roof: "fs-roof-slate", trim: "#c9a24a", stone: true },
  timber: { base: "#8d6436", dark: "#4f3418", pattern: "fs-planks", roof: "fs-roof-wood", trim: "#6b4a26", stone: false },
  rotted: { base: "#4f3e29", dark: "#2a2014", pattern: "fs-rot", roof: "fs-roof-rot", trim: "#3a2e1c", stone: false },
  unsurveyed: { base: "#3a4352", dark: "#262c36", pattern: "fs-granite", roof: "fs-roof-slate", trim: "#888", stone: true },
  not_applicable: { base: "#7b828d", dark: "#4b5058", pattern: "fs-granite", roof: "fs-roof-slate", trim: "url(#fs-gold)", stone: true },
};

/** Keep roof height for a body of width w. */
const roofHeight = (w: number) => Math.min(66, Math.round(w * 0.62));

/** Highest drawn point of a building (roof tip), for markers and the tooltip. */
function crownY(item: PlacedTower): number {
  const { y, w, h } = item;
  switch (item.tower.structure) {
    case "outpost":
      return y - h - Math.round(w * 0.5);
    case "granary":
      return y - h - Math.round(w * 0.42);
    case "bullion":
      return y - h;
    default:
      return item.tower.wall === "unsurveyed" ? y - h : y - h - 8 - roofHeight(w);
  }
}

/** Fit the label under its tower: about 6.2 px per character in the serif,
 * so the plate stays inside the tower plus half the gap on each side. */
function shortName(name: string, towerWidth: number): string {
  const max = Math.max(7, Math.floor((towerWidth + 2) / 6.2));
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

// ---------------------------------------------------------------------------
// Parts

/** Contact shadow under a building, offset to the right, away from the light. */
function GroundShadow({ x, y, w }: { x: number; y: number; w: number }) {
  return (
    <g aria-hidden>
      <ellipse cx={x + w * 0.62} cy={y + 1} rx={w * 0.72} ry={9} fill="#000" opacity={0.45} filter="url(#fs-blur)" />
      <ellipse cx={x + w / 2} cy={y} rx={w * 0.52} ry={4} fill="#000" opacity={0.4} />
    </g>
  );
}

/** A conical roof with tile courses, eave trim and a gold finial. */
function ConeRoof({
  cx,
  base,
  half,
  height,
  fill,
  trim,
  tiles = "fs-tiles",
  broken = false,
}: {
  cx: number;
  base: number;
  half: number;
  height: number;
  fill: string;
  trim: string;
  tiles?: string;
  broken?: boolean;
}) {
  const tip = base - height;
  const shape = `M${cx - half} ${base} Q${cx - half * 0.32} ${base - height * 0.32} ${cx} ${tip} Q${cx + half * 0.32} ${base - height * 0.32} ${cx + half} ${base} Q${cx} ${base + 6} ${cx - half} ${base} Z`;
  return (
    <g>
      <path d={shape} fill={`url(#${fill})`} />
      <path d={shape} fill={`url(#${tiles})`} />
      {[-0.5, 0, 0.5].map((f) => (
        <path key={f} d={`M${cx} ${tip} L${cx + half * f} ${base + 2}`} stroke="#000" strokeOpacity={0.18} fill="none" />
      ))}
      <path d={`M${cx - half * 0.15} ${tip + height * 0.18} Q${cx - half * 0.55} ${base - height * 0.2} ${cx - half * 0.85} ${base - 1}`} stroke="#fff" strokeOpacity={0.22} strokeWidth={1.5} fill="none" />
      <path d={`M${cx - half - 2} ${base} Q${cx} ${base + 7} ${cx + half + 2} ${base}`} stroke={trim} strokeWidth={3.2} fill="none" strokeLinecap="round" />
      {broken ? (
        <>
          <path d={`M${cx + half * 0.12} ${base - height * 0.55} l7 4 l-3 7 l6 6 l-9 3 l-5 -8 Z`} fill="#0d0905" />
          <path d={`M${cx} ${tip} l5 -7`} stroke="#3a2e1c" strokeWidth={2} />
        </>
      ) : (
        <g>
          <line x1={cx} y1={tip} x2={cx} y2={tip - 7} stroke="#e8c45a" strokeWidth={1.6} />
          <circle cx={cx} cy={tip - 8} r={2.4} fill="url(#fs-gold)" />
        </g>
      )}
    </g>
  );
}

/** A swallow-tailed banner on a pole: the analysis is fresh. */
function Banner({ x, y, color = "#2c55b5" }: { x: number; y: number; color?: string }) {
  return (
    <g aria-hidden>
      <line x1={x} y1={y} x2={x} y2={y - 26} stroke="#d8c08a" strokeWidth={1.4} />
      <circle cx={x} cy={y - 27} r={1.8} fill="url(#fs-gold)" />
      <g className="fortress-banner" style={{ transformOrigin: `${x}px ${y - 22}px` }}>
        <path d={`M${x} ${y - 25} h20 l-5 5 l5 5 h-20 Z`} fill={color} stroke="#e8c45a" strokeWidth={1} />
        <path d={`M${x + 4} ${y - 22} l3 2.5 l3 -2.5 l-3 6 Z`} fill="#f2d16b" opacity={0.9} />
      </g>
    </g>
  );
}

/** An arched window: lit gold when someone is home (fresh analysis), dark otherwise. */
function ArchWindow({ x, y, w, lit }: { x: number; y: number; w: number; lit: boolean }) {
  const h = w * 2.1;
  const d = `M${x} ${y + h} V${y + w / 2} A${w / 2} ${w / 2} 0 0 1 ${x + w} ${y + w / 2} V${y + h} Z`;
  return (
    <g>
      {lit && <circle cx={x + w / 2} cy={y + h / 2} r={w * 2.4} fill="url(#fs-glow)" />}
      <path d={d} fill="#000" fillOpacity={0.45} transform="translate(-1.2 -1.2)" />
      <path d={d} fill={lit ? "url(#fs-window)" : "#0f1116"} stroke="#000" strokeOpacity={0.5} strokeWidth={0.8} />
      {lit && <line x1={x + w / 2} y1={y + 1} x2={x + w / 2} y2={y + h} stroke="#6b3a12" strokeOpacity={0.5} strokeWidth={0.8} />}
    </g>
  );
}

/** Arched wooden door in a stone (or timber) surround, with iron bands. */
function Door({ cx, y, w, h, frame }: { cx: number; y: number; w: number; h: number; frame: string }) {
  const r = w / 2;
  const outer = `M${cx - r - 3} ${y} V${y - h + r} A${r + 3} ${r + 3} 0 0 1 ${cx + r + 3} ${y - h + r} V${y} Z`;
  const inner = `M${cx - r} ${y} V${y - h + r} A${r} ${r} 0 0 1 ${cx + r} ${y - h + r} V${y} Z`;
  return (
    <g>
      <path d={outer} fill={frame} stroke="#000" strokeOpacity={0.4} />
      <path d={inner} fill="#5a371a" />
      <path d={inner} fill="url(#fs-planks)" opacity={0.9} />
      <rect x={cx - r} y={y - h * 0.62} width={w} height={2} fill="#1d1a17" opacity={0.85} />
      <rect x={cx - r} y={y - h * 0.28} width={w} height={2} fill="#1d1a17" opacity={0.85} />
      <circle cx={cx + r * 0.55} cy={y - h * 0.45} r={1.2} fill="#c9a24a" />
      <path d={inner} fill="url(#fs-shade-flat)" />
    </g>
  );
}

function Torch({ x, y }: { x: number; y: number }) {
  return (
    <g aria-hidden>
      <circle cx={x} cy={y - 6} r={12} fill="url(#fs-glow)" />
      <rect x={x - 1} y={y - 4} width={2} height={7} fill="#2a1d12" />
      <g className="fortress-flicker">
        <path d={`M${x} ${y - 4} q-3.5 -4 0 -10 q3.5 6 0 10 Z`} fill="#ff9a2e" />
        <path d={`M${x} ${y - 4} q-1.5 -2 0 -5 q1.5 3 0 5 Z`} fill="#fff1a8" />
      </g>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Moats

/** The drawbridge over a water moat, at the foot of its tower. */
function Drawbridge({ item }: { item: PlacedTower }) {
  const { tower, x, y, w } = item;
  if (tower.moat !== "wide" && tower.moat !== "narrow") return null;
  const wide = tower.moat === "wide";
  const depth = wide ? 26 : 12;
  const bw = wide ? 24 : 16;
  const cx = x + w / 2;
  return (
    <g>
      <rect x={cx - bw / 2} y={y - 2} width={bw} height={depth + 5} fill="#7a5128" stroke="#2a1a0b" strokeOpacity={0.7} />
      <rect x={cx - bw / 2} y={y - 2} width={bw} height={depth + 5} fill="url(#fs-planks)" />
      <rect x={cx - bw / 2} y={y - 2} width={bw} height={depth + 5} fill="url(#fs-shade-flat)" />
      {wide && (
        <path d={`M${cx - bw / 2 + 2} ${y - 18} L${cx - bw / 2 + 2} ${y + depth} M${cx + bw / 2 - 2} ${y - 18} L${cx + bw / 2 - 2} ${y + depth}`} stroke="#2a2724" strokeWidth={1} strokeDasharray="2 1.5" />
      )}
    </g>
  );
}

/** One stretch of the moat, as a single ribbon: its depth steps from tower to
 * tower, because each tower's own moat tier decides its stretch. */
function ribbonPath(run: MoatRun): string {
  const top = run.y + 2;
  const segs = run.segs;
  const n = segs.length;
  const bottom = segs.map((sg) => top + Math.max(5, sg.depth));
  let d = `M${run.x0} ${top} H${run.x1}`;
  d += ` Q${run.x1 + 3} ${top + (bottom[n - 1] - top) / 2} ${run.x1 - 6} ${bottom[n - 1]}`;
  for (let i = n - 1; i >= 0; i -= 1) {
    d += ` L${segs[i].x0 + 6} ${bottom[i]}`;
    if (i > 0) {
      const a = segs[i].x0 + 6;
      const b = segs[i - 1].x1 - 6;
      const mid = (a + b) / 2;
      d += ` C${mid} ${bottom[i]} ${mid} ${bottom[i - 1]} ${b} ${bottom[i - 1]}`;
    }
  }
  d += ` Q${run.x0 - 3} ${top + (bottom[0] - top) / 2} ${run.x0} ${top} Z`;
  return d;
}

function MoatRuns({ runs }: { runs: MoatRun[] }) {
  return (
    <g aria-hidden>
      {runs.map((run, i) => {
        if (run.kind === "plain") return null;
        const d = ribbonPath(run);
        if (run.kind === "fog") {
          return <path key={i} d={d} fill="none" stroke="#c9d6ea" strokeOpacity={0.6} strokeDasharray="2 4" />;
        }
        if (run.kind === "dry") {
          return (
            <g key={i}>
              <path d={d} fill="#6b5538" stroke="#b59a6a" strokeOpacity={0.75} strokeWidth={1.4} />
              <path d={d} fill="url(#fs-shade-flat)" opacity={0.45} />
              <path d={`M${run.x0 + 4} ${run.y + 2} H${run.x1 - 4}`} stroke="#d8c08a" strokeOpacity={0.6} strokeDasharray="4 3" />
              {run.segs.flatMap((sg) =>
                [0.2, 0.5, 0.8].map((f) => (
                  <ellipse key={`${sg.holdingId}-${f}`} cx={sg.x0 + (sg.x1 - sg.x0) * f} cy={run.y + 7} rx={2.5} ry={1.5} fill="#7a6a52" />
                )),
              )}
            </g>
          );
        }
        return (
          <g key={i}>
            <path d={d} fill="#4a4136" />
            <path d={d} transform="translate(0 1)" fill="url(#fs-water)" stroke="#8f8573" strokeWidth={2.4} />
            {run.segs.map((sg) => (
              <path
                key={sg.holdingId}
                className="fortress-shimmer"
                d={`M${sg.x0 + 12} ${run.y + 2 + sg.depth * 0.45} H${sg.x1 - 12}`}
                stroke="#d8f0ff"
                strokeOpacity={0.55}
                strokeWidth={1.3}
                strokeLinecap="round"
                strokeDasharray="6 9"
              />
            ))}
            <path d={`M${run.x0 + 4} ${run.y + 4} H${run.x1 - 4}`} stroke="#000" strokeOpacity={0.35} strokeWidth={2} />
          </g>
        );
      })}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Buildings

function Keep({ item }: { item: PlacedTower }) {
  const { tower, x, y, w, h } = item;
  const top = y - h;
  const cx = x + w / 2;
  const mat = MATERIAL[tower.wall];
  const rotted = tower.wall === "rotted";
  const lit = tower.freshness === "fresh";
  const someLit = tower.freshness === "fresh" || tower.freshness === "weathered";
  const roofH = roofHeight(w);
  const roofHalf = w * 0.44;
  const winW = Math.max(5, Math.round(w * 0.085));
  const tall = h > 100;
  const doorW = Math.max(12, Math.round(w * 0.24));
  const doorH = Math.max(18, Math.round(h * 0.28));

  if (tower.wall === "unsurveyed") return <GhostKeep item={item} />;

  const merlonCount = Math.max(3, Math.floor((w + 10) / 14));
  const stakeCount = Math.max(4, Math.floor(w / 8));
  const step = (w + 10) / merlonCount;
  const windows: [number, number][] = tall
    ? [
        [cx - w * 0.24 - winW / 2, top + h * 0.2],
        [cx + w * 0.24 - winW / 2, top + h * 0.2],
        [cx - winW / 2, top + h * 0.42],
      ]
    : [
        [cx - w * 0.22 - winW / 2, top + h * 0.22],
        [cx + w * 0.22 - winW / 2, top + h * 0.22],
      ];

  return (
    <g transform={rotted ? `rotate(-2.5 ${cx} ${y})` : undefined}>
      <ConeRoof
        cx={cx}
        base={top - 6}
        half={roofHalf}
        height={roofH}
        fill={mat.roof}
        trim={mat.trim}
        tiles={mat.stone ? "fs-tiles" : "fs-straw"}
        broken={rotted}
      />
      {lit && <Banner x={cx} y={top - 6 - roofH - 9} />}

      <g filter="url(#fs-grain)">
        {/* body */}
        <rect x={x} y={top} width={w} height={h} fill={mat.base} />
        <rect x={x} y={top} width={w} height={h} fill={`url(#${mat.pattern})`} />
        {mat.stone ? (
          <>
            {/* corner quoins */}
            {Array.from({ length: Math.floor(h / 14) }, (_, i) => (
              <g key={i}>
                <rect x={x} y={top + i * 14 + 1} width={i % 2 ? 7 : 11} height={12} fill="#fff" opacity={0.07} />
                <rect x={x + w - (i % 2 ? 7 : 11)} y={top + i * 14 + 1} width={i % 2 ? 7 : 11} height={12} fill="#000" opacity={0.1} />
              </g>
            ))}
          </>
        ) : (
          <>
            <rect x={x} y={top + h * 0.3} width={w} height={3} fill="#2b2622" opacity={0.85} />
            <rect x={x} y={top + h * 0.68} width={w} height={3} fill="#2b2622" opacity={0.85} />
          </>
        )}
        <rect x={x} y={top} width={w} height={h} fill="url(#fs-shade-flat)" />
        <rect x={x} y={top} width={w} height={h} fill="url(#fs-rim)" />
        <rect x={x} y={top} width={w} height={h} fill="url(#fs-ao)" />

        {/* parapet: cornice with corbels, then merlons (stone) or stakes (wood) */}
        {mat.stone ? (
          <g>
            {Array.from({ length: Math.floor(w / 9) }, (_, i) => (
              <path key={i} d={`M${x + 2 + i * 9} ${top + 1} q3.5 6 7 0`} fill={mat.dark} />
            ))}
            <rect x={x - 5} y={top - 7} width={w + 10} height={8} fill={mat.base} />
            <rect x={x - 5} y={top - 7} width={w + 10} height={8} fill="url(#fs-shade-flat)" />
            <rect x={x - 5} y={top - 7} width={w + 10} height={1.5} fill="#fff" opacity={0.25} />
            <rect x={x - 5} y={top} width={w + 10} height={1.5} fill="#000" opacity={0.4} />
            {Array.from({ length: merlonCount }, (_, i) => {
              if (rotted && i % 3 === 1) return null;
              const mx = x - 5 + i * step + 2;
              const mw = Math.max(6, step - 5);
              return (
                <g key={i}>
                  <rect x={mx} y={top - 18} width={mw} height={11} fill={mat.base} />
                  <rect x={mx} y={top - 18} width={mw} height={11} fill={`url(#${mat.pattern})`} opacity={0.6} />
                  <rect x={mx} y={top - 18} width={mw} height={1.6} fill="#fff" opacity={0.28} />
                  <rect x={mx + mw - 2} y={top - 18} width={2} height={11} fill="#000" opacity={0.3} />
                </g>
              );
            })}
          </g>
        ) : (
          <g>
            <rect x={x - 3} y={top - 5} width={w + 6} height={6} fill={mat.dark} />
            {Array.from({ length: stakeCount }, (_, i) => {
              if (rotted && i % 3 === 2) return null;
              const sw = (w + 6) / stakeCount;
              const sx = x - 3 + i * sw;
              const tipY = top - 16 + (rotted ? (i % 2) * 5 : 0);
              return (
                <path
                  key={i}
                  d={`M${sx} ${top - 5} V${top - 11} L${sx + sw / 2} ${tipY} L${sx + sw} ${top - 11} V${top - 5} Z`}
                  fill={mat.base}
                  stroke="#1a0f05"
                  strokeOpacity={0.6}
                  strokeWidth={0.8}
                />
              );
            })}
          </g>
        )}

        {windows.map(([wx, wy], i) => (
          <ArchWindow key={i} x={wx} y={wy} w={winW} lit={lit || (someLit && i === 0)} />
        ))}
        <Door cx={cx} y={y - 1} w={doorW} h={doorH} frame={mat.dark} />
        {/* footing */}
        <rect x={x - 4} y={y - 8} width={w + 8} height={8} fill={mat.dark} />
        <rect x={x - 4} y={y - 8} width={w + 8} height={1.4} fill="#fff" opacity={0.18} />

        {rotted && (
          <path
            d={`M${x + w * 0.2} ${top + 4} l8 18 l-6 12 l9 22 M${x + w * 0.74} ${top + 10} l-7 16 l6 14 l-4 10`}
            stroke="#0d0905"
            strokeWidth={2.2}
            fill="none"
          />
        )}
      </g>
      {lit && w >= 80 && (
        <>
          <Torch x={cx - doorW / 2 - 8} y={y - doorH * 0.7} />
          <Torch x={cx + doorW / 2 + 8} y={y - doorH * 0.7} />
        </>
      )}
    </g>
  );
}

/** Walls not surveyed: a translucent building plan with stakes and rope,
 * like a site marked out but never built. Never a guessed material. */
function GhostKeep({ item }: { item: PlacedTower }) {
  const { x, y, w, h } = item;
  const top = y - h;
  const cx = x + w / 2;
  const roofH = roofHeight(w);
  return (
    <g>
      <path
        d={`M${x} ${y} V${top} H${cx - w * 0.34} L${cx} ${top - roofH * 0.8} L${cx + w * 0.34} ${top} H${x + w} V${y} Z`}
        fill="#a9c8f5"
        fillOpacity={0.1}
        stroke="#a9c8f5"
        strokeOpacity={0.7}
        strokeDasharray="5 4"
      />
      {[x, x + w].map((sx) => (
        <g key={sx}>
          <line x1={sx} y1={y + 2} x2={sx} y2={y - 22} stroke="#a07a44" strokeWidth={3} />
          <path d={`M${sx - 2} ${y - 22} l2 -4 l2 4 Z`} fill="#a07a44" />
        </g>
      ))}
      <path d={`M${x} ${y - 18} Q${cx} ${y - 10} ${x + w} ${y - 18}`} stroke="#d8c08a" strokeOpacity={0.8} fill="none" />
      <text x={cx} y={top + h / 2 + 10} textAnchor="middle" fontSize={30} fontFamily={SERIF} fill="#cfe0fa" opacity={0.9}>
        ?
      </text>
    </g>
  );
}

/** A fund: an allied round tower with a green roof. No balance sheet, so no wall material. */
function Outpost({ item }: { item: PlacedTower }) {
  const { tower, x, y, w, h } = item;
  const bw = Math.round(w * 0.68);
  const bx = x + (w - bw) / 2;
  const cx = x + w / 2;
  const top = y - h;
  const lit = tower.freshness === "fresh";
  const roofH = Math.round(w * 0.5) - 8;
  return (
    <g>
      <ConeRoof cx={cx} base={top - 2} half={bw / 2 + 9} height={roofH} fill="fs-roof-ally" trim="url(#fs-gold)" />
      {lit && <Banner x={cx} y={top - 2 - roofH - 9} color="#2f7a3e" />}
      <g filter="url(#fs-grain)">
        <rect x={bx} y={top} width={bw} height={h} fill="#8e939b" />
        <rect x={bx} y={top} width={bw} height={h} fill="url(#fs-granite)" />
        <rect x={bx} y={top} width={bw} height={h} fill="url(#fs-shade-round)" />
        <rect x={bx} y={top} width={bw} height={h} fill="url(#fs-ao)" />
        <rect x={bx - 3} y={top - 2} width={bw + 6} height={7} fill="#6b4a26" />
        <rect x={bx - 3} y={top - 2} width={bw + 6} height={7} fill="url(#fs-shade-round)" />
        <ArchWindow x={cx - 3} y={top + h * 0.2} w={6} lit={lit} />
        <Door cx={cx} y={y - 1} w={Math.max(10, bw * 0.34)} h={Math.max(16, h * 0.36)} frame="#4b5058" />
      </g>
    </g>
  );
}

/** Physical gold: a gold mine in a rocky hill, nuggets glinting. */
function Bullion({ item }: { item: PlacedTower }) {
  const { x, y, w, h } = item;
  const cx = x + w / 2;
  const mound = `M${x - 4} ${y} C${x + w * 0.04} ${y - h * 0.75} ${x + w * 0.28} ${y - h * 1.02} ${cx} ${y - h} C${x + w * 0.74} ${y - h * 0.98} ${x + w * 0.98} ${y - h * 0.62} ${x + w + 4} ${y} Z`;
  const nuggets: [number, number][] = [[0.22, 0.55], [0.7, 0.42], [0.82, 0.7], [0.36, 0.3], [0.58, 0.78]];
  return (
    <g>
      <g filter="url(#fs-grain)">
        <path d={mound} fill="url(#fs-rock)" />
        <path d={mound} fill="url(#fs-rim)" />
        <path d={`M${x + w * 0.2} ${y - h * 0.5} l10 6 M${x + w * 0.66} ${y - h * 0.6} l8 -4 l6 6`} stroke="#000" strokeOpacity={0.35} fill="none" />
      </g>
      {nuggets.map(([fx, fy], i) => (
        <path
          key={i}
          d={`M${x + w * fx} ${y - h * fy} l3 -3 l4 1 l1 4 l-4 2 l-4 -1 Z`}
          fill="url(#fs-gold)"
          stroke="#7a5310"
          strokeWidth={0.6}
        />
      ))}
      {/* timber-framed entrance with a warm glow */}
      <circle cx={cx} cy={y - h * 0.25} r={w * 0.3} fill="url(#fs-mine-glow)" />
      <path d={`M${cx - w * 0.17} ${y} V${y - h * 0.48} H${cx + w * 0.17} V${y} Z`} fill="#140d06" />
      <rect x={cx - w * 0.2} y={y - h * 0.52} width={w * 0.4} height={5} fill="#6b4a26" stroke="#2a1a0b" strokeWidth={0.6} />
      <rect x={cx - w * 0.2} y={y - h * 0.5} width={4} height={h * 0.5} fill="#6b4a26" />
      <rect x={cx + w * 0.2 - 4} y={y - h * 0.5} width={4} height={h * 0.5} fill="#6b4a26" />
      <ellipse cx={cx} cy={y - 3} rx={w * 0.14} ry={4} fill="url(#fs-gold)" />
      {[[0.3, 0.62], [0.74, 0.46], [0.5, 0.86]].map(([fx, fy], i) => (
        <path
          key={i}
          className="fortress-twinkle"
          style={{ animationDelay: `${i * 700}ms` }}
          d={`M${x + w * fx} ${y - h * fy - 5} l1.2 3.8 l3.8 1.2 l-3.8 1.2 l-1.2 3.8 l-1.2 -3.8 l-3.8 -1.2 l3.8 -1.2 Z`}
          fill="#fffbe0"
        />
      ))}
    </g>
  );
}

/** A cash-like fund: a farmstead granary with a thatched roof. */
function Granary({ item }: { item: PlacedTower }) {
  const { x, y, w, h } = item;
  const cx = x + w / 2;
  const bx = x + 7;
  const bw = w - 14;
  const top = y - h;
  const roofH = Math.round(w * 0.42);
  return (
    <g>
      <g filter="url(#fs-grain)">
        <rect x={bx} y={top} width={bw} height={h} fill="#9b7444" />
        <rect x={bx} y={top} width={bw} height={h} fill="url(#fs-planks)" />
        <rect x={bx} y={top + h * 0.3} width={bw} height={3} fill="#3a2a1a" />
        <rect x={bx} y={top + h * 0.66} width={bw} height={3} fill="#3a2a1a" />
        <rect x={bx} y={top} width={bw} height={h} fill="url(#fs-shade-round)" />
        <rect x={bx} y={top} width={bw} height={h} fill="url(#fs-ao)" />
        <Door cx={cx} y={y - 1} w={Math.max(10, bw * 0.3)} h={Math.max(14, h * 0.32)} frame="#4a331b" />
      </g>
      <ConeRoof cx={cx} base={top + 2} half={bw / 2 + 10} height={roofH} fill="fs-roof-thatch" trim="#7a5a24" tiles="fs-straw" />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Overlays: age, thesis, siege

function Ivy({ x, y, top, w, heavy }: { x: number; y: number; top: number; w: number; heavy: boolean }) {
  const h = y - top;
  const vines: [number, number][] = heavy
    ? [[0.08, 0.15], [0.3, 0.45], [0.86, 0.1], [0.62, 0.55], [0.95, 0.4]]
    : [[0.1, 0.55], [0.88, 0.7]];
  return (
    <g aria-hidden>
      {vines.map(([fx, reach], i) => {
        const vx = x + w * fx;
        const endY = top + h * reach;
        const d = `M${vx} ${y} C${vx + 6} ${y - h * 0.25} ${vx - 6} ${endY + h * 0.2} ${vx + 2} ${endY}`;
        return (
          <g key={i}>
            <path d={d} stroke="#2a4a22" strokeWidth={1.6} fill="none" />
            {Array.from({ length: heavy ? 7 : 5 }, (_, k) => {
              const t = (k + 1) / (heavy ? 8 : 6);
              const ly = y - (y - endY) * t;
              const lx = vx + Math.sin(k * 1.7 + i) * 4;
              return (
                <g key={k}>
                  <ellipse cx={lx - 2} cy={ly} rx={3.6} ry={2.4} fill="#3f7a35" transform={`rotate(${-30 + k * 13} ${lx} ${ly})`} />
                  <ellipse cx={lx + 2.5} cy={ly - 2} rx={3} ry={2} fill="#5f9a45" transform={`rotate(${20 - k * 9} ${lx} ${ly})`} />
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

function Scaffolding({ x, y, top, w }: { x: number; y: number; top: number; w: number }) {
  const levels = [top + 6, top + (y - top) * 0.45, y - 14];
  return (
    <g aria-hidden stroke="#a07a44" strokeWidth={2} strokeLinecap="round">
      <line x1={x - 7} y1={y} x2={x - 7} y2={top - 4} />
      <line x1={x + w + 7} y1={y} x2={x + w + 7} y2={top - 4} />
      {levels.map((ly) => (
        <g key={ly}>
          <line x1={x - 10} y1={ly} x2={x + w + 10} y2={ly} stroke="#8a6438" strokeWidth={3} />
          <line x1={x - 10} y1={ly + 1.5} x2={x + w + 10} y2={ly + 1.5} stroke="#3a2510" strokeWidth={0.8} />
        </g>
      ))}
      <line x1={x - 7} y1={levels[2]} x2={x + w * 0.4} y2={levels[1]} strokeWidth={1.3} />
      <line x1={x + w + 7} y1={levels[1]} x2={x + w * 0.6} y2={levels[0]} strokeWidth={1.3} />
    </g>
  );
}

function Weathering({ item }: { item: PlacedTower }) {
  const { tower, x, y, w, h } = item;
  const top = y - h;
  if (tower.freshness === "weathered" || tower.freshness === "overgrown") {
    const heavy = tower.freshness === "overgrown";
    return (
      <g>
        <Ivy x={x} y={y} top={top} w={w} heavy={heavy} />
        {heavy && <Scaffolding x={x} y={y} top={top} w={w} />}
      </g>
    );
  }
  if (tower.freshness === "unsurveyed" && tower.wall !== "unsurveyed") {
    return (
      <g aria-hidden filter="url(#fs-blur-lg)">
        <ellipse cx={x + w / 2} cy={top + h * 0.35} rx={w * 0.75} ry={h * 0.32} fill="#dbe4f2" opacity={0.28} />
        <ellipse cx={x + w / 2} cy={y - 6} rx={w * 0.9} ry={14} fill="#dbe4f2" opacity={0.3} />
      </g>
    );
  }
  return null;
}

/** A signpost in the gap beside the tower, from the stored margin-of-safety
 * zone: gold SALE below the bear case, OFFER below the base case, a red DEAR
 * above the bull case. No sign when fully priced or when the price is fog. */
function LandSign({ item }: { item: PlacedTower }) {
  const text = landSignText(item.tower.land);
  if (text === null) return null;
  const { x, y, w } = item;
  const px = x + w + 13;
  const land = item.tower.land;
  const board = land === "overpriced" ? "#8e2a22" : land === "bargain" ? "url(#fs-gold)" : "#7a4f24";
  const ink = land === "overpriced" ? "#ffe6d2" : land === "bargain" ? "#2a1a04" : "#ffd98a";
  return (
    <g aria-hidden>
      <rect x={px - 1.5} y={y - 36} width={3} height={38} fill="#4a3018" />
      <rect x={px - 1.5} y={y - 36} width={1} height={38} fill="#fff" opacity={0.15} />
      <rect x={px - 13} y={y - 36} width={14} height={2.5} fill="#4a3018" />
      <line x1={px - 11} y1={y - 34} x2={px - 11} y2={y - 30} stroke="#2a2420" />
      <line x1={px + 11} y1={y - 36} x2={px + 11} y2={y - 30} stroke="#2a2420" />
      <line x1={px} y1={y - 36} x2={px + 12} y2={y - 36} stroke="#4a3018" strokeWidth={2.5} />
      <g transform={`rotate(-3 ${px} ${y - 24})`}>
        <rect x={px - 17} y={y - 31} width={34} height={14} rx={1.5} fill={board} stroke="#2a1a08" strokeWidth={1} />
        <rect x={px - 17} y={y - 31} width={34} height={2} fill="#fff" opacity={0.2} />
        <text x={px} y={y - 20.6} textAnchor="middle" fontSize={8.5} fontFamily={SERIF} fontWeight={700} letterSpacing={0.6} fill={ink}>
          {text}
        </text>
      </g>
    </g>
  );
}

function Flames({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    // The SVG transform sits on the outer group: a CSS animation on the same
    // element would replace it and throw the flames to the origin.
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <g className="fortress-flicker">
        <path d="M0 0 q-9 -10 -3 -22 q2 8 6 4 q1 -10 -2 -16 q12 10 7 26 q3 -4 3 -8 q6 10 -3 16 Z" fill="#ff6a1f" />
        <path d="M1 -1 q-5 -6 -1 -13 q2 5 4 3 q3 6 -3 10 Z" fill="#ffd36a" />
      </g>
    </g>
  );
}

/** A fired tripwire sets the tower alight and breaches the wall; a thesis
 * flagged for review is an amber notice. Both carry a symbol, so colour is
 * never the only cue. */
function ThesisMarks({ item }: { item: PlacedTower }) {
  const { tower, x, y, w, h } = item;
  if (tower.thesis !== "breached" && tower.thesis !== "review") return null;
  const top = y - h;
  const bx = x + w + 2;
  const by = top - 20;
  if (tower.thesis === "review") {
    return (
      <g aria-hidden className="fortress-bob">
        <circle cx={bx} cy={by} r={13} fill="url(#fs-glow)" />
        <circle cx={bx} cy={by} r={9.5} fill="#1b1206" stroke="url(#fs-gold)" strokeWidth={2} />
        <circle cx={bx} cy={by} r={7} fill="#e0a526" />
        <text x={bx} y={by + 4.5} textAnchor="middle" fontSize={12} fontFamily={SERIF} fontWeight={700} fill="#2b1a03">
          i
        </text>
      </g>
    );
  }
  const gapX = x + w * 0.58;
  return (
    <g aria-hidden>
      {/* the breach */}
      <path
        d={`M${gapX} ${top + h * 0.2} l9 8 l-5 7 l8 9 l-6 8 l5 10 l-14 0 l-3 -12 l6 -8 l-7 -9 Z`}
        fill="#0b0705"
        stroke="#ff7a3a"
        strokeOpacity={0.85}
        strokeWidth={1.3}
      />
      {[[3, 5, 9], [w - 14, 7, 11], [w * 0.35, 4, 7]].map(([dx, hh, ww], i) => (
        <rect key={i} x={x + dx} y={y - hh} width={ww} height={hh} fill={i === 1 ? "#6b6155" : "#5c5348"} stroke="#000" strokeOpacity={0.4} />
      ))}
      {/* fire and smoke on the parapet */}
      <circle cx={x + w * 0.45} cy={top - 6} r={w * 0.5} fill="url(#fs-fire-glow)" opacity={0.7} />
      <path
        className="fortress-smoke"
        d={`M${x + w * 0.4} ${top - 20} q-10 -14 4 -28 q12 -12 -2 -30`}
        stroke="#1b1716"
        strokeOpacity={0.55}
        strokeWidth={9}
        strokeLinecap="round"
        fill="none"
        filter="url(#fs-blur)"
      />
      <Flames x={x + w * 0.28} y={top - 8} />
      <Flames x={x + w * 0.62} y={top - 6} scale={0.8} />
      {/* marker */}
      <g className="fortress-bob">
        <circle cx={bx} cy={by} r={14} fill="url(#fs-fire-glow)" />
        <circle cx={bx} cy={by} r={10} fill="#1b0606" stroke="url(#fs-gold)" strokeWidth={2} />
        <circle cx={bx} cy={by} r={7.5} fill="#c7281e" />
        <text x={bx} y={by + 5} textAnchor="middle" fontSize={13} fontFamily={SERIF} fontWeight={800} fill="#fff">
          !
        </text>
      </g>
    </g>
  );
}

/** Siege ladders against the wall, only while the weather is gathering or
 * worse and only for towers the stored stress scenario hits hard. */
function Ladders({ item, level }: { item: PlacedTower; level: FortressSiegeLevel | null }) {
  const count = ladderCount(item.tower.siege_exposure, level);
  if (count === 0) return null;
  const { x, y, w, h } = item;
  const top = y - h;
  const ladder = (side: 1 | -1) => {
    const baseX = side === 1 ? x + w + 11 : x - 11;
    const topX = side === 1 ? x + w - 1 : x + 1;
    const topY = top + h * 0.18;
    const rungs = [0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((t) => ({
      cx: baseX + (topX - baseX) * t,
      cy: y + (topY - y) * t,
    }));
    return (
      <g key={side} strokeLinecap="round">
        <line x1={baseX - 3} y1={y} x2={topX - 3} y2={topY} stroke="#2a1a0b" strokeWidth={3.2} />
        <line x1={baseX + 3} y1={y} x2={topX + 3} y2={topY} stroke="#2a1a0b" strokeWidth={3.2} />
        <line x1={baseX - 3} y1={y} x2={topX - 3} y2={topY} stroke="#a57a42" strokeWidth={1.8} />
        <line x1={baseX + 3} y1={y} x2={topX + 3} y2={topY} stroke="#a57a42" strokeWidth={1.8} />
        {rungs.map((r, i) => (
          <line key={i} x1={r.cx - 3.5} y1={r.cy} x2={r.cx + 3.5} y2={r.cy} stroke="#8a6438" strokeWidth={1.6} />
        ))}
      </g>
    );
  };
  return <g aria-hidden>{count === 2 ? [ladder(1), ladder(-1)] : ladder(1)}</g>;
}

/** A cracked curtain wall joining two towers that move together (a stored
 * correlation flag): when one falls the other is hit by the same blow. */
function SharedWalls({ layout, siege, row }: { layout: FortressLayout; siege: GameSiege | null; row: number }) {
  if (!siege || siege.shared_walls.length === 0) return null;
  const byId = new Map(layout.items.map((i) => [i.tower.holding_id, i]));
  return (
    <g aria-hidden>
      {sharedWallLinks(layout.items, siege.shared_walls, layout.keep).map((link) => {
        const a = byId.get(link.fromId);
        const b = byId.get(link.toId);
        if (!a || !b || a.row !== row) return null;
        const x1 = a.x + a.w - 2;
        const x2 = b.x + 2;
        const y = a.y;
        const mid = (x1 + x2) / 2;
        const top = y - CURTAIN_HEIGHT;
        const n = Math.max(1, Math.floor((x2 - x1) / 9));
        return (
          <g key={`${link.fromId}-${link.toId}`}>
            <g filter="url(#fs-grain)">
              <rect x={x1} y={top} width={x2 - x1} height={CURTAIN_HEIGHT} fill="#7a7468" />
              <rect x={x1} y={top} width={x2 - x1} height={CURTAIN_HEIGHT} fill="url(#fs-granite)" />
              <rect x={x1} y={top} width={x2 - x1} height={CURTAIN_HEIGHT} fill="url(#fs-ao)" />
              {Array.from({ length: n }, (_, i) =>
                i % 2 === 0 ? <rect key={i} x={x1 + i * 9} y={top - 7} width={7} height={7} fill="#7a7468" /> : null,
              )}
            </g>
            <path d={`M${mid - 3} ${top} l6 12 l-7 9 l7 11 l-4 16`} stroke="#ff6a3a" strokeWidth={3.5} strokeOpacity={0.35} fill="none" filter="url(#fs-blur)" />
            <path d={`M${mid - 3} ${top} l6 12 l-7 9 l7 11 l-4 16`} stroke="#120a06" strokeWidth={2} fill="none" />
            <path d={`M${mid - 3} ${top} l6 12 l-7 9 l7 11 l-4 16`} stroke="#ff7a3a" strokeWidth={0.8} fill="none" />
          </g>
        );
      })}
    </g>
  );
}

// ---------------------------------------------------------------------------
// The fortress as one structure: curtain walls, corner bastions, the Great Keep.
// These stand for the WHOLE portfolio: pressing any of them opens the verdict
// on everything, while pressing a tower opens that one holding.

export interface RealmState {
  hot: boolean;
  selected: boolean;
}

interface RealmHandlers {
  realm: RealmState;
  onRealmSelect: () => void;
  onRealmHover: (on: boolean) => void;
}

const TONE_BANNER: Record<RealmLevel, string> = {
  sound: "#2c55b5",
  mixed: "#c58a1a",
  attention: "#b3261e",
  unknown: "#6b7a90",
};

/** A pointer-only group: the keep is the keyboard-focusable way in, the walls
 * and bastions just make the whole structure clickable. */
function RealmPart({ realm, onRealmSelect, onRealmHover, children }: RealmHandlers & { children: React.ReactNode }) {
  return (
    <g
      aria-hidden
      className={`fortress-realm-part${realm.hot ? " is-hot" : ""}${realm.selected ? " is-selected" : ""}`}
      onClick={onRealmSelect}
      onMouseEnter={() => onRealmHover(true)}
      onMouseLeave={() => onRealmHover(false)}
    >
      {children}
    </g>
  );
}

/** Crenellations along a wall top: merlons in the wall's own stone. */
function Crenels({ x, top, w, step = 18, mw = 11, mh = 10, base = "#8a909a", pattern = "fs-granite" }: { x: number; top: number; w: number; step?: number; mw?: number; mh?: number; base?: string; pattern?: string }) {
  const n = Math.max(1, Math.floor((w - mw) / step) + 1);
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const mx = x + 2 + i * step;
        return (
          <g key={i}>
            <rect x={mx} y={top - mh} width={mw} height={mh + 1} fill={base} />
            <rect x={mx} y={top - mh} width={mw} height={mh + 1} fill={`url(#${pattern})`} opacity={0.6} />
            <rect x={mx} y={top - mh} width={mw} height={1.5} fill="#fff" opacity={0.28} />
            <rect x={mx + mw - 2} y={top - mh} width={2} height={mh + 1} fill="#000" opacity={0.3} />
          </g>
        );
      })}
    </g>
  );
}

/** The curtain wall that joins every tower of a row into one rampart. */
function CurtainWall({ row, ...handlers }: { row: number } & RealmHandlers) {
  const y = groundY(row);
  const x0 = WALL_EDGE;
  const w = SCENE_WIDTH - WALL_EDGE * 2;
  const top = y - CURTAIN_HEIGHT;
  return (
    <RealmPart {...handlers}>
      <g filter="url(#fs-grain)">
        <rect x={x0} y={top} width={w} height={CURTAIN_HEIGHT} fill="#858a93" />
        <rect x={x0} y={top} width={w} height={CURTAIN_HEIGHT} fill="url(#fs-granite)" />
        <rect x={x0} y={top} width={w} height={CURTAIN_HEIGHT} fill="url(#fs-shade-flat)" />
        <rect x={x0} y={top} width={w} height={CURTAIN_HEIGHT} fill="url(#fs-ao)" />
        <Crenels x={x0} top={top} w={w} />
        <rect x={x0} y={top} width={w} height={3} fill="#fff" opacity={0.18} />
        <rect x={x0} y={top + 6} width={w} height={2} fill="#000" opacity={0.25} />
        {Array.from({ length: Math.floor(w / 96) }, (_, i) => (
          <rect key={i} x={x0 + 40 + i * 96} y={top + 18} width={4} height={14} rx={1.5} fill="#10131a" opacity={0.85} />
        ))}
        <rect x={x0} y={y - 7} width={w} height={7} fill="#585d66" />
        <rect x={x0} y={y - 7} width={w} height={1.4} fill="#fff" opacity={0.18} />
      </g>
    </RealmPart>
  );
}

/** A round corner bastion at each end of a curtain wall. */
function Bastion({ x, y, ...handlers }: { x: number; y: number } & RealmHandlers) {
  const w = 46;
  const h = 86;
  const top = y - h;
  const cx = x + w / 2;
  return (
    <RealmPart {...handlers}>
      <GroundShadow x={x} y={y} w={w} />
      <ConeRoof cx={cx} base={top - 7} half={w / 2 + 6} height={38} fill="fs-roof-slate" trim="url(#fs-gold)" />
      <g filter="url(#fs-grain)">
        <rect x={x} y={top} width={w} height={h} fill="#8a909a" />
        <rect x={x} y={top} width={w} height={h} fill="url(#fs-granite)" />
        <rect x={x} y={top} width={w} height={h} fill="url(#fs-shade-round)" />
        <rect x={x} y={top} width={w} height={h} fill="url(#fs-ao)" />
        <rect x={x - 4} y={top - 7} width={w + 8} height={8} fill="#8a909a" />
        <rect x={x - 4} y={top - 7} width={w + 8} height={8} fill="url(#fs-shade-round)" />
        <rect x={x - 4} y={top - 7} width={w + 8} height={1.5} fill="#fff" opacity={0.25} />
        <rect x={cx - 3} y={top + 22} width={6} height={20} rx={3} fill="#10131a" opacity={0.9} />
        <rect x={cx - 3} y={top + 54} width={6} height={14} rx={3} fill="#10131a" opacity={0.9} />
        <rect x={x - 3} y={y - 8} width={w + 6} height={8} fill="#585d66" />
      </g>
    </RealmPart>
  );
}

/** Stone forecourt in front of the keep, where the moat gives way to a causeway. */
function Causeway({ keep }: { keep: PlacedKeep }) {
  const { x, y, w } = keep;
  const cx = x + w / 2;
  return (
    <g aria-hidden>
      <path d={`M${x - 12} ${y + 2} H${x + w + 12} L${x + w + 4} ${y + 34} H${x - 4} Z`} fill="#6f6a5e" />
      <path d={`M${x - 12} ${y + 2} H${x + w + 12} L${x + w + 4} ${y + 34} H${x - 4} Z`} fill="url(#fs-granite)" opacity={0.7} />
      <path d={`M${x - 12} ${y + 2} H${x + w + 12} L${x + w + 4} ${y + 34} H${x - 4} Z`} fill="url(#fs-shade-flat)" />
      {[10, 20, 30].map((dy) => (
        <path key={dy} d={`M${x - 12 + dy * 0.26} ${y + dy} H${x + w + 12 - dy * 0.26}`} stroke="#000" strokeOpacity={0.3} />
      ))}
      <rect x={cx - 34} y={y + 2} width={68} height={32} fill="#a89f8c" opacity={0.55} />
      <path d={`M${cx - 34} ${y + 2} V${y + 34} M${cx + 34} ${y + 2} V${y + 34}`} stroke="#3a342a" strokeOpacity={0.6} />
    </g>
  );
}

/** The Great Keep: the whole portfolio, in the middle of the top terrace. It
 * has no wall material, moat or size of its own (those belong to the towers);
 * the banner on its roof only follows the verdict on the whole fortress. */
function GreatKeep({
  keep,
  level,
  lit,
  count,
  realm,
  onRealmSelect,
  onRealmHover,
}: { keep: PlacedKeep; level: RealmLevel; lit: boolean; count: number } & RealmHandlers) {
  const { x, y, w } = keep;
  const cx = x + w / 2;
  const hallW = 150;
  const hallH = 96;
  const hallX = cx - hallW / 2;
  const hallTop = y - hallH;
  const donW = 80;
  const donH = 178;
  const donX = cx - donW / 2;
  const donTop = y - donH;
  const donRoof = 60;
  const turW = 34;
  const turH = 132;
  const turTop = y - turH;
  const base = "#9097a1";
  const dark = "#585d66";
  const onKey = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onRealmSelect();
    }
  };
  const turret = (tx: number) => (
    <g key={tx}>
      <ConeRoof cx={tx + turW / 2} base={turTop - 6} half={turW / 2 + 7} height={44} fill="fs-roof-slate" trim="url(#fs-gold)" />
      <g filter="url(#fs-grain)">
        <rect x={tx} y={turTop} width={turW} height={turH} fill={base} />
        <rect x={tx} y={turTop} width={turW} height={turH} fill="url(#fs-granite)" />
        <rect x={tx} y={turTop} width={turW} height={turH} fill="url(#fs-shade-round)" />
        <rect x={tx} y={turTop} width={turW} height={turH} fill="url(#fs-ao)" />
        <rect x={tx - 4} y={turTop - 7} width={turW + 8} height={8} fill={base} />
        <rect x={tx - 4} y={turTop - 7} width={turW + 8} height={1.5} fill="#fff" opacity={0.25} />
        <ArchWindow x={tx + turW / 2 - 3.5} y={turTop + 24} w={7} lit={lit} />
        <ArchWindow x={tx + turW / 2 - 3.5} y={turTop + 64} w={7} lit={lit} />
      </g>
    </g>
  );
  return (
    <g
      role="button"
      tabIndex={0}
      aria-pressed={realm.selected}
      aria-label={`The whole fortress: ${count} ${count === 1 ? "holding" : "holdings"}. Press for the summary verdict on all of them.`}
      className={`fortress-tower fortress-realm-keep${realm.selected ? " is-selected" : ""}${realm.hot ? " is-hot" : ""}`}
      onClick={onRealmSelect}
      onKeyDown={onKey}
      onMouseEnter={() => onRealmHover(true)}
      onMouseLeave={() => onRealmHover(false)}
      onFocus={() => onRealmHover(true)}
      onBlur={() => onRealmHover(false)}
    >
      <ellipse className="fortress-ring" cx={cx} cy={y + 10} rx={w / 2 + 34} ry={16} fill="none" strokeWidth={2.5} />
      <ellipse className="fortress-ring-inner" cx={cx} cy={y + 10} rx={w / 2 + 26} ry={12} fill="none" strokeWidth={1} />
      <g className="fortress-rise">
        <GroundShadow x={x} y={y} w={w} />
        {/* the donjon, behind everything else */}
        <ConeRoof cx={cx} base={donTop - 6} half={donW / 2 + 12} height={donRoof} fill="fs-roof-slate" trim="url(#fs-gold)" />
        <Banner x={cx} y={donTop - 6 - donRoof - 9} color={TONE_BANNER[level]} />
        <g filter="url(#fs-grain)">
          <rect x={donX} y={donTop} width={donW} height={donH} fill={base} />
          <rect x={donX} y={donTop} width={donW} height={donH} fill="url(#fs-granite)" />
          {Array.from({ length: Math.floor(donH / 14) }, (_, i) => (
            <g key={i}>
              <rect x={donX} y={donTop + i * 14 + 1} width={i % 2 ? 7 : 11} height={12} fill="#fff" opacity={0.07} />
              <rect x={donX + donW - (i % 2 ? 7 : 11)} y={donTop + i * 14 + 1} width={i % 2 ? 7 : 11} height={12} fill="#000" opacity={0.1} />
            </g>
          ))}
          <rect x={donX} y={donTop} width={donW} height={donH} fill="url(#fs-shade-flat)" />
          <rect x={donX} y={donTop} width={donW} height={donH} fill="url(#fs-rim)" />
          <rect x={donX} y={donTop} width={donW} height={donH} fill="url(#fs-ao)" />
          <rect x={donX - 5} y={donTop - 7} width={donW + 10} height={8} fill={base} />
          <rect x={donX - 5} y={donTop - 7} width={donW + 10} height={1.5} fill="#fff" opacity={0.25} />
          <Crenels x={donX - 5} top={donTop - 7} w={donW + 10} step={14} mw={8} mh={10} base={base} />
        </g>
        {/* a medallion with the lamp: the mark of the whole */}
        <circle cx={cx} cy={donTop + 40} r={23} fill="#d9a93e" />
        <circle cx={cx} cy={donTop + 40} r={21} fill="#111a2f" stroke="#6e4a12" strokeWidth={1} />
        <LampLogo x={cx - 17} y={donTop + 40 - 17} width={34} height={34} />
        {turret(x + 2)}
        {turret(x + w - 2 - turW)}
        {/* the great hall in front */}
        <g filter="url(#fs-grain)">
          <rect x={hallX} y={hallTop} width={hallW} height={hallH} fill={base} />
          <rect x={hallX} y={hallTop} width={hallW} height={hallH} fill="url(#fs-granite)" />
          <rect x={hallX} y={hallTop} width={hallW} height={hallH} fill="url(#fs-shade-flat)" />
          <rect x={hallX} y={hallTop} width={hallW} height={hallH} fill="url(#fs-rim)" />
          <rect x={hallX} y={hallTop} width={hallW} height={hallH} fill="url(#fs-ao)" />
          <rect x={hallX - 5} y={hallTop - 7} width={hallW + 10} height={8} fill={base} />
          <rect x={hallX - 5} y={hallTop - 7} width={hallW + 10} height={1.5} fill="#fff" opacity={0.25} />
          <Crenels x={hallX - 5} top={hallTop - 7} w={hallW + 10} base={base} />
          <ArchWindow x={hallX + 22} y={hallTop + 18} w={8} lit={lit} />
          <ArchWindow x={hallX + hallW - 30} y={hallTop + 18} w={8} lit={lit} />
          {/* gate with a portcullis */}
          <path d={`M${cx - 22} ${y - 1} V${y - 44} A22 22 0 0 1 ${cx + 22} ${y - 44} V${y - 1} Z`} fill={dark} />
          <path d={`M${cx - 17} ${y - 1} V${y - 43} A17 17 0 0 1 ${cx + 17} ${y - 43} V${y - 1} Z`} fill="#0d0f14" />
          {[-11, -4, 3, 10].map((dx) => (
            <line key={dx} x1={cx + dx} y1={y - 1} x2={cx + dx} y2={y - 50} stroke="#4a4f58" strokeWidth={2} />
          ))}
          {[12, 26, 40].map((dy) => (
            <line key={dy} x1={cx - 17} y1={y - dy} x2={cx + 17} y2={y - dy} stroke="#4a4f58" strokeWidth={2} />
          ))}
          <rect x={hallX - 4} y={y - 8} width={hallW + 8} height={8} fill={dark} />
        </g>
        {lit && (
          <>
            <Torch x={cx - 32} y={y - 30} />
            <Torch x={cx + 32} y={y - 30} />
          </>
        )}
      </g>
      {/* name plate */}
      <g>
        <path d={`M${cx - 62} ${y + 40} h124 l-5 9 l5 9 h-124 l5 -9 Z`} fill="#1a120a" fillOpacity={0.9} stroke="#b8893a" strokeOpacity={0.9} />
        <text x={cx} y={y + 53} textAnchor="middle" fontSize={11.5} fontFamily={SERIF} letterSpacing={1.4} fill="#f3e4bf">
          THE REALM
        </text>
        <text x={cx} y={y + 69} textAnchor="middle" fontSize={10} fill="#cdb98f" className="tabular">
          {count} {count === 1 ? "holding" : "holdings"}
        </text>
      </g>
      <rect x={x - 40} y={donTop - 80} width={w + 80} height={donH + 150} fill="transparent" />
    </g>
  );
}

function TowerBody({ item }: { item: PlacedTower }) {
  switch (item.tower.structure) {
    case "outpost":
      return <Outpost item={item} />;
    case "bullion":
      return <Bullion item={item} />;
    case "granary":
      return <Granary item={item} />;
    default:
      return <Keep item={item} />;
  }
}

function NamePlate({ item }: { item: PlacedTower }) {
  const { tower, x, y, w } = item;
  const cx = x + w / 2;
  const name = shortName(tower.name, w);
  const pw = Math.min(w + 22, Math.max(w * 0.7, name.length * 6.2 + 18));
  const weight = tower.weight_pct === null ? "—" : `${Number(tower.weight_pct).toFixed(1)}%`;
  const py = y + 34;
  return (
    <g>
      <path
        d={`M${cx - pw / 2} ${py} h${pw} l-4 8 l4 8 h${-pw} l4 -8 Z`}
        fill="#1a120a"
        fillOpacity={0.88}
        stroke="#b8893a"
        strokeOpacity={0.85}
        strokeWidth={1}
      />
      <path d={`M${cx - pw / 2 + 3} ${py + 2.5} h${pw - 6}`} stroke="#f2d68a" strokeOpacity={0.25} />
      <text x={cx} y={py + 11.5} textAnchor="middle" fontSize={10.5} fontFamily={SERIF} fill="#f3e4bf">
        {name}
      </text>
      <text x={cx} y={py + 29} textAnchor="middle" fontSize={10} fill="#cdb98f" className="tabular">
        {weight}
      </text>
    </g>
  );
}

function TowerFigure({
  item,
  selected,
  onSelect,
  onHover,
  level,
  raven = false,
  onNavigate,
}: {
  item: PlacedTower;
  selected: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  /** G42: an arrow key, Home or End was pressed on this tower. */
  onNavigate?: (fromId: string, key: string) => void;
  level: FortressSiegeLevel | null;
  /** G15: a report was captured for this holding and has not been seen yet. */
  raven?: boolean;
}) {
  const { tower, x, y, w, h } = item;
  const pad = 26;
  const onKey = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(tower.holding_id);
    } else if (isNavKey(e.key) && onNavigate) {
      e.preventDefault();
      onNavigate(tower.holding_id, e.key);
    }
  };
  const crown = crownY(item);
  return (
    <g
      role="button"
      tabIndex={0}
      data-tower-id={tower.holding_id}
      aria-pressed={selected}
      aria-label={`${describeTower(tower)}.${raven ? " A new report has landed." : ""} Press for details. Arrow keys move to the next tower.`}
      className={`fortress-tower${selected ? " is-selected" : ""}`}
      onClick={() => onSelect(tower.holding_id)}
      onKeyDown={onKey}
      onMouseEnter={() => onHover(tower.holding_id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(tower.holding_id)}
      onBlur={() => onHover(null)}
    >
      {/* selection ring on the ground: green when selected, gold on hover/focus */}
      <ellipse className="fortress-ring" cx={x + w / 2} cy={y + 8} rx={w / 2 + 20} ry={14} fill="none" strokeWidth={2.5} />
      <ellipse className="fortress-ring-inner" cx={x + w / 2} cy={y + 8} rx={w / 2 + 14} ry={10} fill="none" strokeWidth={1} />
      <g className="fortress-rise" style={{ animationDelay: `${item.index * 70}ms` }}>
        <GroundShadow x={x} y={y} w={w} />
        <Drawbridge item={item} />
        <TowerBody item={item} />
        <Weathering item={item} />
        <ThesisMarks item={item} />
        <Ladders item={item} level={level} />
        {raven && <RavenMark x={x + w / 2 + Math.min(18, w / 3)} y={crown + 2} />}
      </g>
      <NamePlate item={item} />
      <rect
        x={x - pad + 4}
        y={Math.min(crown, y - h) - 10}
        width={w + pad * 2 - 8}
        height={y - Math.min(crown, y - h) + 72}
        fill="transparent"
      />
    </g>
  );
}

function Shantytown({ level, count, y }: { level: FortressShantytown; count: number; y: number }) {
  const drawn = drawnShacks(count);
  if (level === "none" || drawn === 0) return null;
  const span = SCENE_WIDTH - 200;
  const step = drawn > 1 ? span / (drawn - 1) : 0;
  const label = `${level === "heavy" ? "Shantytown" : "A few shacks"}: ${count} tiny ${count === 1 ? "position" : "positions"}${
    count > drawn ? ` (${drawn} drawn)` : ""
  }`;
  return (
    <g aria-hidden>
      <ellipse cx={SCENE_WIDTH / 2} cy={y + 2} rx={span / 2 + 60} ry={16} fill="url(#fs-mud)" opacity={0.85} filter="url(#fs-grain)" />
      {Array.from({ length: drawn }, (_, i) => {
        const hx = 100 + i * step;
        const hh = 12 + ((i * 37) % 5);
        const tilt = ((i * 13) % 7) - 3;
        return (
          <g key={i} transform={`rotate(${tilt} ${hx} ${y})`}>
            <ellipse cx={hx + 4} cy={y + 1} rx={15} ry={3} fill="#000" opacity={0.35} />
            <rect x={hx - 10} y={y - hh} width={20} height={hh} fill="#7a6040" stroke="#2a1d10" strokeOpacity={0.6} />
            <rect x={hx - 10} y={y - hh} width={20} height={hh} fill="url(#fs-shade-flat)" />
            <rect x={hx - 3} y={y - 8} width={6} height={8} fill="#1d140b" />
            <path d={`M${hx - 14} ${y - hh + 1} L${hx} ${y - hh - 11} L${hx + 14} ${y - hh + 1} Z`} fill="url(#fs-roof-thatch)" />
            <path d={`M${hx - 14} ${y - hh + 1} L${hx} ${y - hh - 11} L${hx + 14} ${y - hh + 1} Z`} fill="url(#fs-straw)" />
            {level === "heavy" && i % 3 === 0 && (
              <path className="fortress-smoke" d={`M${hx + 6} ${y - hh - 8} q4 -8 0 -14 q-4 -6 1 -12`} stroke="#b9c0cc" strokeOpacity={0.4} strokeWidth={2} fill="none" />
            )}
          </g>
        );
      })}
      <g>
        <rect x={SCENE_WIDTH / 2 - label.length * 3.2 - 12} y={y + 12} width={label.length * 6.4 + 24} height={17} rx={2} fill="#1a120a" fillOpacity={0.82} stroke="#8a6a32" strokeOpacity={0.7} />
        <text x={SCENE_WIDTH / 2} y={y + 24} textAnchor="middle" fontSize={10.5} fontFamily={SERIF} fill="#e8d6ae">
          {label}
        </text>
      </g>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Hover card (a game-style tooltip). The same facts are in the survey and Ledger.

const THESIS_TONE: Record<string, string> = { breached: "text-[#ff6b5b]", review: "text-[#f2c14e]" };
const LAND_TONE: Record<string, string> = {
  bargain: "text-[#f2d16b]",
  discount: "text-[#e9c77a]",
  overpriced: "text-[#ff8a7a]",
};

/** Quick-look card shown beneath the framed scene (never over the towers). */
export function TowerPeek({ tower: t }: { tower: GameTower }) {
  const weight = t.weight_pct === null ? "weight unknown" : `${Number(t.weight_pct).toFixed(1)}% of the portfolio`;
  return (
    <div className="fortress-tip" role="status">
      <p className="fortress-tip-name">{t.name}</p>
      <p className="fortress-tip-sub">
        {STRUCTURE_LABEL[t.structure]}, {weight}
      </p>
      <ul className="mt-1.5 space-y-0.5">
        {t.wall !== "not_applicable" && <li>{WALL_LABEL[t.wall]}</li>}
        {t.moat !== "not_applicable" && <li>{MOAT_LABEL[t.moat]}</li>}
        {t.freshness !== "not_applicable" && <li>{FRESHNESS_LABEL[t.freshness]}</li>}
        <li className={LAND_TONE[t.land] ?? ""}>{LAND_LABEL[t.land]}</li>
        {t.thesis !== "not_applicable" && <li className={THESIS_TONE[t.thesis] ?? ""}>{THESIS_LABEL[t.thesis]}</li>}
      </ul>
      <p className="fortress-tip-hint">Click to read the full survey</p>
    </div>
  );
}

/** Quick-look card for the whole fortress (hover over the keep or the walls). */
export function RealmPeek({ count, oneLine }: { count: number; oneLine: string | null }) {
  return (
    <div className="fortress-tip" role="status">
      <p className="fortress-tip-name">The whole fortress</p>
      <p className="fortress-tip-sub">
        {count} {count === 1 ? "holding" : "holdings"}, kept together by one set of walls and one moat
      </p>
      {oneLine && <p className="mt-1.5">{oneLine}</p>}
      <p className="fortress-tip-hint">Click to read the verdict on everything</p>
    </div>
  );
}

/** Quick-look card for the market square (hover over the stalls or the hall). */
export function MarketPeek({ count, inRange }: { count: number | null; inRange: number }) {
  return (
    <div className="fortress-tip" role="status">
      <p className="fortress-tip-name">The Marketplace</p>
      <p className="fortress-tip-sub">
        {count === null
          ? "Your watchlist, one store per company"
          : `${count} ${count === 1 ? "store" : "stores"}, one per watchlist company${inRange > 0 ? ` · ${inRange} in your price range` : ""}`}
      </p>
      <p className="mt-1.5">Outside the walls: a place to look at what you do not own yet.</p>
      <p className="fortress-tip-hint">Click to walk the street and step into a store</p>
    </div>
  );
}

export default function FortressScene({
  layout,
  shantytown,
  shackCount,
  siege,
  selectedId,
  onSelect,
  onHover,
  realm,
  realmLevel,
  onRealmSelect,
  onRealmHover,
  market = null,
  ravenIds,
}: {
  layout: FortressLayout;
  shantytown: FortressShantytown;
  shackCount: number;
  siege: GameSiege | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  realm: RealmState;
  realmLevel: RealmLevel;
  onRealmSelect: () => void;
  onRealmHover: (on: boolean) => void;
  /** The market square below the walls (G9). Null draws none. */
  market?: MarketSquareProps | null;
  /** G15: holdings with an unseen raven. */
  ravenIds?: Set<string>;
}) {
  // Room below the last terrace only when there is a shantytown to draw there.
  const hasShacks = shantytown !== "none" && drawnShacks(shackCount) > 0;
  // The market sits just below the last terrace (and below the shantytown, when there is one).
  const marketTop = layout.height + (hasShacks ? 70 : -30);
  const height = market ? marketTop + MARKET_HEIGHT : layout.height + (hasShacks ? 70 : 12);
  const level = siege?.level ?? null;
  const sky = siegeSky(level);
  const palette = worldPalette(level);
  const runs = useMemo(() => moatRuns(layout), [layout]);
  const rowCount = Math.max(1, layout.rows);
  const handlers: RealmHandlers = { realm, onRealmSelect, onRealmHover };
  const rootRef = useRef<HTMLDivElement>(null);
  const running = useSceneRunning(rootRef);
  const onNavigate = (fromId: string, key: string) => {
    if (!isNavKey(key)) return;
    const target = nextTower(layout.items, fromId, key);
    if (!target) return;
    rootRef.current?.querySelector<SVGGElement>(`[data-tower-id="${CSS.escape(target)}"]`)?.focus();
  };
  const anyFresh = layout.items.some((i) => i.tower.freshness === "fresh");
  const summary = `${SIEGE_LABEL[level ?? "unsurveyed"]}. One fortress with a Great Keep for the whole portfolio and ${layout.items.length} ${
    layout.items.length === 1 ? "tower" : "towers"
  }, each a holding. ${layout.items.map((i) => `${i.tower.name}: ${MOAT_LABEL[i.tower.moat].toLowerCase()}`).join("; ")}`;
  return (
    <div ref={rootRef} data-paused={running ? undefined : "true"} className="relative min-w-[720px]">
      <svg viewBox={`0 0 ${SCENE_WIDTH} ${height}`} className="block h-auto w-full" role="group" aria-label={summary}>
        <SceneDefs palette={palette} />
        <SceneBackdrop layout={layout} sky={sky} palette={palette} height={height} />
        {Array.from({ length: rowCount }, (_, r) => {
          const rowItems = layout.items.filter((i) => i.row === r);
          const y = groundY(r);
          return (
            <g key={r}>
              <MoatRuns runs={runs.filter((run) => run.row === r)} />
              {r === 0 && <Causeway keep={layout.keep} />}
              <CurtainWall row={r} {...handlers} />
              <Bastion x={6} y={y} {...handlers} />
              <Bastion x={SCENE_WIDTH - 52} y={y} {...handlers} />
              {r === 0 && (
                <GreatKeep keep={layout.keep} level={realmLevel} lit={anyFresh} count={layout.items.length} {...handlers} />
              )}
              <SharedWalls layout={layout} siege={siege} row={r} />
              {rowItems.map((item) => (
                <TowerFigure
                  key={item.tower.holding_id}
                  item={item}
                  selected={selectedId === item.tower.holding_id}
                  onSelect={onSelect}
                  onHover={onHover}
                  level={level}
                  raven={ravenIds?.has(item.tower.holding_id) ?? false}
                  onNavigate={onNavigate}
                />
              ))}
              {rowItems.map((item) => (
                <LandSign key={`sign-${item.tower.holding_id}`} item={item} />
              ))}
            </g>
          );
        })}
        <Shantytown level={shantytown} count={shackCount} y={layout.height + 24} />
        {market && <MarketSquare y={marketTop} {...market} />}
        <SceneAmbience palette={palette} height={height} />
        <SceneVignette height={height} />
      </svg>
    </div>
  );
}
