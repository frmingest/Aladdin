import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../lib/api";
import { layoutTowers } from "../lib/fortress";
import { formatDecimal, formatNok, formatPct100 } from "../lib/format";
import type { GameState } from "../lib/types";
import FortressLedger from "../components/fortress/FortressLedger";
import FortressScene from "../components/fortress/FortressScene";
import TowerSurvey from "../components/fortress/TowerSurvey";
import VaultCard from "../components/fortress/VaultCard";
import { Button, Card, EmptyState, PageHeader, SnapshotStamp } from "../components/ui";

/** Game mode home (F33, G2). A read-only picture of the real portfolio built
 * from GET /game/state — stored data only, no provider or LLM call. It never
 * changes an analysis, a score or a stored row, and it rewards nothing:
 * there are no points, streaks or buy buttons. */

type View = "scene" | "ledger";

const dec = (v: string | null): string => (v === null ? "—" : formatDecimal(v));

const SHANTY_TEXT = {
  none: "No shantytown: no cluster of tiny positions.",
  light: "A few shacks: some tiny positions are scattered between the towers.",
  heavy: "A shantytown: many tiny positions, each too small to matter.",
} as const;

export default function FortressPage() {
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("scene");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .getGameState()
      .then(setState)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Could not load the fortress."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    document.title = "Fortress · Aladdin";
    load();
  }, [load]);

  const layout = useMemo(() => layoutTowers(state?.towers ?? []), [state]);
  const selected = state?.towers.find((t) => t.holding_id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader
        title="The Fortress"
        subtitle="Your real portfolio as a value investor's stronghold. Every wall, moat and size is decided by fixed rules from your stored analyses and balance sheets; nothing here is scored by a model."
        actions={
          <>
            {state?.demo && (
              <span className="rounded-full bg-caution-subtle px-2.5 py-1 text-xs font-semibold text-caution">
                Demo data
              </span>
            )}
            <SnapshotStamp at={state?.as_of} />
            <Button variant="secondary" onClick={load} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </Button>
          </>
        }
      />

      {error && (
        <Card className="mb-4 border-negative/40 bg-negative-subtle text-sm text-negative">{error}</Card>
      )}

      {!state && loading && <EmptyState>Raising the walls…</EmptyState>}

      {state && (
        <div className="space-y-4">
          <Card className="p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div role="tablist" aria-label="Fortress view" className="inline-flex rounded-md border border-border p-0.5">
                {(["scene", "ledger"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="tab"
                    aria-selected={view === v}
                    onClick={() => setView(v)}
                    className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                      view === v ? "bg-accent-subtle text-ink" : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    {v === "scene" ? "Scene" : "Ledger"}
                  </button>
                ))}
              </div>
              <p className="text-xs text-ink-faint">
                {state.towers.length} {state.towers.length === 1 ? "holding" : "holdings"} ·{" "}
                <span className="tabular">{formatNok(state.total_value_nok)}</span>
              </p>
            </div>

            {state.towers.length === 0 ? (
              <EmptyState>
                No holdings to build with yet. Upload a portfolio snapshot on the Portfolio page and the
                fortress will rise.
              </EmptyState>
            ) : view === "scene" ? (
              <div className="overflow-x-auto">
                <FortressScene
                  layout={layout}
                  shantytown={state.diworsification.shantytown}
                  shackCount={state.diworsification.shack_count}
                  selectedId={selectedId}
                  onSelect={(id) => setSelectedId((cur) => (cur === id ? null : id))}
                />
              </div>
            ) : (
              <FortressLedger towers={state.towers} />
            )}
          </Card>

          {view === "scene" && state.towers.length > 0 && (
            selected ? (
              <TowerSurvey tower={selected} />
            ) : (
              <p className="px-1 text-sm text-ink-faint">Press a tower to read its survey.</p>
            )
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <VaultCard vault={state.vault} />
            <Card>
              <h2 className="section-title">Spread of the realm</h2>
              <p className="text-sm text-ink-muted">{SHANTY_TEXT[state.diworsification.shantytown]}</p>
              <dl className="tabular mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <dt className="text-ink-faint">Positions</dt>
                <dd className="text-right text-ink">{state.diworsification.position_count}</dd>
                <dt className="text-ink-faint">Effective holdings</dt>
                <dd className="text-right text-ink">{dec(state.diworsification.effective_holdings)}</dd>
                <dt className="text-ink-faint">Largest holding</dt>
                <dd className="text-right text-ink">{formatPct100(state.diworsification.top1_pct)}</dd>
                <dt className="text-ink-faint">Top five together</dt>
                <dd className="text-right text-ink">{formatPct100(state.diworsification.top5_pct)}</dd>
              </dl>
            </Card>
          </div>

          {state.notes.length > 0 && (
            <Card className="bg-raised">
              <h2 className="section-title">What the survey could not see</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
                {state.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </Card>
          )}

          <p className="px-1 text-xs text-ink-faint">
            Rules version {state.mapping_version}. Missing or stale data is drawn as scaffolding or fog,
            never as a guess. Nothing on this page trades, scores or rewards anything.
          </p>
        </div>
      )}
    </div>
  );
}
