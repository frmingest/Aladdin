import { ZONE_LABEL, type Ladder, type LadderMarker } from "../../lib/marketplace";

/**
 * The price board: a horizontal price ladder with the stored bear, base and
 * bull values, the price that would leave a 25% cushion, today's price (a
 * coin) and the price you named (a flag). The zones are the same four that
 * the Fortress draws as "land for sale". Every marker is also in the table
 * under the board, so the picture is never the only way to read a number.
 */

const W = 1000;
const LEFT = 36;
const RIGHT = 36;
const TRACK_Y = 96;
const TRACK_H = 26;

const SERIF = '"Marcellus", "Palatino Linotype", Palatino, Georgia, serif';

const KIND_STYLE: Record<LadderMarker["kind"], { color: string; label: string }> = {
  bear: { color: "#c9962e", label: "Bear case" },
  base: { color: "#e8d9a8", label: "Base case" },
  bull: { color: "#9cc7a2", label: "Bull case" },
  cushion: { color: "#7fe0a0", label: "25% cushion" },
  price: { color: "#ffffff", label: "Price today" },
  yours: { color: "#9dbaf0", label: "Your price" },
};

function fmt(v: number): string {
  return v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : v.toFixed(2);
}

/** Put labels on separate lanes when they would overlap. */
function lanes(items: { x: number }[], minGap: number): number[] {
  const last: number[] = [];
  return items.map((it) => {
    let lane = 0;
    while (last[lane] !== undefined && it.x - last[lane] < minGap) lane += 1;
    last[lane] = it.x;
    return lane;
  });
}

