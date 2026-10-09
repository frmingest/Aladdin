import type { CrestKind } from "../../../lib/crest";

/** Heraldic crest for a game page header (page-scene kit). One small painted shield per room; the
 * glyph is decoration that names the room, it never encodes a status. Fixed colours, like the other
 * painted pieces, so it reads the same in both themes. */


function Glyph({ kind }: { kind: CrestKind }) {
  const ink = { stroke: "#f2d27a", strokeWidth: 1.6, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  switch (kind) {
    case "council":
      return (
        <g {...ink}>
          <ellipse cx="20" cy="21" rx="9" ry="5" fill="#f2d27a" fillOpacity="0.25" />
          <circle cx="9" cy="21" r="1.6" />
          <circle cx="31" cy="21" r="1.6" />
          <circle cx="20" cy="12.5" r="1.6" />
          <circle cx="20" cy="29.5" r="1.6" />
        </g>
      );
    case "circle":
      return (
        <g {...ink}>
          <circle cx="20" cy="21" r="10" />
          <path d="M20 8.5 v4 M20 29.5 v4 M7.5 21 h4 M28.5 21 h4" />
          <circle cx="20" cy="21" r="1.8" fill="#f2d27a" />
        </g>
      );
    case "map":
      return (
        <g {...ink}>
          <path d="M9 12 l7 -2 l8 2 l7 -2 v19 l-7 2 l-8 -2 l-7 2 Z" fill="#f2d27a" fillOpacity="0.2" />
          <path d="M16 10 v19 M24 12 v19" />
        </g>
      );
    case "records":
      return (
        <g {...ink}>
          <path d="M20 14 q-6 -3 -11 -1 v16 q5 -2 11 1 q6 -3 11 -1 v-16 q-5 -2 -11 1 Z" fill="#f2d27a" fillOpacity="0.2" />
          <path d="M20 14 v16" />
        </g>
      );
    case "chronicle":
      return (
        <g {...ink}>
          <path d="M11 12 h18 v17 h-18 Z" fill="#f2d27a" fillOpacity="0.2" />
          <path d="M15 17 h10 M15 21 h10 M15 25 h6" />
        </g>
      );
    case "siege":
      return (
        <g {...ink}>
          <path d="M12 31 V13 M18 31 V13 M12 17 h6 M12 22 h6 M12 27 h6" />
          <path d="M22 13 h9 v18 h-9 Z M22 17 h3 M28 17 h3" fill="#f2d27a" fillOpacity="0.2" />
        </g>
      );
    case "market":
      return (
        <g {...ink}>
          <path d="M9 17 q11 -9 22 0 Z" fill="#f2d27a" fillOpacity="0.25" />
          <path d="M11 17 v12 M29 17 v12 M11 29 h18" />
        </g>
      );
    default:
      return (
        <g {...ink}>
          <path d="M13 31 V15 h3 v3 h3 v-3 h2 v3 h3 v-3 h3 v16 Z" fill="#f2d27a" fillOpacity="0.2" />
          <path d="M18 31 v-6 h4 v6" />
        </g>
      );
  }
}

export default function Crest({ kind, className = "h-11 w-11" }: { kind: CrestKind; className?: string }) {
  return (
    <svg viewBox="0 0 40 44" className={`shrink-0 ${className}`} aria-hidden>
      <path d="M3 3 H37 V24 Q37 37 20 42 Q3 37 3 24 Z" fill="#3a2414" stroke="#d9a93e" strokeWidth="1.6" />
      <path d="M6 6 H34 V24 Q34 34 20 39 Q6 34 6 24 Z" fill="none" stroke="#7a5418" strokeWidth="0.8" />
      <Glyph kind={kind} />
    </svg>
  );
}
