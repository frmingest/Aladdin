import type { KeyboardEvent } from "react";
import {
  MOAT_LABEL,
  ROW_HEIGHT,
  SCENE_TOP,
  SCENE_WIDTH,
  SIEGE_LABEL,
  describeTower,
  drawnShacks,
  ladderCount,
  landSignText,
  sharedWallLinks,
  siegeSky,
  type FortressLayout,
  type PlacedTower,
  type SiegeSky,
} from "../../lib/fortress";
import type { FortressShantytown, FortressSiegeLevel, FortressWall, GameSiege } from "../../lib/types";

/**
 * The Fortress home scene (F33, G2): a layered SVG diorama of the real
 * portfolio. It is a picture of values the backend already decided — it
 * never computes how strong anything is (backend/app/domain/game_mapping).
 * Colours are fixed on purpose: the scene is a painting in a frame and reads
 * the same in the dark and light themes. Everything shown here is also in
 * the Ledger view, so the picture is never the only way to read a fact.
 */

const WALL_FILL: Record<FortressWall, string> = {
  basalt: "#2f3947",
  granite: "#7b8494",
  brick: "#a85a3c",
  timber: "#8a6a3c",
  rotted: "#51402c",
  unsurveyed: "#3a4352",
  not_applicable: "#6b7585",
};

const LABEL_FILL = "#dbe2ee";
const MUTED_FILL = "#9aa6ba";

/** Fit the label under its tower: roughly 7 px per character, and a little
 * wider than the tower itself, so neighbouring names never run together. */
function shortName(name: string, towerWidth: number): string {
  const max = Math.max(8, Math.floor((towerWidth + 20) / 7));
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

function Defs({ sky }: { sky: SiegeSky }) {
  return (
    <defs>
      <linearGradient id="fs-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={sky.top} />
        <stop offset="1" stopColor={sky.bottom} />
      </linearGradient>
      <linearGradient id="fs-mist" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#dbe2ee" stopOpacity="0" />
        <stop offset="1" stopColor="#dbe2ee" stopOpacity="0.22" />
      </linearGradient>
      <linearGradient id="fs-ground" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#323a2c" />
        <stop offset="1" stopColor="#1f241b" />
      </linearGradient>
      <linearGradient id="fs-water" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#3b78b5" />
        <stop offset="1" stopColor="#24527f" />
      </linearGradient>
      <linearGradient id="fs-gold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f6d365" />
        <stop offset="1" stopColor="#c99a2e" />
      </linearGradient>
      <pattern id="fs-stone" width="22" height="14" patternUnits="userSpaceOnUse">
        <path d="M0 .5H22M0 7.5H22M11 .5V7.5M0 7.5V14.5M22 7.5V14.5" stroke="#000" strokeOpacity=".28" fill="none" />
      </pattern>
      <pattern id="fs-planks" width="9" height="30" patternUnits="userSpaceOnUse">
        <path d="M.5 0V30" stroke="#000" strokeOpacity=".32" fill="none" />
      </pattern>
    </defs>
  );
}

/** Dark clouds, thicker the worse the stored regime / stress scenario. */
function StormClouds({ opacity }: { opacity: number }) {
  if (opacity <= 0) return null;
  const blobs: [number, number, number, number][] = [
    [120, 50, 120, 22], [300, 38, 150, 26], [520, 56, 140, 24], [720, 42, 160, 28], [900, 58, 110, 22],
  ];
  return (
    <g aria-hidden opacity={opacity}>
      {blobs.map(([cx, cy, rx, ry]) => (
        <g key={cx}>
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#0b0e15" opacity={0.8} />
          <ellipse cx={cx + rx * 0.4} cy={cy + ry * 0.3} rx={rx * 0.7} ry={ry * 0.8} fill="#171c28" />
        </g>
      ))}
    </g>
  );
}

/** Enemy camps on the far hills while the realm is besieged: a tent and a
 * flickering fire each, drawn behind everything else. */
function SiegeFires({ count, y }: { count: number; y: number }) {
  if (count <= 0) return null;
  const xs = [48, 262, 508, 742, 952].slice(0, count);
  return (
    <g aria-hidden>
      {xs.map((x, i) => (
        <g key={x}>
          <path d={`M${x - 20} ${y + 4} L${x - 11} ${y - 12} L${x - 2} ${y + 4} Z`} fill="#3d2b2b" stroke="#000" strokeOpacity=".4" />
          <g className="fortress-flicker" style={{ animationDelay: `${i * 160}ms` }}>
            <ellipse cx={x + 8} cy={y + 4} rx={16} ry={4} fill="#f59e0b" opacity={0.28} />
            <path d={`M${x + 8} ${y + 3} q-8 -10 -2 -19 q2 7 6 3 q4 7 -4 16 Z`} fill="#f59e0b" />
            <path d={`M${x + 8} ${y + 3} q-3 -5 0 -10 q3 5 0 10 Z`} fill="#fde68a" />
          </g>
        </g>
      ))}
    </g>
  );
}

function Backdrop({ layout, sky }: { layout: FortressLayout; sky: SiegeSky }) {
  const rows = Math.max(1, layout.rows);
  const stars = [
    [70, 30], [180, 58], [320, 24], [470, 48], [610, 22], [760, 52], [900, 30], [540, 66], [120, 74],
  ];
  return (
    <g aria-hidden>
      <rect width={SCENE_WIDTH} height={layout.height + 70} fill="url(#fs-sky)" />
      {stars.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={1.3} fill="#e8eefc" opacity={0.55 * (1 - sky.clouds)} />
      ))}
      <StormClouds opacity={sky.clouds} />
      <path
        d={`M0 ${layout.height - 150} C 180 ${layout.height - 205}, 330 ${layout.height - 120}, 520 ${layout.height - 175} S 860 ${layout.height - 200}, 1000 ${layout.height - 150} V ${layout.height + 70} H0 Z`}
        fill="#1b2230"
        opacity={0.8}
      />
      <SiegeFires count={sky.fires} y={layout.height - 168} />
      {sky.mist && (
        <rect x={0} y={layout.height - 230} width={SCENE_WIDTH} height={110} fill="url(#fs-mist)" />
      )}
      {Array.from({ length: rows }, (_, r) => (
        <rect
          key={r}
          x={0}
          y={SCENE_TOP + r * ROW_HEIGHT + 168}
          width={SCENE_WIDTH}
          height={78}
          fill="url(#fs-ground)"
        />
      ))}
    </g>
  );
}