export default function PriceBoard({ ladder }: { ladder: Ladder }) {
  const span = ladder.max - ladder.min || 1;
  const x = (v: number) => LEFT + ((v - ladder.min) / span) * (W - LEFT - RIGHT);
  const get = (k: LadderMarker["kind"]) => ladder.markers.find((m) => m.kind === k);
  const bear = get("bear");
  const base = get("base");
  const bull = get("bull");
  const price = get("price");

  // Zone strip between the stored scenario values that exist; the names appear only when all three do.
  const edges: { from: number; to: number; fill: string; name: string }[] = [];
  const lo = ladder.min;
  const hi = ladder.max;
  const full = !!(bear && base && bull);
  const cuts = [bear, base, bull].filter((m): m is LadderMarker => !!m);
  let prev = lo;
  cuts.forEach((m, i) => {
    const fill = i === 0 ? (m.kind === "base" ? "#8aa86a" : "#c9962e") : m.kind === "base" ? "#8aa86a" : "#6d7a8c";
    edges.push({ from: prev, to: m.value, fill, name: i === 0 ? (m.kind === "base" ? "discount" : "bargain") : m.kind === "base" ? "discount" : "fair" });
    prev = m.value;
  });
  if (cuts.length > 0) {
    const lastKind = cuts[cuts.length - 1].kind;
    edges.push({ from: prev, to: hi, fill: lastKind === "bull" ? "#b85a4f" : "#6d7a8c", name: lastKind === "bull" ? "dear" : "fair" });
  }

  const below = ladder.markers.filter((m) => ["bear", "base", "bull", "cushion"].includes(m.kind)).sort((a, b) => a.value - b.value);
  const above = ladder.markers.filter((m) => m.kind === "price" || m.kind === "yours").sort((a, b) => a.value - b.value);
  const belowLanes = lanes(below.map((m) => ({ x: x(m.value) })), 92);
  const aboveLanes = lanes(above.map((m) => ({ x: x(m.value) })), 92);
  const height = 190 + Math.max(0, Math.max(...belowLanes, 0) - 1) * 22;

  const summary = `Price board. ${ladder.markers
    .slice()
    .sort((a, b) => a.value - b.value)
    .map((m) => `${KIND_STYLE[m.kind].label} ${fmt(m.value)}`)
    .join(", ")}${ladder.currency ? ` ${ladder.currency}` : ""}.${ladder.zone ? ` Today's price is ${ZONE_LABEL[ladder.zone].toLowerCase()}.` : ""}`;

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-border bg-[#17110b]">
        <svg viewBox={`0 0 ${W} ${height}`} className="block h-auto w-full min-w-[640px]" role="img" aria-label={summary}>
          <defs>
            <linearGradient id="pb-wood" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3a2a18" />
              <stop offset="1" stopColor="#1d140b" />
            </linearGradient>
            <linearGradient id="pb-sheen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          <rect width={W} height={height} fill="url(#pb-wood)" />
          <rect x="6" y="6" width={W - 12} height={height - 12} fill="none" stroke="#a07b3a" strokeOpacity="0.6" />

          {/* track */}
          <g>
            <rect x={LEFT - 3} y={TRACK_Y - 3} width={W - LEFT - RIGHT + 6} height={TRACK_H + 6} rx="5" fill="#0d0905" stroke="#6b5126" />
            {edges.map((e) => (
              <rect key={e.name} x={x(e.from)} y={TRACK_Y} width={Math.max(0, x(e.to) - x(e.from))} height={TRACK_H} fill={e.fill} opacity={0.82} />
            ))}
            <rect x={LEFT} y={TRACK_Y} width={W - LEFT - RIGHT} height={TRACK_H} fill="url(#pb-sheen)" />
            {full && bear && x(bear.value) - x(lo) > 70 && (
              <text x={(x(lo) + x(bear.value)) / 2} y={TRACK_Y + 17} textAnchor="middle" fontSize="11" fontFamily={SERIF} fill="#2a1a06">
                Bargain
              </text>
            )}
            {full && bear && base && x(base.value) - x(bear.value) > 70 && (
              <text x={(x(bear.value) + x(base.value)) / 2} y={TRACK_Y + 17} textAnchor="middle" fontSize="11" fontFamily={SERIF} fill="#10200f">
                Discount
              </text>
            )}
            {full && base && x(bull ? bull.value : hi) - x(base.value) > 70 && (
              <text x={(x(base.value) + x(bull ? bull.value : hi)) / 2} y={TRACK_Y + 17} textAnchor="middle" fontSize="11" fontFamily={SERIF} fill="#0f1620">
                Full price
              </text>
            )}
            {full && bull && x(hi) - x(bull.value) > 60 && (
              <text x={(x(bull.value) + x(hi)) / 2} y={TRACK_Y + 17} textAnchor="middle" fontSize="11" fontFamily={SERIF} fill="#240d0a">
                Dear
              </text>
            )}
          </g>

          {/* scenario ticks and labels below the track */}
          {below.map((m, i) => {
            const px = x(m.value);
            const lane = belowLanes[i];
            const s = KIND_STYLE[m.kind];
            const ly = TRACK_Y + TRACK_H + 26 + lane * 24;
            return (
              <g key={m.kind}>
                <line x1={px} x2={px} y1={TRACK_Y - 4} y2={ly - 14} stroke={s.color} strokeWidth={m.kind === "cushion" ? 1.5 : 2.2} strokeDasharray={m.kind === "cushion" ? "4 3" : undefined} />
                <text x={px} y={ly} textAnchor="middle" fontSize="12" fontFamily={SERIF} fill={s.color}>
                  {s.label}
                </text>
                <text x={px} y={ly + 13} textAnchor="middle" fontSize="11.5" fill="#e8dcc0" className="tabular">
                  {fmt(m.value)}
                </text>
              </g>
            );
          })}

          {/* today's price (a coin) and your price (a flag), above the track */}
          {above.map((m, i) => {
            const px = x(m.value);
            const lane = aboveLanes[i];
            const topY = 58 - lane * 38;
            if (m.kind === "price") {
              return (
                <g key={m.kind}>
                  <line x1={px} x2={px} y1={topY + 12} y2={TRACK_Y - 2} stroke="#fff" strokeWidth="2" />
                  <ellipse cx={px} cy={topY} rx="13" ry="13" fill="#f6d77a" stroke="#6e4a12" strokeWidth="1.5" />
                  <ellipse cx={px} cy={topY} rx="8.5" ry="8.5" fill="none" stroke="#8a5e14" strokeWidth="1" />
                  <text x={px} y={topY + 4} textAnchor="middle" fontSize="11" fontFamily={SERIF} fill="#5a3a08">
                    now
                  </text>
                  <text x={px - 20} y={topY - 2} textAnchor="end" fontSize="11.5" fontFamily={SERIF} fill="#fff">
                    Price today
                  </text>
                  <text x={px - 20} y={topY + 12} textAnchor="end" fontSize="11.5" fill="#e8dcc0" className="tabular">
                    {fmt(m.value)}
                  </text>
                </g>
              );
            }
            return (
              <g key={m.kind}>
                <line x1={px} x2={px} y1={topY - 12} y2={TRACK_Y - 2} stroke="#9dbaf0" strokeWidth="2" />
                <path d={`M${px} ${topY - 14} h30 l-7 8 l7 8 h-30 Z`} fill="#3a63b0" stroke="#14275a" />
                <text x={px + 36} y={topY - 4} fontSize="11.5" fontFamily={SERIF} fill="#9dbaf0">
                  Your price
                </text>
                <text x={px + 36} y={topY + 10} fontSize="11.5" fill="#e8dcc0" className="tabular">
                  {fmt(m.value)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {ladder.zone && price ? (
          <p className="text-ink">
            Today&apos;s price of <span className="tabular font-medium">{fmt(price.value)}</span>
            {ladder.currency ? ` ${ladder.currency}` : ""} is <span className="font-medium">{ZONE_LABEL[ladder.zone].toLowerCase()}</span>.
          </p>
        ) : (
          <p className="text-ink-muted">Today&apos;s price is not placed on the board.</p>
        )}
      </div>

      <table className="tabular mt-3 w-full max-w-md text-sm">
        <caption className="sr-only">Every marker on the price board</caption>
        <tbody className="divide-y divide-border-subtle">
          {ladder.markers
            .slice()
            .sort((a, b) => a.value - b.value)
            .map((m) => (
              <tr key={m.kind}>
                <th scope="row" className="py-1 pr-4 text-left font-normal text-ink-muted">
                  {KIND_STYLE[m.kind].label}
                </th>
                <td className="py-1 text-right text-ink">
                  {fmt(m.value)}
                  {ladder.currency ? ` ${ladder.currency}` : ""}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      {ladder.notes.map((n) => (
        <p key={n} className="mt-2 text-xs text-ink-faint">
          {n}
        </p>
      ))}
    </div>
  );
}
