import { useId } from "react";
import type { CompetenceLevel } from "../../../lib/types";

/** The four marks of the Circle, one shape each (page-scene kit): solid = I know this, half = on the
 * edge (the half toward the circle's centre is filled), hollow with cross-hatch = outside, dashed with
 * a "?" = unmarked. Drawn in currentColor so it follows its parent, with no green, red or amber: the
 * level is carried by the shape, the pattern and the printed word beside it, never by hue. The "?" is
 * a real HTML character at a readable size. `rotate` turns the half mark so its filled half faces the
 * centre of the map. */
export default function CircleGlyph({
  level,
  size = 24,
  rotate = 0,
  fluid = false,
  className = "",
}: {
  level: CompetenceLevel | null;
  size?: number;
  rotate?: number;
  /** Fill the parent instead of a fixed pixel size (the ring map scales its markers with the map). */
  fluid?: boolean;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const q = Math.max(14, Math.round(size * 0.45));
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center ${className}`} style={{ width: fluid ? "100%" : size, height: fluid ? "100%" : size }} aria-hidden>
      <svg viewBox="0 0 40 40" width={fluid ? "100%" : size} height={fluid ? "100%" : size} className="absolute inset-0">
        {level === "outside" && (
          <defs>
            <pattern id={`cg-hatch-${id}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <path d="M0 0 V6" stroke="currentColor" strokeWidth="1.6" />
            </pattern>
          </defs>
        )}
        {level === "know" && <circle cx="20" cy="20" r="17.5" fill="currentColor" stroke="currentColor" strokeWidth="2" />}
        {level === "partly" && (
          <g transform={`rotate(${rotate} 20 20)`}>
            <path d="M2.5 20 a17.5 17.5 0 0 0 35 0 Z" fill="currentColor" />
            <circle cx="20" cy="20" r="17.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
          </g>
        )}
        {level === "outside" && (
          <>
            <circle cx="20" cy="20" r="17.5" fill={`url(#cg-hatch-${id})`} fillOpacity="0.7" />
            <circle cx="20" cy="20" r="17.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
          </>
        )}
        {level === null && <circle cx="20" cy="20" r="17.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeDasharray="5 3.5" />}
      </svg>
      {level === null && (
        <span className="relative font-bold leading-none" style={{ fontSize: q, fontFamily: "Georgia, serif" }}>
          ?
        </span>
      )}
    </span>
  );
}
