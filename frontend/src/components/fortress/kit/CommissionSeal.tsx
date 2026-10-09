import { MAP_COLORS as C } from "../../../lib/realmMap";
import type { CommissionShape } from "../../../lib/realmMap";

/** A commission's wax seal (Cartographer's table, win 4): a shape for the kind of commission and its
 * number in the list. Shape + number + the title beside it carry the meaning; the brown and gilt are
 * ornament. Nothing here is green and nothing marks a commission as done. */

function Body({ shape }: { shape: CommissionShape }) {
  const fill = C.wax;
  const stroke = C.gilt;
  const sw = 1.6;
  switch (shape) {
    case "square":
      return <rect x="4" y="4" width="20" height="20" rx="2.5" fill={fill} stroke={stroke} strokeWidth={sw} />;
    case "hexagon":
      return <path d="M14 2.5 L24 8.2 V19.8 L14 25.5 L4 19.8 V8.2 Z" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
    case "diamond":
      return <path d="M14 2 L26 14 L14 26 L2 14 Z" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
    case "triangle-down":
      return <path d="M2.5 4.5 H25.5 L14 25 Z" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
    case "ring":
      return (
        <g>
          <circle cx="14" cy="14" r="11.5" fill={fill} stroke={stroke} strokeWidth={sw} />
          <circle cx="14" cy="14" r="8" fill="none" stroke={C.cream} strokeWidth="1" />
        </g>
      );
    case "coin":
      return <circle cx="14" cy="14" r="10.5" fill={fill} stroke={stroke} strokeWidth="3.4" />;
  }
}

export default function CommissionSeal({
  shape,
  n,
  size = 32,
  pressed = false,
}: {
  shape: CommissionShape;
  n: number;
  size?: number;
  /** Adds an outer ring (a shape change) to the seal that is currently planted on the map. */
  pressed?: boolean;
}) {
  return (
    <svg viewBox="0 0 28 28" width={size} height={size} aria-hidden focusable="false" data-seal={shape}>
      {pressed && <circle cx="14" cy="14" r="13.2" fill="none" stroke={C.ink} strokeWidth="1.2" />}
      <Body shape={shape} />
      <text x="14" y={shape === "triangle-down" ? 16 : 18.6} textAnchor="middle" fontSize="12.5" fontWeight="700" fontFamily="Georgia, serif" fill={C.cream}>
        {n}
      </text>
    </svg>
  );
}

/** The flag a pressed commission plants on a tower: a pole and the same numbered seal. Decoration over
 * the tower button (the numbered list is the source of truth), so it is hidden from assistive tech. */
export function FlagMark({ shape, n }: { shape: CommissionShape; n: number }) {
  return (
    <span aria-hidden className="pointer-events-none absolute right-1 top-1 block" data-flag={n}>
      <svg viewBox="0 0 28 44" width="28" height="44" focusable="false">
        <line x1="14" y1="26" x2="14" y2="43" stroke={C.ink} strokeWidth="2" strokeLinecap="round" />
        <g transform="translate(0 -1)">
          <Body shape={shape} />
          <text x="14" y={shape === "triangle-down" ? 16 : 18.6} textAnchor="middle" fontSize="12.5" fontWeight="700" fontFamily="Georgia, serif" fill={C.cream}>
            {n}
          </text>
        </g>
      </svg>
    </span>
  );
}
