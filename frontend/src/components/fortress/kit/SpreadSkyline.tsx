import ObjectArtImage from "../../ObjectArtImage";
import { SKYLINE_WIDTH, spreadScene } from "../../../lib/sectionScene";

/** "Who owns the ground": every holding as a tower on one line, width and height by its share, largest first. A bracket spans the
 * top five; a row of equal outline towers underneath shows how many equal holdings the portfolio behaves like, so the gap between
 * the rows is the concentration. No status colour (this measures, it does not judge). A holding with no stored weight is a fogged
 * tower marked "?", never zero. Small positions past twelve become huts. Static SVG; the numbers stay in the list beside it. */
export default function SpreadSkyline({
  weights,
  effective,
  shacks,
}: {
  weights: (number | null)[];
  effective: number | null;
  shacks: number;
}) {
  const s = spreadScene(weights, effective);
  if (s.towers.length === 0) return null;
  const crown = (x: number, w: number, h: number) => {
    const top = 62 - h;
    const n = Math.max(1, Math.floor(w / 5));
    const step = w / n;
    let d = `M${x} 62V${top}`;
    for (let i = 0; i < n; i++) d += `h${(step / 2).toFixed(2)}v-2.5h${(step / 2).toFixed(2)}v2.5`;
    return d + "V62Z";
  };
  const ghostH = 14;
  return (
    <div className="mt-3" data-testid="spread-skyline">
      <svg viewBox={`-4 -2 ${SKYLINE_WIDTH + 8} 108`} className="w-full text-ink-muted" role="img"
        aria-label={`${s.towers.length - (s.unweighted > 0 ? 1 : 0)} weighted holdings by share, then ${s.ghosts ? s.ghosts.length : "an unknown number of"} equal towers for the effective holdings`}>
        {s.topFive && (
          <path d={`M${s.topFive.x} 8V3H${s.topFive.x + s.topFive.w}V8`} fill="none" stroke="currentColor" strokeWidth="1.2" />
        )}
        {s.towers.map((t, i) =>
          t.fog ? (
            <g key={i} opacity="0.55">
              <path d={crown(t.x, t.w, t.h)} fill="none" stroke="currentColor" strokeDasharray="2 2" />
              <text x={t.x + t.w / 2} y={62 - t.h / 2} textAnchor="middle" fontSize="14" fill="currentColor">?</text>
            </g>
          ) : (
            <path key={i} d={crown(t.x, t.w, t.h)} fill="currentColor" fillOpacity={i === 0 ? 0.85 : 0.5} stroke="currentColor" strokeWidth="0.8" />
          ),
        )}
        <path d={`M0 62H${SKYLINE_WIDTH}`} stroke="currentColor" strokeWidth="1" />
        {s.ghosts ? (
          <>
            {s.ghosts.map((g, i) => (
              <rect key={i} x={g.x} y={104 - ghostH} width={g.w} height={ghostH} rx="1.5" fill="none" stroke="currentColor" strokeDasharray="2.5 2" />
            ))}
          </>
        ) : null}
      </svg>
      <p className="text-xs text-ink-faint">
        Bracket: the top five. Dashed: {s.ghosts ? "the same money split equally" : "equal split not known"}.
      </p>
      {(s.tail > 0 || shacks > 0) && (
        <div className="mt-1 flex items-center gap-1 text-xs text-ink-faint" aria-label={`${shacks} tiny positions`}>
          {Array.from({ length: Math.min(6, shacks) }, (_, i) => (
            <ObjectArtImage key={i} id="shack" width={22} fallback={null} />
          ))}
          {s.tail > 0 && <span>+{s.tail} more small ones</span>}
        </div>
      )}
    </div>
  );
}
