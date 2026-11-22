import { LOADING_BAR_LABEL } from "./loadingWordsV1";

/**
 * The loading line (#479): a small parchment card in the middle of the scene while the world or a place is still being
 * drawn, so an empty sky or a dark room never looks like a broken page. Kit pieces only (`g3d-panel`, `g3d-bar`). Nothing
 * moves: the bar's width follows the loader's own percent with no transition, so reduced motion needs nothing. It never
 * takes a click; the toolbar stays usable under it.
 */
export default function LoadingLine({ text, percent }: { text: string; percent: number | null }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <div className="g3d-panel g3d-loading px-4 py-3 text-sm" role="status" aria-live="polite">
        <p>
          <span aria-hidden>🏰 </span>
          {text}
        </p>
        {percent !== null && (
          <div className="g3d-bar" role="progressbar" aria-label={LOADING_BAR_LABEL} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
            <i style={{ width: `${percent}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}
