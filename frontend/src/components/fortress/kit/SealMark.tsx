import { SEAL_LOOK, type SealKind } from "../../../lib/seals";

/** A wax seal that carries a status by shape, glyph and printed word together (page-scene kit,
 * lib/seals.ts). `showLabel` prints the word beside it; without it the word is the accessible name.
 * Unknown is dashed with a "?", never a smaller or fainter version of a known state. */
export default function SealMark({
  kind,
  size = 28,
  showLabel = false,
  decorative = false,
  className = "",
}: {
  kind: SealKind;
  size?: number;
  showLabel?: boolean;
  /** True when a printed word beside it already says the same thing. */
  decorative?: boolean;
  className?: string;
}) {
  const look = SEAL_LOOK[kind];
  const wax = kind === "alert" ? "#8c2a22" : kind === "notice" ? "#6b4d1a" : "none";
  const rim = kind === "alert" ? "#d9776a" : kind === "notice" ? "#d9a93e" : "#8a7a5a";
  const dash = kind === "unknown" ? "3 2.5" : undefined;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <svg
        viewBox="0 0 28 28"
        width={size}
        height={size}
        role={showLabel || decorative ? undefined : "img"}
        aria-label={showLabel || decorative ? undefined : look.label}
        aria-hidden={showLabel || decorative ? true : undefined}
      >
        {look.shape === "triangle" ? (
          <path d="M14 3 L26 24 H2 Z" fill={wax} stroke={rim} strokeWidth="1.6" strokeLinejoin="round" />
        ) : look.shape === "circle" ? (
          <circle cx="14" cy="14" r="11" fill={wax} stroke={rim} strokeWidth="1.6" />
        ) : (
          <circle cx="14" cy="14" r="10.5" fill="none" stroke={rim} strokeWidth="1.6" strokeDasharray={dash} />
        )}
        {look.glyph && (
          <text
            x="14"
            y={look.shape === "triangle" ? 21 : 19}
            textAnchor="middle"
            fontSize="13"
            fontWeight="700"
            fontFamily="Georgia, serif"
            fill={kind === "unknown" ? "#8a7a5a" : "#fbe9c2"}
          >
            {look.glyph}
          </text>
        )}
      </svg>
      {showLabel && <span className="text-xs font-semibold">{look.label}</span>}
    </span>
  );
}