function Moat({ item }: { item: PlacedTower }) {
  const { tower, x, y, w } = item;
  switch (tower.moat) {
    case "wide":
      return (
        <g>
          <rect x={x - 12} y={y} width={w + 24} height={26} rx={7} fill="url(#fs-water)" />
          <path
            d={`M${x - 4} ${y + 9} q8 -4 16 0 t16 0 t16 0 t16 0 t16 0 t16 0`}
            stroke="#a9d1f5"
            strokeOpacity=".5"
            fill="none"
          />
          <path
            d={`M${x - 8} ${y + 18} q8 -4 16 0 t16 0 t16 0 t16 0 t16 0 t16 0`}
            stroke="#a9d1f5"
            strokeOpacity=".35"
            fill="none"
          />
          <rect x={x + w / 2 - 11} y={y - 3} width={22} height={30} rx={2} fill="#6b4f2a" />
        </g>
      );
    case "narrow":
      return (
        <g>
          <rect x={x - 6} y={y} width={w + 12} height={11} rx={4} fill="url(#fs-water)" />
          <rect x={x + w / 2 - 8} y={y - 2} width={16} height={15} rx={2} fill="#6b4f2a" />
        </g>
      );
    case "none":
      return (
        <rect
          x={x - 6}
          y={y}
          width={w + 12}
          height={8}
          rx={3}
          fill="#3a3023"
          stroke="#7a6a50"
          strokeDasharray="4 3"
        />
      );
    case "unsurveyed":
      return (
        <rect
          x={x - 6}
          y={y}
          width={w + 12}
          height={10}
          rx={4}
          fill="none"
          stroke="#8b95a5"
          strokeDasharray="2 4"
          opacity={0.7}
        />
      );
    default:
      return null;
  }
}

