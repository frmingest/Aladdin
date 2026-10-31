import { chipWords, hintWords } from "./standing";
import type { Standing } from "./standing";

/**
 * The Standing level, always visible, in words and in pips (filled or hollow, so it
 * never relies on colour). The next step is in the tooltip and read out by screen readers.
 */
export default function LevelChip({ standing }: { standing: Standing }) {
  const words = chipWords(standing);
  const hint = hintWords(standing);
  return (
    <div role="status" aria-label={hint ? `${words}. ${hint}` : words} title={hint || undefined} className="g3d-level absolute right-3 top-3 z-30">
      <span aria-hidden className="g3d-level-pips">
        {[0, 1, 2].map((i) => (
          <i key={i} className={standing.level > i ? "on" : ""}>{standing.level > i ? "●" : "○"}</i>
        ))}
      </span>
      <span>{words}</span>
    </div>
  );
}
