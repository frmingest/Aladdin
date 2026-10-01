import type { KeyboardEvent } from "react";
import { SCENE_WIDTH } from "../../lib/fortress";
import type { ShopTone } from "../../lib/marketplace";
import { TONE_PAINT } from "../../lib/marketplacePaint";

/**
 * The market square at the foot of the fortress (game mode, G9): a timber
 * Market Hall with one stall per watchlist company (six drawn at most, the
 * true count is printed). A stall's lantern is lit when that company is in
 * the price range the user named. Pressing anywhere on the square opens the
 * Marketplace. It is outside the walls on purpose: the market is where you
 * look at things you do not own yet.
 */

export const MARKET_HEIGHT = 178;
const SERIF = '"Marcellus", "Palatino Linotype", Palatino, Georgia, serif';
const MAX_STALLS = 6;

export interface MarketSquareProps {
  /** Watchlist size, or null when it has not loaded (the square is still drawn). */
  count: number | null;
  inRange: number;
  /** One tone per stall, in street order. */
  tones: ShopTone[];
  hot: boolean;
  onOpen: () => void;
  onHover: (on: boolean) => void;
}

function Stall({ x, y, tone, index }: { x: number; y: number; tone: ShopTone; index: number }) {
  const p = TONE_PAINT[tone];
  const lit = tone === "gold";
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="32" cy="2" rx="40" ry="5" fill="#000" opacity="0.35" />
      {/* posts and counter */}
      <rect x="4" y="-44" width="4" height="46" fill="#4a3318" />
      <rect x="56" y="-44" width="4" height="46" fill="#4a3318" />
      <rect x="2" y="-18" width="60" height="16" fill="#7a5a30" stroke="#2a1a0a" />
      <rect x="2" y="-18" width="60" height="4" fill="#a07b3a" />
      {/* goods */}
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx={13 + i * 13} cy={-23 + ((i + index) % 2) * 2} r="5" fill={["#c9552e", "#d9a93e", "#7aa05a", "#b8672a"][(i + index) % 4]} stroke="#2a1a0a" strokeWidth=".8" />
      ))}
      {/* awning */}
      <path d="M-2 -44 H66 L60 -62 H4 Z" fill={p.a} stroke="#2a1a0a" />
      {[1, 3].map((i) => {
        const top = (f: number) => 4 + 56 * f;
        const bot = (f: number) => -2 + 68 * f;
        return <polygon key={i} points={`${top(i / 4)},-62 ${top((i + 1) / 4)},-62 ${bot((i + 1) / 4)},-44 ${bot(i / 4)},-44`} fill={p.b} opacity="0.92" />;
      })}
      <path d="M-2 -44 q8 8 16 0 q8 8 16 0 q8 8 16 0 q8 8 16 0" fill={p.a} stroke="#2a1a0a" strokeWidth=".8" />
      {lit && (
        <g>
          <circle cx="32" cy="-36" r="14" fill="url(#fs-glow)" opacity="0.9" />
          <rect x="29" y="-42" width="6" height="8" rx="1.5" fill="#ffe28a" stroke="#6e4a12" strokeWidth=".8" />
        </g>
      )}
    </g>
  );
}

