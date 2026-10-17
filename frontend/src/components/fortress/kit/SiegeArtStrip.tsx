import { useId } from "react";
import { shortLabel } from "../../../lib/fortress";
import { worldPalette } from "../../../lib/fortressArt";
import { holdingLine } from "../../../lib/siege";
import {
  GROUND_Y,
  LABEL_DY,
  SCENE_H,
  arrowHits,
  breachHole,
  flameTongues,
  rubbleStones,
  rampartTiles,
  sceneWidth,
  siegeStripCamp,
  siegeTowers,
} from "../../../lib/siegeArt";
import { OBJECT_ART } from "../../../lib/stitchArt";
import type { Flame as SiegeFlame, SiegeTowerArt } from "../../../lib/siegeArt";
import type { FortressSiegeLevel, SiegeSimHolding } from "../../../lib/types";

const WALL_SEGMENT_SRC = OBJECT_ART["wall-segment"].src;

/**
 * The Siege Simulator's row of towers drawn with the Stitch pictures (Design Master Sprint 14), used only
 * when the Settings "Object art" switch is on; the page keeps its hand-drawn SVG strip otherwise. The
 * pictures carry no fact. Code draws soot, fallen stones, stuck fire arrows and a column of flames that climbs the wall as the share lost
 * grow with it, a grey "?" over towers that are not modelled, and the besieging camp (the same camp the
 * Fortress draws for the same siege level). The list below the strip says every number in words.
 */
