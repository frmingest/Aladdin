import type { WorldModel } from "./stateToWorld";
import { towerFacts } from "./towerFacts";

interface Props {
  world: WorldModel;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

/**
 * The facts live here, not in the 3D scene: the scene is for mood and
 * walking, this list says exactly what each tower stands for. Unknown stays
 * "not surveyed" in the words, same as the fog in the picture.
 */
export default function TowerPanel({ world, loading, error, onRetry }: Props) {
  return (
    <aside
      aria-label="Your towers in words"
      className="absolute bottom-3 right-3 top-12 w-72 max-w-[40%] overflow-y-auto rounded border border-border bg-surface/95 p-3 text-sm text-ink"
    >
      <h2 className="text-sm font-semibold">Your towers</h2>
      {world.demo && <p className="mt-1 rounded bg-amber-100 px-2 py-1 text-xs text-amber-900">Sample fortress, not your holdings.</p>}
      {loading && <p className="mt-2 text-ink-muted">Counting your towers...</p>}
      {error && (
        <div className="mt-2">
          <p className="text-ink-muted">{error}</p>
          <button type="button" onClick={onRetry} className="mt-1 rounded border border-border px-2 py-1 text-xs hover:opacity-80">
            Try again
          </button>
        </div>
      )}
      {!loading && !error && world.plain.length === 0 && <p className="mt-2 text-ink-muted">No towers yet. The pads are bare.</p>}
      <ol className="mt-2 space-y-2">
        {world.plain.map((t) => (
          <li key={t.holdingId} className="border-t border-border pt-2 first:border-0 first:pt-0">
            <p className="font-medium">
              {t.name}
              {t.slot >= world.towers.length && <span className="ml-1 text-xs font-normal text-ink-muted">(not on a pad)</span>}
            </p>
            <p className="text-xs text-ink-muted">{towerFacts(t)}</p>
          </li>
        ))}
      </ol>
      {world.hiddenCount > 0 && (
        <p className="mt-2 text-xs text-ink-muted">{world.hiddenCount} more than the courtyard has pads for. All are listed above.</p>
      )}
    </aside>
  );
}