export default function MarketSquare({ y, count, inRange, tones, hot, onOpen, onHover }: MarketSquareProps & { y: number }) {
  const drawn = tones.slice(0, MAX_STALLS);
  const lefts = [338, 262, 186];
  const rights = [598, 674, 750];
  const slots = drawn.map((t, i) => ({ tone: t, x: i % 2 === 0 ? lefts[Math.floor(i / 2)] : rights[Math.floor(i / 2)] }));
  const label =
    count === null
      ? "Marketplace"
      : `Marketplace · ${count} ${count === 1 ? "store" : "stores"}${inRange > 0 ? ` · ${inRange} in your price range` : ""}`;
  const aria = `Enter the Marketplace: ${count === null ? "your watchlist" : `${count} ${count === 1 ? "company" : "companies"} on your watchlist`}${inRange > 0 ? `, ${inRange} in your price range` : ""}`;
  const onKey = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  };
  const ground = 132;
  return (
    <g
      transform={`translate(0 ${y})`}
      role="link"
      tabIndex={0}
      aria-label={aria}
      className={`fortress-realm-part${hot ? " is-hot" : ""}`}
      onClick={onOpen}
      onKeyDown={onKey}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
    >
      {/* cobbled square */}
      <ellipse cx={SCENE_WIDTH / 2} cy={ground + 6} rx={SCENE_WIDTH * 0.43} ry="22" fill="#5d5242" stroke="#2a2218" strokeOpacity="0.6" filter="url(#fs-grain)" />
      <ellipse cx={SCENE_WIDTH / 2} cy={ground + 4} rx={SCENE_WIDTH * 0.4} ry="17" fill="#7a6d58" opacity="0.85" />
      {Array.from({ length: 22 }, (_, i) => (
        <ellipse key={i} cx={130 + i * 35 + ((i * 17) % 11)} cy={ground + 2 + ((i * 7) % 9)} rx="7" ry="2.4" fill="#948770" opacity="0.7" />
      ))}

      {slots.map((s, i) => (
        <Stall key={i} x={s.x} y={ground} tone={s.tone} index={i} />
      ))}

      {/* the Market Hall */}
      <g transform={`translate(${SCENE_WIDTH / 2 - 84} 0)`}>
        <ellipse cx="84" cy={ground + 4} rx="100" ry="8" fill="#000" opacity="0.4" />
        <rect x="8" y="64" width="152" height={ground - 64} fill="#8d6436" stroke="#2a1a0a" />
        <rect x="8" y="64" width="152" height={ground - 64} fill="url(#fs-planks)" opacity="0.85" />
        <rect x="8" y="64" width="152" height={ground - 64} fill="url(#fs-shade-flat)" />
        {/* open arches with lamplit interiors */}
        {[28, 70, 112].map((ax) => (
          <g key={ax}>
            <path d={`M${ax} ${ground} V92 Q${ax + 14} 72 ${ax + 28} 92 V${ground} Z`} fill="#1d140b" stroke="#2a1a0a" />
            <path d={`M${ax + 4} ${ground} V96 Q${ax + 14} 82 ${ax + 24} 96 V${ground} Z`} fill="url(#fs-window)" opacity="0.9" />
          </g>
        ))}
        {/* roof */}
        <path d="M-6 66 L84 12 L174 66 Z" fill="url(#fs-roof-wood)" stroke="#2a1a0a" />
        <path d="M-6 66 L84 12 L174 66 Z" fill="url(#fs-tiles)" opacity="0.6" />
        <path d="M-6 66 L84 12 L84 66 Z" fill="#fff" opacity="0.08" />
        <rect x="-8" y="64" width="184" height="5" fill="#4a3318" stroke="#2a1a0a" />
        {/* banner */}
        <line x1="84" y1="12" x2="84" y2="-12" stroke="#2a1a0a" strokeWidth="2" />
        <path className="fortress-banner" d="M84 -12 h26 l-6 7 l6 7 h-26 Z" fill="#c9962e" stroke="#6e4a12" />
        {/* hanging sign */}
        <g>
          <line x1="40" y1="68" x2="40" y2="78" stroke="#2a1a0a" />
          <line x1="128" y1="68" x2="128" y2="78" stroke="#2a1a0a" />
          <rect x="22" y="76" width="124" height="22" rx="2" fill="#3a2614" stroke="#c9a24a" />
          <text x="84" y="92" textAnchor="middle" fontSize="13" fontFamily={SERIF} fill="#f3e4bf" letterSpacing="1.5">
            MARKETPLACE
          </text>
        </g>
      </g>

      {/* label plate */}
      <g>
        <rect x={SCENE_WIDTH / 2 - label.length * 3.4 - 14} y={ground + 14} width={label.length * 6.8 + 28} height="19" rx="2" fill="#1a120a" fillOpacity="0.85" stroke="#8a6a32" strokeOpacity="0.8" />
        <text x={SCENE_WIDTH / 2} y={ground + 27} textAnchor="middle" fontSize="11" fontFamily={SERIF} fill="#e8d6ae">
          {label}
        </text>
      </g>
      {/* focus / hover ring */}
      <rect className="market-ring" x="120" y="2" width={SCENE_WIDTH - 240} height={MARKET_HEIGHT - 6} rx="14" fill="none" />
    </g>
  );
}
