import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useCachedQuery } from "../lib/queryCache";
import { loadOpened } from "../lib/scrolls";
import { SURVEY_CHECKS, SURVEY_VERSION, commissionsFor, fogLevel, surveyRealm, surveyText } from "../lib/survey";
import type { TowerFog } from "../lib/survey";
import type { Competence, DocumentSummary, GameState, Records } from "../lib/types";
import { weightText } from "../lib/rituals";
import { Card, EmptyState, PageHeader } from "../components/ui";

/** The Cartographer's table (game mode G34 and G35): the realm as a map of fog. Each tower shows
 * five plain facts, clear or still in fog; the commissions below are the same fog grouped by what
 * would clear it, each ending at an existing page. Progress here is a map, not a score: nothing is
 * granted for buying, selling, visiting or speed, there is no streak, and fog comes back when an
 * analysis ages. A fully clear tower is only a well-understood one, never a good one. Read-only. */

function useRealmDocuments(state: GameState | null): Record<string, DocumentSummary[] | null> | null {
  const [docs, setDocs] = useState<Record<string, DocumentSummary[] | null> | null>(null);
  const ids = state && !state.demo ? state.towers.map((t) => t.holding_id).join(",") : "";
  useEffect(() => {
    if (!state) return;
    if (state.demo || ids === "") {
      setDocs({});
      return;
    }
    let live = true;
    void Promise.all(
      ids.split(",").map((id) =>
        api
          .listDocuments(id)
          .then((d) => [id, d] as const)
          .catch(() => [id, null] as const),
      ),
    ).then((pairs) => live && setDocs(Object.fromEntries(pairs)));
    return () => {
      live = false;
    };
  }, [state, ids]);
  return docs;
}

function Fog({ tower }: { tower: TowerFog }) {
  const level = fogLevel(tower);
  return (
    <li className="rounded-md border border-border p-3">
      <div className="flex items-baseline justify-between gap-2">
        <Link to={`/holdings/${tower.holdingId}`} className="text-sm font-semibold text-accent hover:underline">
          {tower.name}
        </Link>
        <span className="text-xs text-ink-faint">{weightText(tower.weightPct === null ? null : String(tower.weightPct))}</span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-raised"
        role="img"
        aria-label={`${tower.name}: ${surveyText(tower)}`}
      >
        <div className="h-full bg-positive" style={{ width: `${Math.round((1 - level) * 100)}%` }} />
      </div>
      <p className="mt-1 text-xs text-ink-muted">{surveyText(tower)}</p>
      <ul className="mt-2 space-y-0.5 text-xs">
        {tower.checks.map((c) => (
          <li key={c.id} title={c.reason} className={c.state === "clear" ? "text-ink" : "text-ink-faint"}>
            <span aria-hidden="true">{c.state === "clear" ? "● " : c.state === "fog" ? "○ " : "– "}</span>
            {c.label}
            <span className="sr-only">: {c.state === "clear" ? "clear" : c.state === "fog" ? "in fog" : "not judged"}. {c.reason}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}

export default function CartographerPage() {
  const stateQ = useCachedQuery<GameState>("game-state", () => api.getGameState());
  const compQ = useCachedQuery<Competence>("game-competence", () => api.getCompetence());
  const recQ = useCachedQuery<Records>("game-records", () => api.getRecords());
  const docs = useRealmDocuments(stateQ.data);
  const opened = useMemo(() => loadOpened(), []);

  useEffect(() => {
    document.title = "Cartographer's table · Aladdin";
  }, []);

  const state = stateQ.data;
  const towers = useMemo(
    () =>
      state && docs
        ? surveyRealm({
            state,
            competence: compQ.data,
            records: recQ.data ? recQ.data.records : null,
            documents: docs,
            opened,
          })
        : null,
    [state, docs, compQ.data, recQ.data, opened],
  );
  const commissions = useMemo(() => (state && towers ? commissionsFor(towers, state) : []), [state, towers]);
  const error = stateQ.error;

  return (
    <div>
      <PageHeader
        title="Cartographer's table"
        subtitle="Which parts of the realm you have surveyed, and which are still in fog."
        actions={
          <Link to="/fortress" className="text-sm text-accent hover:underline">
            Back to the Fortress
          </Link>
        }
      />
      {error && !state && <EmptyState>{error}</EmptyState>}
      {!error && !towers && <p className="text-sm text-ink-muted">Unrolling the map…</p>}
      {state && towers && (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="section-title mb-0">The map</h2>
              {state.demo && (
                <span className="rounded-full bg-caution-subtle px-2.5 py-0.5 text-xs font-semibold text-caution">Demo data</span>
              )}
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              Five facts per tower: {SURVEY_CHECKS.map((c) => c.label.toLowerCase()).join(", ")}. This is a map of what you have
              looked at, not a score: a clear tower is understood, not good, and fog returns when an analysis ages. Opened
              reports are remembered on this browser only.
            </p>
            {towers.length === 0 ? (
              <EmptyState>No towers yet.</EmptyState>
            ) : (
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Fog by tower">
                {towers.map((t) => (
                  <Fog key={t.holdingId} tower={t} />
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <h2 className="section-title">Commissions</h2>
            {commissions.length === 0 ? (
              <p className="text-sm text-ink-muted">Nothing is in fog by these five facts. That says what you have looked at, not that all is well.</p>
            ) : (
              <ol className="divide-y divide-border-subtle" aria-label="Commissions">
                {commissions.map((c) => (
                  <li key={c.id} className="py-3">
                    <h3 className="text-sm font-semibold text-ink">{c.title}</h3>
                    <p className="mt-1 text-sm text-ink-muted">{c.text}</p>
                    {c.holdings.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-2 text-sm">
                        {c.holdings.map((h) => (
                          <li key={h.holdingId} className="rounded-md border border-border px-2 py-1">
                            {h.holdingId ? (
                              <Link
                                to={c.id === "report" || c.id === "valuation" ? `/holdings/${h.holdingId}${c.id === "report" ? "?tab=documents" : "?tab=analysis"}` : `/holdings/${h.holdingId}`}
                                className="text-accent hover:underline"
                              >
                                {h.name}
                              </Link>
                            ) : (
                              h.name
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {c.to && (
                      <p className="mt-2 text-xs">
                        <Link to={c.to} className="text-accent hover:underline">
                          {c.linkLabel}
                        </Link>
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-3 text-xs text-ink-faint">Rules {SURVEY_VERSION}. Finishing a commission earns nothing.</p>
          </Card>
        </div>
      )}
    </div>
  );
}
