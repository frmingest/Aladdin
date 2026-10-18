import { useId } from "react";
import { WALL_FILL } from "../../../lib/wallRise";
import { WALL_RUNGS, describeRise, rungWord, type WallRise } from "../../../lib/wallRise";

/** Masons' courses rising to the next rung (Fortress, "Walls on the rise").
 * Left: the wall you have, filled with its own stone. Right: a flag in the next rung's stone.
 * The filled courses show how far the stored ratio has come across the band; a hatched, unbuilt
 * stretch is what is left. No stored ratio: the whole bar is fog and no fill is drawn. The five
 * pips under it mark the rung (shape, not colour: built, this one, next, not yet). */
export default function WallRiseGauge({ rise, compact = false }: { rise: WallRise; compact?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const W = 220;
  const H = compact ? 16 : 22;
  const flagW = 16;
  const trackW = W - flagW - 2;
  const own = WALL_FILL[rise.rung];
  const nextFill = rise.next ? WALL_FILL[rise.next] : own;
  const fog = rise.progress === null;
  const built = fog ? 0 : rise.progress! * trackW;
  const pip = compact ? 7 : 9;
  return (
    <figure className="m-0" role="img" aria-label={describeRise(rise)}>
      <svg viewBox={`0 0 ${W} ${H + pip + 6}`} width="100%" className="block max-w-full" aria-hidden="true" focusable="false">
        <defs>
          <pattern id={`${uid}-courses`} width="16" height={H / 2} patternUnits="userSpaceOnUse">
            <rect width="16" height={H / 2} fill="none" />
            <path d={`M0 ${H / 2 - 0.5}H16M8 0V${H / 2}`} stroke="rgba(0,0,0,0.38)" strokeWidth="1" />
          </pattern>
          <pattern id={`${uid}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <path d="M0 0V6" stroke="currentColor" strokeWidth="1" opacity="0.35" />
          </pattern>
        </defs>
        {/* the stretch still to build */}
        <rect x="1" y="1" width={trackW} height={H} rx="2" fill={`url(#${uid}-hatch)`} stroke="currentColor" strokeOpacity={fog ? 0.25 : 0.5} strokeDasharray={fog ? "3 3" : undefined} className="text-ink-faint" />
        {!fog && built > 0 && (
          <g className="motion-reduce:transition-none">
            <rect x="1" y="1" width={Math.max(2, built)} height={H} rx="2" fill={own} />
            <rect x="1" y="1" width={Math.max(2, built)} height={H} rx="2" fill={`url(#${uid}-courses)`} />
          </g>
        )}
        {/* the next rung's flag */}
        {rise.next && (
          <g>
            <line x1={trackW + 1} y1="0" x2={trackW + 1} y2={H + 2} stroke="currentColor" className="text-ink-muted" strokeWidth="1.5" />
            <rect x={trackW + 2} y="1" width={flagW - 2} height={H / 2 + 1} fill={nextFill} stroke="currentColor" strokeWidth="0.75" className="text-ink-muted" />
          </g>
        )}
        {rise.kind === "top" && <text x={W / 2} y={H / 2 + 5} textAnchor="middle" fontSize="11" fontWeight="600" fill="#fff" stroke="rgba(0,0,0,0.5)" strokeWidth="0.4">Top rung</text>}
        {rise.slipping && <path d={`M${trackW * 0.04 + 1} 2l3 5-3 4 3 5`} stroke="#fff" strokeWidth="1.2" fill="none" />}
        {/* five rungs */}
        {WALL_RUNGS.map((r, i) => {
          const x = 1 + i * (pip + 4);
          const y = H + 6;
          const isNow = i === rise.rungIndex;
          const isNext = rise.next !== null && r === rise.next;
          const done = i < rise.rungIndex;
          return (
            <rect
              key={r}
              x={x}
              y={y}
              width={pip}
              height={pip}
              rx={isNow ? 1 : 2}
              fill={isNow || done ? WALL_FILL[r] : "none"}
              fillOpacity={done ? 0.55 : 1}
              stroke="currentColor"
              strokeWidth={isNow ? 1.6 : 1}
              strokeDasharray={isNext ? "2 1.5" : undefined}
              strokeOpacity={isNow || isNext ? 0.9 : 0.35}
              className="text-ink"
            />
          );
        })}
      </svg>
      <figcaption className="sr-only">
        {rungWord(rise.rung)} walls{rise.next ? `, next ${rungWord(rise.next)}` : ""}
      </figcaption>
    </figure>
  );
}
