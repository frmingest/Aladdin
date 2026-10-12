import { useId } from "react";
import { shortLabel } from "../../../lib/fortress";
import { worldPalette } from "../../../lib/fortressArt";
import { holdingLine } from "../../../lib/siege";
import {
  GROUND_Y,
  LABEL_DY,
  SCENE_H,
  crackPath,
  rampartTiles,
  sceneWidth,
  siegeStripCamp,
  siegeTowers,
} from "../../../lib/siegeArt";
import { OBJECT_ART } from "../../../lib/stitchArt";
import type { FortressSiegeLevel, SiegeSimHolding } from "../../../lib/types";

const WALL_SEGMENT_SRC = OBJECT_ART["wall-segment"].src;

/**
 * The Siege Simulator's row of towers drawn with the Stitch pictures (Design Master Sprint 14), used only
 * when the Settings "Object art" switch is on; the page keeps its hand-drawn SVG strip otherwise. The
 * pictures carry no fact. Code draws a scorched band that rises with the share of the wall lost, cracks that
 * grow with it, a grey "?" over towers that are not modelled, and the besieging camp (the same camp the
 * Fortress draws for the same siege level). The list below the strip says every number in words.
 */
export default function SiegeArtStrip({ rows, level }: { rows: SiegeSimHolding[]; level: FortressSiegeLevel }) {
  const uid = useId().replace(/:/g, "");
  const palette = worldPalette(level);
  const width = sceneWidth(rows.length);
  const towers = siegeTowers(rows, width);
  const camp = siegeStripCamp(level);
  const ramparts = rampartTiles(width);

  return (
    <svg
      viewBox={`0 0 ${width} ${SCENE_H}`}
      className="h-auto w-full"
      style={{ minWidth: Math.min(width, 640) }}
      role="img"
      aria-label="Each tower with the share of its wall lost in this what-if, and the army camped outside when the fall reaches the storm or siege line"
    >
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={palette.sky[0]} />
          <stop offset="0.55" stopColor={palette.sky[1]} />
          <stop offset="1" stopColor={palette.sky[2]} />
        </linearGradient>
        <linearGradient id={`${uid}-grass`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={palette.grass[0]} />
          <stop offset="1" stopColor={palette.grass[1]} />
        </linearGradient>
        <linearGradient id={`${uid}-burn`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#0d0907" stopOpacity="0.85" />
          <stop offset="1" stopColor="#0d0907" stopOpacity="0.38" />
        </linearGradient>
        {towers.map((t, i) =>
          t.placement ? (
            <clipPath key={t.holdingId} id={`${uid}-c${i}`}>
              <rect x={t.placement.body.x} y={t.placement.body.top} width={t.placement.body.w} height={t.placement.ground - t.placement.body.top} />
            </clipPath>
          ) : null,
        )}
      </defs>

      <rect width={width} height={SCENE_H} fill={`url(#${uid}-sky)`} />
      <ellipse cx={210} cy={GROUND_Y - 40} rx={palette.sun.r} ry={palette.sun.r * 0.45} fill={palette.sun.color} opacity={palette.sun.opacity * 0.5} />
      <path d={`M0 ${GROUND_Y - 34} Q ${width * 0.2} ${GROUND_Y - 62} ${width * 0.4} ${GROUND_Y - 36} T ${width * 0.8} ${GROUND_Y - 40} T ${width} ${GROUND_Y - 30} V ${GROUND_Y} H0 Z`} fill={palette.farHills} />
      <rect y={GROUND_Y - 6} width={width} height={SCENE_H - GROUND_Y + 6} fill={`url(#${uid}-grass)`} />

      <g aria-hidden="true" style={{ filter: palette.grade }}>
        {camp.map((s, i) => (
          <image key={`camp-${i}`} href={s.src} x={s.left} y={s.top} width={s.width} height={s.height} />
        ))}
      </g>

      {towers.map((t, i) => {
        const row = rows[i];
        const label = shortLabel(row.name, row.ticker, 8);
        const p = t.placement;
        if (!p) {
          // Walls never surveyed: no picture and no guessed material, just the dashed ghost keep.
          const gx = t.cx - 27;
          return (
            <g key={t.holdingId}>
              <title>{`${row.ticker}: ${holdingLine(row)}`}</title>
              <rect x={gx} y={GROUND_Y - 80} width={54} height={80} rx={3} fill="none" stroke="#a8977a" strokeDasharray="4 3" />
              <text x={t.cx} y={GROUND_Y - 36} textAnchor="middle" fontSize="22" fill="#a8977a">?</text>
              <text x={t.cx} y={GROUND_Y + LABEL_DY} textAnchor="middle" fontSize="12" fill="#cdbb97">{label}</text>
            </g>
          );
        }
        const body = p.body;
        const footY = p.ground;
        const scorchTop = footY - t.scorchPx;
        return (
          <g key={t.holdingId}>
            <title>{`${row.ticker}: ${holdingLine(row)}`}</title>
            <image
              href={p.src}
              x={p.left}
              y={p.top}
              width={p.width}
              height={p.height}
              opacity={t.modelled ? 1 : 0.42}
              style={{ filter: t.modelled ? palette.grade : `${palette.grade} grayscale(1)` }}
            />
            {t.modelled && t.scorchPx > 0 && (
              <g clipPath={`url(#${uid}-c${i})`} aria-hidden="true">
                <path
                  d={jaggedBand(body.x, body.w, scorchTop, footY)}
                  fill={`url(#${uid}-burn)`}
                />
                <path d={`M${body.x} ${scorchTop + 1} H${body.x + body.w}`} stroke="#e8c87a" strokeWidth={1} opacity={0.45} />
                {Array.from({ length: t.cracks }, (_, n) => (
                  <path key={n} d={crackPath(body, scorchTop, footY, i, n)} fill="none" stroke="#e8d9b4" strokeWidth={1.4} opacity={0.75} />
                ))}
              </g>
            )}
            {!t.modelled && (
              <text x={t.cx} y={p.top + p.height * 0.62} textAnchor="middle" fontSize="26" fill="#e6d8b8">?</text>
            )}
            <text x={t.cx} y={GROUND_Y + LABEL_DY} textAnchor="middle" fontSize="12" fill="#cdbb97">{label}</text>
          </g>
        );
      })}

      <g aria-hidden="true" style={{ filter: palette.grade }}>
        {ramparts.map((r, i) => (
          <image key={`rampart-${i}`} href={WALL_SEGMENT_SRC} x={r.left} y={r.top} width={r.width} height={r.height} preserveAspectRatio="none" />
        ))}
      </g>
    </svg>
  );
}

/** A scorched band with a ragged top edge, so the damage reads as a burnt line rather than a flat bar. */
function jaggedBand(x: number, w: number, topY: number, footY: number): string {
  const teeth = Math.max(3, Math.round(w / 8));
  const step = w / teeth;
  let d = `M${x} ${footY} L${x} ${topY}`;
  for (let i = 1; i <= teeth; i += 1) d += ` L${(x + step * i).toFixed(1)} ${(topY + (i % 2 === 0 ? 0 : 3)).toFixed(1)}`;
  return `${d} L${x + w} ${footY} Z`;
}
