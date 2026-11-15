import type { StopKind } from "./round";

/**
 * A small silhouette per stop kind, so the shape says the kind (not the colour): a bird with wings out, a tall thin column,
 * a bell on a post, a hanging lamp, pinned sheets. Drawn in `currentColor`, hidden from screen readers (the line says it).
 */
const PATHS: Record<StopKind, string> = {
  raven: "M1 4 L6 7 L8 3 L10 7 L15 4 L11 10 L8 9 L5 10 Z",
  smoke: "M7 15 C5 12 9 10 7 7 C5 4 9 3 8 1 C11 4 9 7 10 10 C11 13 9 14 9 15 Z",
  bell: "M8 1 V3 M4 12 C4 7 5 4 8 4 C11 4 12 7 12 12 Z M7 13 H9 V15 H7 Z",
  stall: "M8 1 V4 M5 6 H11 L12 11 H4 Z M6 13 H10",
  notice: "M2 3 H10 V12 H2 Z M6 5 H14 V14 H6 Z",
};

export default function RoundGlyph({ kind }: { kind: StopKind }) {
  const filled = kind === "raven" || kind === "smoke";
  return (
    <svg aria-hidden="true" data-glyph={kind} viewBox="0 0 16 16" width="14" height="14" className="mr-1 inline-block align-[-2px]"
      fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round">
      <path d={PATHS[kind]} />
    </svg>
  );
}