function Crenellations({ x, y, w, rotted }: { x: number; y: number; w: number; rotted: boolean }) {
  const count = Math.max(2, Math.floor(w / 15));
  const step = w / count;
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        // A rotted wall has lost some of its top.
        if (rotted && i % 3 === 1) return null;
        return <rect key={i} x={x + i * step + 2} y={y - 10} width={Math.max(6, step - 5)} height={11} />;
      })}
    </g>
  );
}

function Keep({ item }: { item: PlacedTower }) {
  const { tower, x, y, w, h } = item;
  const top = y - h;
  const fill = WALL_FILL[tower.wall];
  const rotted = tower.wall === "rotted";
  const unsurveyed = tower.wall === "unsurveyed";
  const cx = x + w / 2;

  if (unsurveyed) {
    return (
      <g>
        <rect x={x} y={top} width={w} height={h} fill="#8b95a5" fillOpacity={0.1} stroke="#8b95a5" strokeDasharray="5 4" />
        <text x={cx} y={top + h / 2 + 8} textAnchor="middle" fontSize={26} fill="#8b95a5" opacity={0.9}>
          ?
        </text>
      </g>
    );
  }

  const planks = tower.wall === "timber";
  return (
    <g transform={rotted ? `rotate(-2.5 ${cx} ${y})` : undefined}>
      <g fill={fill}>
        <rect x={x} y={top} width={w} height={h} />
        <Crenellations x={x} y={top} w={w} rotted={rotted} />
      </g>
      <rect x={x} y={top} width={w} height={h} fill={planks ? "url(#fs-planks)" : "url(#fs-stone)"} />
      <rect x={x} y={top} width={w} height={h} fill="none" stroke="#000" strokeOpacity=".35" />
      <path
        d={`M${cx - w * 0.13} ${y} v${-h * 0.22} a${w * 0.13} ${w * 0.13} 0 0 1 ${w * 0.26} 0 v${h * 0.22} Z`}
        fill="#161a22"
      />
      <rect x={cx - 2} y={top + h * 0.28} width={4} height={h * 0.16} fill="#161a22" />
      {rotted && (
        <path
          d={`M${x + w * 0.2} ${top + 4} l8 18 l-6 12 l9 22 M${x + w * 0.72} ${top + 10} l-7 16 l6 14`}
          stroke="#16110a"
          strokeWidth={2}
          fill="none"
        />
      )}
      {tower.freshness === "fresh" && (
        <g>
          <line x1={cx} y1={top - 10} x2={cx} y2={top - 30} stroke="#cbd2de" strokeWidth={1.5} />
          <path d={`M${cx} ${top - 30} l18 5 l-18 5 Z`} fill="#e3b341" />
        </g>
      )}
    </g>
  );
}

function Outpost({ item }: { item: PlacedTower }) {
  const { x, y, w, h } = item;
  const cx = x + w / 2;
  return (
    <g>
      <rect x={x} y={y - h} width={w} height={h} fill="#6d7787" />
      <rect x={x} y={y - h} width={w} height={h} fill="url(#fs-stone)" />
      <rect x={x} y={y - h} width={w} height={h} fill="none" stroke="#000" strokeOpacity=".35" />
      <path d={`M${x - 6} ${y - h} L${cx} ${y - h - 24} L${x + w + 6} ${y - h} Z`} fill="#4f5a6c" />
      <rect x={cx - 7} y={y - h * 0.5} width={14} height={h * 0.5} rx={2} fill="#161a22" />
    </g>
  );
}

function Bullion({ item }: { item: PlacedTower }) {
  const { x, y, w, h } = item;
  const cx = x + w / 2;
  return (
    <g>
      <path
        d={`M${x} ${y} Q${x + w * 0.15} ${y - h * 0.9} ${cx} ${y - h} Q${x + w * 0.85} ${y - h * 0.9} ${x + w} ${y} Z`}
        fill="url(#fs-gold)"
        stroke="#8f6a14"
      />
      <path d={`M${cx - w * 0.2} ${y - h * 0.55} l6 -7 l6 7 Z`} fill="#fff6c9" opacity={0.8} />
      <rect x={x + w * 0.1} y={y - 8} width={w * 0.8} height={8} fill="#e0b441" stroke="#8f6a14" />
    </g>
  );
}

