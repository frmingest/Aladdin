import { CLEAR_WORD, RING_LABEL, SEGMENT_WORD } from "../../../lib/circleMap";
import { formatDate } from "../../../lib/format";
import type { CompetenceLevel } from "../../../lib/types";
import CircleGlyph from "./CircleGlyph";
import "./circleMap.css";

/** The three-state mark control (Circle page): Know, Edge, Outside, each with its own shape and
 * printed word, and a "Clear mark" action. Real radio buttons, so the arrow keys and Tab work; no radio
 * is selected while a sector is unmarked, and that is shown as unmarked, never as a default. The
 * selected one is inverted (light on dark) and thick-bordered, so it does not depend on hue. Only the
 * row's own Save writes anything. */
export default function MarkControl({
  sector,
  groupId,
  value,
  disabled,
  onChange,
}: {
  sector: string;
  groupId: string;
  value: CompetenceLevel | "";
  disabled: boolean;
  onChange: (v: CompetenceLevel | "") => void;
}) {
  const levels = Object.keys(SEGMENT_WORD) as CompetenceLevel[];
  return (
    <fieldset className="flex min-w-0 flex-wrap items-center gap-x-3">
      <legend className="sr-only">{sector}: how well you know it</legend>
      <div className="mark-seg">
        {levels.map((l) => (
          <label key={l} className="mark-seg-item">
            <input
              type="radio"
              name={groupId}
              value={l}
              checked={value === l}
              disabled={disabled}
              onChange={() => onChange(l)}
            />
            <span className="mark-seg-chip">
              <CircleGlyph level={l} size={20} />
              {SEGMENT_WORD[l]}
            </span>
          </label>
        ))}
      </div>
      {value !== "" && !disabled && (
        <button type="button" className="mark-clear" aria-label={`${CLEAR_WORD}: ${sector}`} onClick={() => onChange("")}>
          Clear
        </button>
      )}
    </fieldset>
  );
}

/** The boundary stone beside a sector's name: the saved mark as a small pebble with its shape, the
 * date it was set, and a scroll glyph when a note is written. Unmarked is a dashed stone with a "?". */
export function BoundaryStone({ level, markedAt, hasNote }: { level: CompetenceLevel | null; markedAt: string | null; hasNote: boolean }) {
  const word = level === null ? RING_LABEL.fog : SEGMENT_WORD[level];
  return (
    <span className="circle-stone" data-unmarked={level === null ? "true" : undefined}>
      <CircleGlyph level={level} size={18} />
      <span>{level === null || !markedAt ? word : `${word}, ${formatDate(markedAt)}`}</span>
      {hasNote && (
        <svg viewBox="0 0 16 16" width="14" height="14" role="img" aria-label="has a note">
          <path d="M3 2 h8 a2 2 0 0 1 2 2 v8 a2 2 0 0 1 -2 2 h-8 Z M5.5 6 h5 M5.5 9 h5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}
