import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { layoutTowers } from "../lib/fortress";
import { formatDecimal, formatNok, formatPct100 } from "../lib/format";
import type { GameState, Ravens, Watchlist } from "../lib/types";
import { loadSeen, markSeen, ravenHoldingIds, saveSeen } from "../lib/ravens";
import { MARKET_PATH, orderStreet, shopFront } from "../lib/marketplace";
import FortressReports from "../components/fortress/FortressReports";
import FortressLedger from "../components/fortress/FortressLedger";
import MagicLamp from "../components/fortress/MagicLamp";
import NightWatchCard from "../components/fortress/NightWatchCard";
import FortressScene, { MarketPeek, RealmPeek, TowerPeek } from "../components/fortress/FortressScene";
import RealmVerdict from "../components/fortress/RealmVerdict";
import { REALM_LEVEL_LABEL, summarizeRealm } from "../lib/realmVerdict";
import { GameFrame, GameHud } from "../components/fortress/GameFrame";
import SoundToggle from "../components/fortress/SoundToggle";
import StudyDesk from "../components/fortress/StudyDesk";
import TowerSurvey from "../components/fortress/TowerSurvey";
import VaultCard from "../components/fortress/VaultCard";
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  SnapshotStamp,
} from "../components/ui";

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
  const [hoverId, setHoverId] = useState<string | null>(null);
  // The Great Keep and the walls stand for the whole fortress.
  const [realmSelected, setRealmSelected] = useState(false);
  const [realmHot, setRealmHot] = useState(false);
  // The Marketplace (G9) reads the watchlist; the fortress still draws if it cannot load.
  const [watch, setWatch] = useState<Watchlist | null>(null);
  const [marketHot, setMarketHot] = useState(false);
  // G15: ravens (recently captured reports) and which of them this browser has seen.
  const [ravens, setRavens] = useState<Ravens | null>(null);
  const [seenRavens, setSeenRavens] = useState<Set<string>>(() => loadSeen());
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .getGameState()
      .then(setState)
      .catch((e: unknown) =>
        setError(
          e instanceof ApiError ? e.message : "Could not load the fortress.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    document.title = "Fortress · Aladdin";
    load();
  }, [load]);

  useEffect(() => {
    api
      .getWatchlist()
      .then(setWatch)
      .catch(() => setWatch(null));
  }, []);

  useEffect(() => {
    api
      .getRavens()
      .then(setRavens)
      .catch(() => setRavens(null));
  }, []);

  const onRavensSeen = useCallback((ids: string[]) => {
    setSeenRavens((cur) => {
      const next = markSeen(cur, ids);
      saveSeen(next);
      return next;
    });
  }, []);
  const ravenIds = useMemo(() => ravenHoldingIds(ravens?.ravens ?? [], seenRavens), [ravens, seenRavens]);

  const market = useMemo(() => {
    const rows = orderStreet(watch?.rows ?? []);
    return {
      count: watch ? rows.length : null,
      inRange: rows.filter((r) => r.status === "buy_zone").length,
      tones: rows.map((r) => shopFront(r).tone),
      hot: marketHot,
      onOpen: () => navigate(MARKET_PATH),
      onHover: setMarketHot,
    };
  }, [watch, marketHot, navigate]);

  const layout = useMemo(() => layoutTowers(state?.towers ?? []), [state]);
  const selected =
    state?.towers.find((t) => t.holding_id === selectedId) ?? null;
  const hovered = state?.towers.find((t) => t.holding_id === hoverId) ?? null;
  const realm = useMemo(() => (state ? summarizeRealm(state) : null), [state]);

  const selectHolding = (id: string) => {
    setRealmSelected(false);
    setSelectedId((cur) => (cur === id ? null : id));
  };
  const selectRealm = () => {
    setSelectedId(null);
    setRealmSelected((cur) => !cur);
  };

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
            {state && <SoundToggle weather={state.siege?.level} />}
            <Button variant="secondary" onClick={load} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </Button>
          </>
        }
      />

      {error && (
        <Card className="mb-4 border-negative/40 bg-negative-subtle text-sm text-negative">
          {error}
        </Card>
      )}

      {!state && loading && <EmptyState>Raising the walls…</EmptyState>}

      {state && (
        <div className="space-y-4">
          <NightWatchCard />
          <Card className="p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div
                role="tablist"
                aria-label="Fortress view"
                className="inline-flex rounded-md border border-border p-0.5"
              >
                {(["scene", "ledger"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="tab"
                    aria-selected={view === v}
                    onClick={() => setView(v)}
                    className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                      view === v
                        ? "bg-accent-subtle text-ink"
                        : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    {v === "scene" ? "Scene" : "Ledger"}
                  </button>
                ))}
              </div>
              {view === "scene" && state.towers.length > 0 && realm && (
                <button
                  type="button"
                  onClick={selectRealm}
                  aria-pressed={realmSelected}
                  className={`rounded-md border px-3 py-1 text-sm font-medium transition-colors ${
                    realmSelected
                      ? "border-accent bg-accent-subtle text-ink"
                      : "border-border text-ink-muted hover:text-ink"
                  }`}
                  title="Same as pressing the keep or the walls"
                >
                  Verdict on the whole fortress ·{" "}
                  {REALM_LEVEL_LABEL[realm.level]}
                </button>
              )}
              <p className="text-xs text-ink-faint">
                {state.towers.length}{" "}
                {state.towers.length === 1 ? "holding" : "holdings"} ·{" "}
                <span className="tabular">
                  {formatNok(state.total_value_nok)}
                </span>
              </p>
            </div>

            {state.towers.length === 0 ? (
              <EmptyState>
                No holdings to build with yet. Upload a portfolio snapshot on
                the Portfolio page and the fortress will rise.
              </EmptyState>
            ) : view === "scene" ? (
              <>
                <GameFrame>
                  <GameHud state={state} />
                  <div className="game-frame-inner">
                    <FortressScene
                      layout={layout}
                      shantytown={state.diworsification.shantytown}
                      shackCount={state.diworsification.shack_count}
                      siege={state.siege}
                      selectedId={selectedId}
                      onSelect={selectHolding}
                      onHover={setHoverId}
                      realm={{ hot: realmHot, selected: realmSelected }}
                      realmLevel={realm?.level ?? "unknown"}
                      onRealmSelect={selectRealm}
                      onRealmHover={setRealmHot}
                      market={market}
                      ravenIds={ravenIds}
                    />
                  </div>
                </GameFrame>
                {/* Quick look sits beneath the frame so it never covers the other towers. */}
                <div className="fortress-peek-slot" aria-live="polite">
                  {hovered ? (
                    <TowerPeek tower={hovered} />
                  ) : marketHot ? (
                    <MarketPeek count={market.count} inRange={market.inRange} />
                  ) : realmHot ? (
                    <RealmPeek
                      count={state.towers.length}
                      oneLine={realm ? realm.oneLine : null}
                    />
                  ) : (
                    <p className="text-xs text-ink-faint">
                      Point at or tap a tower for a quick look. The keep and the
                      walls stand for the whole fortress.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <FortressLedger towers={state.towers} />
            )}
          </Card>

          {view === "scene" && state.towers.length > 0 && (
            <ul
              className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-ink-faint"
              aria-label="How to read the picture"
            >
              <li>Lit windows and a banner: analysed recently</li>
              <li>Ivy, then scaffolding: the analysis is ageing, then stale</li>
              <li>
                Gold sign (SALE / OFFER): price below the bear or base case
              </li>
              <li>Red sign (DEAR): above the bull case</li>
              <li>Flames, a hole and a red !: a tripwire has fired</li>
              <li>Amber i: something changed, review the thesis</li>
              <li>
                Ladders: hit hard in the stored stress what-if (shown only when
                the weather turns)
              </li>
              <li>Cracked wall between towers: they move together</li>
              <li>Fog, a ghost outline or a ?: not surveyed</li>
              <li>A raven on a roof: a new report was captured for that holding and you have not marked it seen</li>
              <li>Green ring: the tower or fortress part you selected</li>
              <li>Great Keep and walls: the whole portfolio. Towers: single holdings</li>
              <li>The market square below the walls: your watchlist. A lit lantern means that company is in the price range you named</li>
              <li>
                Water or dry ditch in front of the wall: that tower&apos;s moat,
                one stretch of one continuous moat
              </li>
            </ul>
          )}

          {view === "scene" &&
            state.towers.length > 0 &&
            (realmSelected && realm ? (
              <RealmVerdict
                verdict={realm}
                count={state.towers.length}
                onOpenHolding={selectHolding}
              />
            ) : selected ? (
              <TowerSurvey tower={selected} />
            ) : (
              <p className="px-1 text-sm text-ink-faint">
                Press a tower to read that holding's survey, or press the keep
                or the walls for the verdict on the whole fortress.
              </p>
            ))}

          <FortressReports state={state} ravens={ravens} seen={seenRavens} onSeen={onRavensSeen} />

          <Card className="py-3">
            <StudyDesk asOf={state.as_of} />
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <VaultCard vault={state.vault} demo={state.demo} onChanged={load} />
            <Card>
              <h2 className="section-title">Spread of the realm</h2>
              <p className="text-sm text-ink-muted">
                {SHANTY_TEXT[state.diworsification.shantytown]}
              </p>
              <dl className="tabular mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <dt className="text-ink-faint">Positions</dt>
                <dd className="text-right text-ink">
                  {state.diworsification.position_count}
                </dd>
                <dt className="text-ink-faint">Effective holdings</dt>
                <dd className="text-right text-ink">
                  {dec(state.diworsification.effective_holdings)}
                </dd>
                <dt className="text-ink-faint">Largest holding</dt>
                <dd className="text-right text-ink">
                  {formatPct100(state.diworsification.top1_pct)}
                </dd>
                <dt className="text-ink-faint">Top five together</dt>
                <dd className="text-right text-ink">
                  {formatPct100(state.diworsification.top5_pct)}
                </dd>
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
            Rules version {state.mapping_version}. Missing or stale data is
            drawn as scaffolding or fog, never as a guess. Nothing on this page
            trades, scores or rewards anything.
          </p>
        </div>
      )}
      <MagicLamp />
    </div>
  );
}
