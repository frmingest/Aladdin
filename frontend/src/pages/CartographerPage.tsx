import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useGameMode } from "../lib/gameMode";
import { usePlainView } from "../lib/plainView";
import { useCachedQuery } from "../lib/queryCache";
import { MAP_COPY } from "../lib/realmMap";
import { loadOpened } from "../lib/scrolls";
import { SURVEY_VERSION, commissionsFor, surveyRealm } from "../lib/survey";
import type { Competence, DocumentSummary, GameState, Records } from "../lib/types";
import GameFooter from "../components/fortress/GameFooter";
import RealmMapBody from "../components/fortress/kit/RealmMapBody";
import { EmptyState, PageHeader } from "../components/ui";

/** The Cartographer's table (game mode G34 and G35): the realm as a map of fog. Each tower shows
 * five plain facts as fog patches, clear or still in fog; the commissions are the same fog grouped by
 * what would clear it, each ending at an existing page. Progress here is a map, not a score: nothing
 * is granted for buying, selling, visiting or speed, there is no streak, and fog comes back when an
 * analysis ages. A fully clear tower is only a well-understood one, never a good one. Read-only.
 *
 * Identity pass (wins 1 to 4): fog patches instead of a bar, the painted banner and parchment, a
 * slate for the tower you press, numbered commission seals that plant flags. The drawn realm map is a
 * later change. Plain view and game mode off show the same facts as ordinary cards. */

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

export default function CartographerPage() {
  const stateQ = useCachedQuery<GameState>("game-state", () => api.getGameState());
  const compQ = useCachedQuery<Competence>("game-competence", () => api.getCompetence());
  const recQ = useCachedQuery<Records>("game-records", () => api.getRecords());
  const docs = useRealmDocuments(stateQ.data);
  const opened = useMemo(() => loadOpened(), []);
  const { gameMode } = useGameMode();
  const [plain] = usePlainView();

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
  const sectors = useMemo(() => Object.fromEntries((compQ.data?.towers ?? []).map((t) => [t.holding_id, t.sector])), [compQ.data]);
  const error = stateQ.error;

  return (
    <div>
      <PageHeader
        title="Cartographer's table"
        subtitle={MAP_COPY.subtitle}
        actions={
          <Link to="/fortress" className="inline-flex min-h-[44px] items-center text-sm text-accent hover:underline">
            Back to the Fortress
          </Link>
        }
      />
      {error && !state && <EmptyState>{error}</EmptyState>}
      {!error && !towers && <p className="text-sm text-ink-muted">Unrolling the map…</p>}
      {state && towers && (
        <div className="space-y-4">
          <RealmMapBody towers={towers} commissions={commissions} demo={state.demo} painted={gameMode && !plain} sectors={sectors} sectorsKnown={!!compQ.data} />
          <div className="map-foot">
            <GameFooter rules={`Rules ${SURVEY_VERSION}. Finishing a commission earns nothing.`} />
          </div>
        </div>
      )}
    </div>
  );
}
