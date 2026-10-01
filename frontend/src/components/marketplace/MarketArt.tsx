import { useEffect, useId, useState } from "react";
import type { Gate, GateStatus } from "../../lib/marketplace";
import { GATE_STATUS_LABEL } from "../../lib/marketplace";
import { STATUS_PAINT } from "../../lib/marketplacePaint";
import type { StoreLevel } from "../../lib/marketplace";

/**
 * Painted pieces for the Marketplace (game mode, G9): awnings, the merchant,
 * the decision scales, the gate doors and the status pips. Like the Fortress
 * painting these use fixed colours on purpose; the words around them use the
 * theme. Every fact drawn here is also written out in text next to it.
 */

const SERIF = '"Marcellus", "Palatino Linotype", Palatino, Georgia, serif';

/** A striped shop awning with a scalloped edge. Decorative. */
export function Awning({ a, b, stripes = 10, className = "" }: { a: string; b: string; stripes?: number; className?: string }) {
  const w = 600;
  const sw = w / stripes;
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox={`0 0 ${w} 62`} preserveAspectRatio="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={`aw-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.28" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={w} height="10" fill="#3a2614" />
      {Array.from({ length: stripes }, (_, i) => {
        const x = i * sw;
        return (
          <path
            key={i}
            d={`M${x} 8 H${x + sw} V40 q${-sw / 2} 22 ${-sw} 0 Z`}
            fill={i % 2 === 0 ? a : b}
            stroke="#2a1a0a"
            strokeOpacity="0.45"
          />
        );
      })}
      <rect x="0" y="8" width={w} height="44" fill={`url(#aw-${id})`} />
    </svg>
  );
}