export default function SiegeArtStrip({ rows, level, scenery = false }: { rows: SiegeSimHolding[]; level: FortressSiegeLevel; scenery?: boolean }) {
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
        <radialGradient id={`${uid}-soot`} cx="0.5" cy="1" r="0.62">
          <stop offset="0" stopColor="#1d120b" stopOpacity="0.78" />
          <stop offset="0.55" stopColor="#1d120b" stopOpacity="0.4" />
          <stop offset="1" stopColor="#1d120b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-flame`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#f7c85a" stopOpacity="0.95" />
          <stop offset="0.5" stopColor="#e8812e" stopOpacity="0.9" />
          <stop offset="1" stopColor="#c2491f" stopOpacity="0.35" />
        </linearGradient>
        <radialGradient id={`${uid}-glow`}>
          <stop offset="0" stopColor="#f09a3a" stopOpacity="0.32" />
          <stop offset="1" stopColor="#f09a3a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-hole`} cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#050303" />
          <stop offset="0.7" stopColor="#120b07" />
          <stop offset="1" stopColor="#2a1c12" />
        </radialGradient>
        {towers.map((t, i) =>
          t.placement ? (
            <clipPath key={t.holdingId} id={`${uid}-c${i}`}>
              <rect x={t.placement.body.x} y={t.placement.body.top} width={t.placement.body.w} height={t.placement.ground - t.placement.body.top} />
            </clipPath>
          ) : null,
        )}
      </defs>

      {!scenery && (
        <>
          <rect width={width} height={SCENE_H} fill={`url(#${uid}-sky)`} />
          <ellipse cx={210} cy={GROUND_Y - 40} rx={palette.sun.r} ry={palette.sun.r * 0.45} fill={palette.sun.color} opacity={palette.sun.opacity * 0.5} />
          <path d={`M0 ${GROUND_Y - 34} Q ${width * 0.2} ${GROUND_Y - 62} ${width * 0.4} ${GROUND_Y - 36} T ${width * 0.8} ${GROUND_Y - 40} T ${width} ${GROUND_Y - 30} V ${GROUND_Y} H0 Z`} fill={palette.farHills} />
        </>
      )}
      <rect y={GROUND_Y - 6} width={width} height={SCENE_H - GROUND_Y + 6} fill={`url(#${uid}-grass)`} opacity={scenery ? 0.85 : 1} />

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
              <DamageLayer uid={uid} index={i} tower={t} body={body} footY={footY} scorchTop={scorchTop} />
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

const STONE_TONES = ["#8a8378", "#625c53", "#403b35"] as const;
const ARROW_ART = OBJECT_ART["siege-arrow"];

/**
 * What the siege does to one tower, all drawn by code from the backend's numbers: a soft soot stain that
 * climbs the wall (fading out at its top edge), a ragged hole where the backend says the wall is at risk of
 * breach (with smoke), fallen stones at the foot, fire arrows stuck in the stone and animated flames whose
 * column climbs the wall as the loss deepens (still under reduced motion).
 * Shape carries the meaning; nothing here depends on colour alone.
 */
function DamageLayer({
  uid,
  index,
  tower: t,
  body,
  footY,
  scorchTop,
}: {
  uid: string;
  index: number;
  tower: SiegeTowerArt;
  body: { x: number; w: number; top: number };
  footY: number;
  scorchTop: number;
}) {
  const k = t.scale;
  const flames = flameTongues(body, scorchTop, footY, t.damagePct, index, k);
  const stones = rubbleStones(body, footY, t.damagePct, index, k);
  const hits = arrowHits(body, scorchTop, footY, t.damagePct, index);
  const hole = t.breach ? breachHole(body, scorchTop, footY, index) : null;
  const aw = (17 * k * ARROW_ART.width) / ARROW_ART.height;
  const ah = 17 * k;
  return (
    <g aria-hidden="true">
      <g clipPath={`url(#${uid}-c${index})`}>
        <rect x={body.x} y={scorchTop} width={body.w} height={footY - scorchTop} fill={`url(#${uid}-soot)`} />
        {hole && (
          <g>
            <polygon points={hole.points} fill={`url(#${uid}-hole)`} stroke="#b8aa90" strokeWidth={0.9} strokeOpacity={0.55} strokeLinejoin="miter" />
            <ellipse cx={hole.cx} cy={hole.cy + hole.r * 0.3} rx={hole.r * 0.26} ry={hole.r * 0.18} fill="#d9822f" opacity={0.38} />
          </g>
        )}
      </g>
      {hole &&
        [0, 1, 2].map((n) => (
          <circle key={n} cx={hole.cx + (n - 1) * 3 * k} cy={hole.cy - hole.r - n * 9 * k} r={(3 + n * 2) * k} fill="#cfc6b8" opacity={0.34 - n * 0.08} />
        ))}
      {stones.map((st, n) => (
        <polygon key={n} points={st.points} fill={STONE_TONES[st.tone]} stroke="#1a1410" strokeWidth={0.5} strokeOpacity={0.6} />
      ))}
      {flames.length > 0 && (
        <g opacity={0.9}>
          <ellipse
            cx={body.x + body.w / 2}
            cy={footY - (footY - scorchTop) * 0.4}
            rx={body.w * 0.75}
            ry={(footY - scorchTop) * 0.62}
            fill={`url(#${uid}-glow)`}
          />
          {flames.map((f, n) => (
            <Flame key={n} f={f} uid={uid} />
          ))}
          {t.damagePct >= 40 &&
            [0, 1].map((n) => (
              <circle
                key={n}
                className="fortress-ember"
                cx={body.x + body.w * (0.35 + 0.3 * n)}
                cy={scorchTop + 4}
                r={1.3 * k}
                fill="#ffd27a"
                style={{ animationDelay: `${-n * 1.7}s` }}
              />
            ))}
        </g>
      )}
      {hits.map((h, n) => {
        // The picture's flaming tip is its upper-left corner; after turning it, put that tip on the hit point.
        const rad = (h.rotate * Math.PI) / 180;
        const vx = -0.42 * aw;
        const vy = -0.42 * ah;
        const cx = h.x - (vx * Math.cos(rad) - vy * Math.sin(rad));
        const cy = h.y - (vx * Math.sin(rad) + vy * Math.cos(rad));
        return (
          <image
            key={n}
            href={ARROW_ART.src}
            x={cx - aw / 2}
            y={cy - ah / 2}
            width={aw}
            height={ah}
            transform={`rotate(${h.rotate} ${cx} ${cy})`}
          />
        );
      })}
    </g>
  );
}

/** One tongue of fire: an outer orange flame with a pale core. Its flicker is CSS (stills under reduced motion). */
function Flame({ f, uid }: { f: SiegeFlame; uid: string }) {
  const { w, h } = f;
  const outer = `M0 0 C${-w / 2} 0 ${-w / 2} ${-h * 0.45} ${-w * 0.12} ${-h * 0.72} C${-w * 0.05} ${-h * 0.86} 0 ${-h * 0.9} 0 ${-h} C0 ${-h * 0.9} ${w * 0.05} ${-h * 0.86} ${w * 0.12} ${-h * 0.72} C${w / 2} ${-h * 0.45} ${w / 2} 0 0 0 Z`;
  return (
    <g transform={`translate(${f.x.toFixed(1)} ${f.y.toFixed(1)})`}>
      <g className="siege-flame" style={{ animationDuration: `${f.dur.toFixed(2)}s`, animationDelay: `${f.delay.toFixed(2)}s` }}>
        <path d={outer} fill={`url(#${uid}-flame)`} />
        <path d={outer} fill="#ffe7a0" opacity={0.7} transform="scale(0.45 0.6)" />
      </g>
    </g>
  );
}
