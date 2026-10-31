import type { WorldModel } from "./stateToWorld";
import { MOAT_LABEL, SIZE_LABEL, THESIS_LABEL, WALL_LABEL } from "../lib/fortress";

interface Props {
  world: WorldModel;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onClose?: () => void;
}

type Tone = "good" | "warn" | "bad" | "fog" | "";

/** Colour is never the only signal: each tone also has its own mark in front of the words. */
const MARK: Record<Tone, string> = { good: "✓ ", warn: "! ", bad: "✕ ", fog: "? ", "": "" };

const WALL_TONE: Record<string, Tone> = { basalt: "good", granite: "good", brick: "warn", timber: "warn", rotted: "bad" };
const MOAT_TONE: Record<string, Tone> = { wide: "good", narrow: "warn", none: "bad" };
const THESIS_TONE: Record<string, Tone> = { intact: "good", review: "warn", breached: "bad" };

function Chip({ tone, children }: { tone: Tone; children: string }) {
  return (
    <li className={`g3d-chip ${tone}`}>
      {MARK[tone]}
      {children}
    </li>
  );
}

/**
 * The facts live here, not in the 3D scene: the scene is for mood and
 * walking, this list says exactly what each tower stands for. Unknown stays
 * "not surveyed" in the words, same as the fog in the picture.
 */
export default function TowerPanel({ world, loading, error, onRetry, onClose }: Props) {
  return (
    <aside
      aria-label="Your towers in words"
      className="g3d-panel g3d-slide absolute bottom-3 right-3 top-14 z-20 w-72 max-w-[40%] overflow-y-auto p-3 text-sm"
    >
      <header className="g3d-head">
        <h2>🏰 Your towers</h2>
        {onClose && (
          <button type="button" className="g3d-x" aria-label="Close towers" onClick={onClose}>×</button>
        )}
      </header>
      {world.demo && <p className="g3d-demo">Sample fortress, not your holdings.</p>}
      {loading && <p className="g3d-muted mt-2">Counting your towers...</p>}
      {error && (
        <div className="mt-2">
          <p className="g3d-muted">{error}</p>
          <button type="button" onClick={onRetry} className="g3d-btn mt-2">Try again</button>
        </div>
      )}
      {!loading && !error && world.plain.length === 0 && <p className="g3d-muted mt-2">No towers yet. The pads are bare.</p>}
      <ol className="mt-2 space-y-2">
        {world.plain.map((t) => {
          const f = t.facts;
          return (
            <li key={t.holdingId} className="g3d-card !mt-0">
              <div className="flex items-baseline justify-between gap-2">
                <h3>{t.name}</h3>
                {f.weightPct !== null && <span className="g3d-weight">{Math.round(Number(f.weightPct))}%</span>}
              </div>
              {t.slot >= world.towers.length && <p className="g3d-muted">(not on a pad)</p>}
              <ul className="mt-2 flex flex-wrap gap-1">
                <Chip tone={WALL_TONE[f.wall] ?? "fog"}>{WALL_LABEL[f.wall]}</Chip>
                <Chip tone={MOAT_TONE[f.moat] ?? "fog"}>{MOAT_LABEL[f.moat]}</Chip>
                <Chip tone="">{SIZE_LABEL[f.size]}</Chip>
                <Chip tone={THESIS_TONE[f.thesis] ?? "fog"}>{THESIS_LABEL[f.thesis]}</Chip>
                {t.gap && <Chip tone="fog">{`Gap: ${t.gap}`}</Chip>}
              </ul>
            </li>
          );
        })}
      </ol>
      {world.hiddenCount > 0 && (
        <p className="g3d-muted mt-2">{world.hiddenCount} more than the courtyard has pads for. All are listed above.</p>
      )}
    </aside>
  );
}