/** The merchant: a generic drawn shopkeeper, not anyone's likeness. */
export function Merchant({ level, size = 84 }: { level: StoreLevel; size?: number }) {
  const mouth =
    level === "ready"
      ? "M30 56 Q42 66 54 56"
      : level === "promising"
        ? "M31 58 Q42 62 53 58"
        : level === "wait"
          ? "M31 59 H53"
          : level === "pass"
            ? "M31 62 Q42 54 53 62"
            : "M33 60 Q42 54 51 60 Q46 66 42 62";
  const brow =
    level === "pass" ? ["M26 34 L38 38", "M58 34 L46 38"] : level === "unknown" ? ["M26 34 Q32 28 38 34", "M46 36 Q52 30 58 36"] : ["M26 36 Q32 32 38 36", "M46 36 Q52 32 58 36"];
  return (
    <svg width={size} height={size} viewBox="0 0 84 84" role="img" aria-label="The merchant">
      <ellipse cx="42" cy="80" rx="30" ry="4" fill="#000" opacity="0.3" />
      <path d="M10 82 Q12 62 42 62 Q72 62 74 82 Z" fill="#6b2d2a" stroke="#2a0f0d" />
      <path d="M32 62 L42 74 L52 62 Z" fill="#efe6c8" stroke="#2a1a0a" strokeWidth=".8" />
      <rect x="35" y="52" width="14" height="12" fill="#d9a77b" />
      <ellipse cx="42" cy="40" rx="19" ry="21" fill="#e2b48a" stroke="#4a2c14" />
      <path d="M22 28 Q42 6 62 28 L66 31 Q42 22 18 31 Z" fill="#2f4a82" stroke="#14213f" />
      <path d="M18 31 Q42 24 66 31 Q42 36 18 31 Z" fill="#c9962e" stroke="#6e4a12" strokeWidth=".8" />
      <circle cx="58" cy="19" r="3.2" fill="#f6d77a" stroke="#6e4a12" strokeWidth=".7" />
      <circle cx="34" cy="42" r="2.2" fill="#2a1a0a" />
      <circle cx="50" cy="42" r="2.2" fill="#2a1a0a" />
      <path d={brow[0]} stroke="#4a2c14" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d={brow[1]} stroke="#4a2c14" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M29 51 Q42 47 55 51 Q48 57 42 54 Q36 57 29 51 Z" fill="#6b4a2a" />
      <path d={mouth} stroke="#4a1f14" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Status pips and the decision scales.

/** One gate as a small round pip. Colour is never the only cue: a mark is drawn inside. */
export function Pip({ gate, size = 18 }: { gate: Gate; size?: number }) {
  const p = STATUS_PAINT[gate.status];
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" role="img" aria-label={`${gate.title}: ${GATE_STATUS_LABEL[gate.status]}`}>
      <title>{`${gate.title}: ${GATE_STATUS_LABEL[gate.status]}`}</title>
      <circle cx="10" cy="10" r="8" fill={p.fill} stroke={p.stroke} strokeWidth="1.4" strokeDasharray={gate.status === "unknown" ? "2.5 2.5" : undefined} opacity={gate.status === "na" ? 0.4 : 1} />
      {gate.status === "open" && <path d="M6 10.5 L9 13.5 L14.5 7" stroke="#0e2a1a" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
      {gate.status === "ajar" && <path d="M10 2 A8 8 0 0 1 10 18 Z" fill="#7a5718" opacity="0.5" />}
      {gate.status === "closed" && <path d="M6.5 6.5 L13.5 13.5 M13.5 6.5 L6.5 13.5" stroke="#2a0a09" strokeWidth="2" strokeLinecap="round" />}
      {gate.status === "unknown" && (
        <text x="10" y="14" textAnchor="middle" fontSize="11" fontFamily={SERIF} fill="#9aa3b5">
          ?
        </text>
      )}
    </svg>
  );
}

/** The decision scales. Gold coins (open gates) in the left pan, dark stones (closed) and pebbles
 * (ajar) in the right; unknown gates are hollow rings on the shelf. It is a picture of the counts,
 * not a score: there is no number on it that is not also a count written beside it. */
export function DecisionScales({ gates }: { gates: Gate[] }) {
  const live = gates.filter((g) => g.status !== "na");
  const open = live.filter((g) => g.status === "open").length;
  const ajar = live.filter((g) => g.status === "ajar").length;
  const closed = live.filter((g) => g.status === "closed").length;
  const unknown = live.filter((g) => g.status === "unknown").length;
  const against = closed + ajar * 0.5;
  const raw = live.length === 0 ? 0 : ((against - open) / live.length) * 18;
  const target = Math.max(-16, Math.min(16, raw));
  const [tilt, setTilt] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setTilt(target), 60);
    return () => window.clearTimeout(t);
  }, [target]);

  const cx = 160;
  const cy = 52;
  const arm = 100;
  const hang = 78;

  const coins = Array.from({ length: open }, (_, i) => i);
  const stones = Array.from({ length: closed }, (_, i) => i);
  const pebbles = Array.from({ length: ajar }, (_, i) => i);
  const label = `Decision scales: ${open} open, ${ajar} ajar, ${closed} closed, ${unknown} unknown gates.`;

  const Pan = ({ children }: { children: React.ReactNode }) => (
    <g>
      <path d={`M-34 ${hang} Q0 ${hang + 22} 34 ${hang} Z`} fill="#8a6a32" stroke="#3b2a12" />
      <path d={`M-34 ${hang} L0 0 L34 ${hang}`} stroke="#c9a24a" strokeWidth="1.2" fill="none" />
      {children}
    </g>
  );

  return (
    <svg viewBox="0 0 320 190" className="mx-auto block h-auto w-full max-w-[22rem]" role="img" aria-label={label}>
      <ellipse cx={cx} cy="176" rx="64" ry="6" fill="#000" opacity="0.3" />
      <path d={`M${cx - 30} 176 L${cx - 8} 60 H${cx + 8} L${cx + 30} 176 Z`} fill="#6b4a26" stroke="#2a1a0a" />
      <rect x={cx - 38} y="170" width="76" height="8" rx="2" fill="#8a6a32" stroke="#2a1a0a" />
      <g className="market-tilt" style={{ transform: `rotate(${tilt}deg)`, transformOrigin: `${cx}px ${cy}px` }}>
        <rect x={cx - arm} y={cy - 4} width={arm * 2} height="8" rx="3" fill="#d9a93e" stroke="#6e4a12" />
        <circle cx={cx} cy={cy} r="8" fill="#f6d77a" stroke="#6e4a12" />
        <g transform={`translate(${cx - arm} ${cy})`}>
          <g className="market-tilt" style={{ transform: `rotate(${-tilt}deg)`, transformOrigin: "0px 0px" }}>
            <Pan>
              {coins.map((i) => (
                <g key={i} transform={`translate(${-22 + (i % 4) * 14} ${hang - 4 - Math.floor(i / 4) * 9})`}>
                  <ellipse rx="7" ry="3.2" fill="#f6d77a" stroke="#6e4a12" strokeWidth=".8" />
                </g>
              ))}
            </Pan>
          </g>
        </g>
        <g transform={`translate(${cx + arm} ${cy})`}>
          <g className="market-tilt" style={{ transform: `rotate(${-tilt}deg)`, transformOrigin: "0px 0px" }}>
            <Pan>
              {stones.map((i) => (
                <circle key={`s${i}`} cx={-20 + (i % 3) * 16} cy={hang - 6 - Math.floor(i / 3) * 12} r="7.5" fill="#3d4350" stroke="#14171d" />
              ))}
              {pebbles.map((i) => (
                <circle
                  key={`p${i}`}
                  cx={-24 + (i % 4) * 14}
                  cy={hang - 6 - Math.ceil(stones.length / 3) * 12 - Math.floor(i / 4) * 8}
                  r="4"
                  fill="#8c93a0"
                  stroke="#14171d"
                  strokeWidth=".7"
                />
              ))}
            </Pan>
          </g>
        </g>
      </g>
      <g transform={`translate(${cx} 148)`} aria-hidden>
        {Array.from({ length: unknown }, (_, i) => (
          <circle key={i} cx={(i - (unknown - 1) / 2) * 16} cy="0" r="5.5" fill="none" stroke="#9aa3b5" strokeDasharray="2.5 2.5" />
        ))}
      </g>
      <text x="40" y="22" textAnchor="middle" fontSize="10" fontFamily={SERIF} className="fill-current text-ink-muted">
        Open
      </text>
      <text x="280" y="22" textAnchor="middle" fontSize="10" fontFamily={SERIF} className="fill-current text-ink-muted">
        Closed or ajar
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// A gate as a door.

export function DoorIcon({ status }: { status: GateStatus }) {
  const gold = "#e9c46a";
  return (
    <svg width="38" height="46" viewBox="0 0 38 46" aria-hidden className={status === "na" ? "opacity-40" : undefined}>
      <path d="M3 46 V18 Q3 3 19 3 Q35 3 35 18 V46 Z" fill="#241a10" stroke="#6b5126" strokeWidth="1.4" />
      {status === "open" && (
        <>
          <path d="M8 46 V19 Q8 9 19 9 Q30 9 30 19 V46 Z" fill="url(#door-glow)" />
          <path d="M8 46 V19 Q8 9 15 9.6 L11 14 V46 Z" fill="#6b4a26" stroke="#2a1a0a" />
          <circle cx="19" cy="30" r="9" fill={gold} opacity="0.18" />
        </>
      )}
      {status === "ajar" && (
        <>
          <path d="M8 46 V19 Q8 9 19 9 Q30 9 30 19 V46 Z" fill="#33250f" />
          <path d="M19 9 Q30 9 30 19 V46 H19 Z" fill="#e9c46a" opacity="0.28" />
          <path d="M8 46 V19 Q8 9 19 9 V46 Z" fill="#6b4a26" stroke="#2a1a0a" />
          <circle cx="16" cy="30" r="1.6" fill={gold} />
        </>
      )}
      {status === "closed" && (
        <>
          <path d="M8 46 V19 Q8 9 19 9 Q30 9 30 19 V46 Z" fill="#6b4a26" stroke="#2a1a0a" />
          <path d="M19 9 V46 M8 28 H30" stroke="#2a1a0a" strokeWidth="1.2" />
          <rect x="14" y="26" width="10" height="9" rx="1.5" fill="#d9534f" stroke="#3e0f0d" />
          <path d="M16 26 V22.5 a3 3 0 0 1 6 0 V26" fill="none" stroke="#c3c6cf" strokeWidth="1.6" />
        </>
      )}
      {(status === "unknown" || status === "na") && (
        <>
          <path d="M8 46 V19 Q8 9 19 9 Q30 9 30 19 V46 Z" fill="#2c3340" stroke="#9aa3b5" strokeDasharray="3 3" />
          <text x="19" y="33" textAnchor="middle" fontSize="16" fontFamily={SERIF} fill="#9aa3b5">
            {status === "na" ? "–" : "?"}
          </text>
        </>
      )}
      <defs>
        <radialGradient id="door-glow" cx="0.5" cy="0.7" r="0.7">
          <stop offset="0" stopColor="#ffe9a6" />
          <stop offset="1" stopColor="#c9962e" stopOpacity="0.2" />
        </radialGradient>
      </defs>
    </svg>
  );
}