function Granary({ item }: { item: PlacedTower }) {
  const { x, y, w, h } = item;
  const cx = x + w / 2;
  return (
    <g>
      <rect x={x + 6} y={y - h} width={w - 12} height={h} fill="#8a8f7a" />
      <rect x={x + 6} y={y - h} width={w - 12} height={h} fill="url(#fs-planks)" />
      <ellipse cx={cx} cy={y - h} rx={(w - 12) / 2} ry={14} fill="#a3a88f" stroke="#000" strokeOpacity=".3" />
      <rect x={cx - 6} y={y - h * 0.4} width={12} height={h * 0.4} rx={2} fill="#2b2f24" />
    </g>
  );
}

function Weathering({ item }: { item: PlacedTower }) {
  const { tower, x, y, w, h } = item;
  const top = y - h;
  if (tower.freshness === "weathered" || tower.freshness === "overgrown") {
    const heavy = tower.freshness === "overgrown";
    const patches: [number, number, number][] = heavy
      ? [[0.08, 0.35, 11], [0.9, 0.5, 12], [0.18, 0.7, 13], [0.78, 0.82, 12], [0.5, 0.92, 11], [0.12, 0.12, 9], [0.86, 0.2, 10]]
      : [[0.1, 0.55, 9], [0.88, 0.8, 9], [0.2, 0.88, 8]];
    return (
      <g aria-hidden>
        {patches.map(([px, py, r], i) => (
          <ellipse key={i} cx={x + w * px} cy={top + h * py} rx={r} ry={r * 0.8} fill="#3f6b3a" opacity={0.85} />
        ))}
        {heavy && (
          <path
            d={`M${x - 6} ${y} L${x + w + 6} ${top} M${x + w + 6} ${y} L${x - 6} ${top} M${x - 6} ${top + h / 2} H${x + w + 6}`}
            stroke="#b08a4a"
            strokeWidth={1.4}
            opacity={0.8}
          />
        )}
      </g>
    );
  }
  if (tower.freshness === "unsurveyed" && tower.wall !== "unsurveyed") {
    return (
      <g aria-hidden>
        <rect x={x - 4} y={top - 4} width={w + 8} height={h + 6} fill="#dbe2ee" opacity={0.16} />
        <ellipse cx={x + w / 2} cy={top + h * 0.7} rx={w * 0.7} ry={9} fill="#dbe2ee" opacity={0.16} />
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
  const fill = item.tower.land === "overpriced" ? "#8a3b3b" : item.tower.land === "bargain" ? "#e3b341" : "#b89a4a";
  const ink = item.tower.land === "overpriced" ? "#fbe9e9" : "#241a05";
  return (
    <g aria-hidden>
      <rect x={px - 1} y={y - 26} width={2} height={26} fill="#5b4526" />
      <g transform={`rotate(-4 ${px} ${y - 20})`}>
        <rect x={px - 15} y={y - 29} width={30} height={13} rx={2} fill={fill} stroke="#3a2a10" strokeOpacity=".7" />
        <text x={px} y={y - 19.5} textAnchor="middle" fontSize={8} fontWeight={700} fill={ink}>
          {text}
        </text>
      </g>
    </g>
  );
}

/** A fired tripwire is a breach in the wall; a thesis flagged for review is
 * an amber notice. Both carry a symbol, so colour is never the only cue. */
function ThesisMarks({ item }: { item: PlacedTower }) {
  const { tower, x, y, w, h } = item;
  if (tower.thesis !== "breached" && tower.thesis !== "review") return null;
  const top = y - h;
  const bx = x + w - 2;
  const by = top - 6;
  if (tower.thesis === "review") {
    return (
      <g aria-hidden>
        <circle cx={bx} cy={by} r={8} fill="#d29922" stroke="#2b1f05" strokeOpacity=".6" />
        <text x={bx} y={by + 4} textAnchor="middle" fontSize={11} fontWeight={800} fill="#2b1f05">
          i
        </text>
      </g>
    );
  }
  const gapX = x + w * 0.58;
  return (
    <g aria-hidden>
      <path
        d={`M${gapX} ${top + h * 0.2} l9 8 l-5 7 l8 9 l-6 8 l5 10 l-14 0 l-3 -12 l6 -8 l-7 -9 Z`}
        fill="#0e0a07"
        stroke="#c0392b"
        strokeOpacity=".8"
      />
      <rect x={x + 3} y={y - 5} width={9} height={5} fill="#5c5348" />
      <rect x={x + w - 14} y={y - 7} width={11} height={7} fill="#6b6155" />
      <rect x={x + w * 0.35} y={y - 4} width={7} height={4} fill="#4d463d" />
      <circle cx={bx} cy={by} r={9} fill="#c0392b" stroke="#fff" strokeOpacity=".85" />
      <text x={bx} y={by + 4.5} textAnchor="middle" fontSize={13} fontWeight={800} fill="#fff">
        !
      </text>
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
    const baseX = side === 1 ? x + w + 9 : x - 9;
    const topX = side === 1 ? x + w - 1 : x + 1;
    const topY = top + h * 0.2;
    const rungs = [0.25, 0.5, 0.75].map((t) => ({
      cx: baseX + (topX - baseX) * t,
      cy: y + (topY - y) * t,
    }));
    return (
      <g key={side} stroke="#b08a4a" strokeWidth={1.6} strokeLinecap="round">
        <line x1={baseX - 2} y1={y} x2={topX - 2} y2={topY} />
        <line x1={baseX + 2} y1={y} x2={topX + 2} y2={topY} />
        {rungs.map((r, i) => (
          <line key={i} x1={r.cx - 3} y1={r.cy} x2={r.cx + 3} y2={r.cy} />
        ))}
      </g>
    );
  };
  return <g aria-hidden>{count === 2 ? [ladder(1), ladder(-1)] : ladder(1)}</g>;
}

/** A cracked curtain wall joining two towers that move together (a stored
 * correlation flag): when one falls the other is hit by the same blow. */
function SharedWalls({ layout, siege }: { layout: FortressLayout; siege: GameSiege | null }) {
  if (!siege || siege.shared_walls.length === 0) return null;
  const byId = new Map(layout.items.map((i) => [i.tower.holding_id, i]));
  return (
    <g aria-hidden>
      {sharedWallLinks(layout.items, siege.shared_walls).map((link) => {
        const a = byId.get(link.fromId);
        const b = byId.get(link.toId);
        if (!a || !b) return null;
        const x1 = a.x + a.w - 2;
        const x2 = b.x + 2;
        const y = a.y;
        const mid = (x1 + x2) / 2;
        return (
          <g key={`${link.fromId}-${link.toId}`}>
            <rect x={x1} y={y - 46} width={x2 - x1} height={46} fill="#6b6155" />
            <rect x={x1} y={y - 46} width={x2 - x1} height={46} fill="url(#fs-stone)" />
            <path
              d={`M${mid - 3} ${y - 46} l6 12 l-7 9 l7 11 l-4 14`}
              stroke="#e0554a"
              strokeWidth={2}
              fill="none"
            />
            <rect x={x1} y={y - 46} width={x2 - x1} height={46} fill="none" stroke="#c0392b" strokeOpacity=".7" strokeDasharray="3 3" />
          </g>
        );
      })}
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

function TowerFigure({
  item,
  selected,
  onSelect,
  level,
}: {
  item: PlacedTower;
  selected: boolean;
  onSelect: (id: string) => void;
  level: FortressSiegeLevel | null;
}) {
  const { tower, x, y, w } = item;
  const pad = 30;
  const onKey = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(tower.holding_id);
    }
  };
  const weight = tower.weight_pct === null ? "—" : `${Number(tower.weight_pct).toFixed(1)}%`;
  return (
    <g
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${describeTower(tower)}. Press for details.`}
      className="fortress-tower"
      onClick={() => onSelect(tower.holding_id)}
      onKeyDown={onKey}
    >
      <g className="fortress-rise" style={{ animationDelay: `${item.index * 70}ms` }}>
        <Moat item={item} />
        <TowerBody item={item} />
        <Weathering item={item} />
        <ThesisMarks item={item} />
        <Ladders item={item} level={level} />
      </g>
      <text x={x + w / 2} y={y + 44} textAnchor="middle" fontSize={11} fontWeight={600} fill={LABEL_FILL}>
        {shortName(tower.name, w)}
      </text>
      <text x={x + w / 2} y={y + 58} textAnchor="middle" fontSize={10} fill={MUTED_FILL}>
        {weight}
      </text>
      <rect
        className="fortress-focus"
        x={x - pad + 4}
        y={y - item.h - 36}
        width={w + pad * 2 - 8}
        height={item.h + 36 + 64}
        rx={8}
        fill="transparent"
        stroke={selected ? "#60a5fa" : "none"}
        strokeWidth={2}
      />
    </g>
  );
}

function Shantytown({
  level,
  count,
  y,
}: {
  level: FortressShantytown;
  count: number;
  y: number;
}) {
  const drawn = drawnShacks(count);
  if (level === "none" || drawn === 0) return null;
  const span = SCENE_WIDTH - 160;
  const step = drawn > 1 ? span / (drawn - 1) : 0;
  return (
    <g aria-hidden>
      {Array.from({ length: drawn }, (_, i) => {
        const hx = 80 + i * step;
        const hh = 11 + ((i * 37) % 5);
        return (
          <g key={i}>
            <rect x={hx - 10} y={y - hh} width={20} height={hh} fill="#6a5a40" stroke="#000" strokeOpacity=".3" />
            <path d={`M${hx - 13} ${y - hh} L${hx} ${y - hh - 9} L${hx + 13} ${y - hh} Z`} fill="#4a3d2a" />
            {level === "heavy" && i % 3 === 0 && (
              <path d={`M${hx + 6} ${y - hh - 8} q4 -8 0 -14 q-4 -6 1 -12`} stroke="#9aa6ba" strokeOpacity=".45" fill="none" />
            )}
          </g>
        );
      })}
      <text x={SCENE_WIDTH / 2} y={y + 18} textAnchor="middle" fontSize={11} fill={MUTED_FILL}>
        {level === "heavy" ? "Shantytown" : "A few shacks"}: {count} tiny {count === 1 ? "position" : "positions"}
        {count > drawn ? ` (${drawn} drawn)` : ""}
      </text>
    </g>
  );
}

export default function FortressScene({
  layout,
  shantytown,
  shackCount,
  siege,
  selectedId,
  onSelect,
}: {
  layout: FortressLayout;
  shantytown: FortressShantytown;
  shackCount: number;
  siege: GameSiege | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const height = layout.height + 70;
  const level = siege?.level ?? null;
  const sky = siegeSky(level);
  const summary = `${SIEGE_LABEL[level ?? "unsurveyed"]}. Fortress of ${layout.items.length} ${
    layout.items.length === 1 ? "tower" : "towers"
  }. ${layout.items.map((i) => `${i.tower.name}: ${MOAT_LABEL[i.tower.moat].toLowerCase()}`).join("; ")}`;
  return (
    <svg
      viewBox={`0 0 ${SCENE_WIDTH} ${height}`}
      className="h-auto w-full min-w-[720px] rounded-lg"
      role="group"
      aria-label={summary}
    >
      <Defs sky={sky} />
      <Backdrop layout={layout} sky={sky} />
      <SharedWalls layout={layout} siege={siege} />
      {layout.items.map((item) => (
        <TowerFigure
          key={item.tower.holding_id}
          item={item}
          selected={selectedId === item.tower.holding_id}
          onSelect={onSelect}
          level={level}
        />
      ))}
      {layout.items.map((item) => (
        <LandSign key={`sign-${item.tower.holding_id}`} item={item} />
      ))}
      <text x={SCENE_WIDTH - 16} y={22} textAnchor="end" fontSize={12} fontWeight={600} fill={LABEL_FILL} opacity={0.9}>
        {SIEGE_LABEL[level ?? "unsurveyed"]}
      </text>
      <Shantytown level={shantytown} count={shackCount} y={layout.height + 24} />
    </svg>
  );
}
