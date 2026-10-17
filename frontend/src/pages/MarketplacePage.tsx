import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useDemoMode } from "../lib/demoMode";
import { formatPct100, formatPrice } from "../lib/format";
import { boothNumeral, orderStreet, shopFront, shopPips, storePath } from "../lib/marketplace";
import type { Watchlist, WatchlistRow } from "../lib/types";
import { Awning, Pip } from "../components/marketplace/MarketArt";
import HypeBoothDialog from "../components/marketplace/HypeBoothDialog";
import SalesRepDialog from "../components/marketplace/SalesRepDialog";
import MarketStreet, { FlagKey } from "../components/marketplace/MarketStreet";
import { useArtMode } from "../lib/stitchArt";
import { SalesRep } from "../components/marketplace/SalesRepArt";
import ObjectArtImage from "../components/ObjectArtImage";
import { TONE_PAINT } from "../lib/marketplacePaint";
import { stallArtId } from "../lib/marketArt";
import "../components/marketplace/stall.css";
import { Button, Disclosure, EmptyState, LoadError, PageHeader, SnapshotStamp, VerdictBadge } from "../components/ui";
import { describeError } from "../lib/errors";

/** The Marketplace street (game mode, G9): one store per watchlist company. The shop window
 * shows only what the watchlist already knows (your price against the quote, the stored moat
 * and verdict, the age of the analysis). Open a store for the full appraisal. Read-only. */

function Stall({ row, place }: { row: WatchlistRow; place: number }) {
  const front = shopFront(row);
  const paint = TONE_PAINT[front.tone];
  const pips = shopPips(row);
  const d = row.distance_to_buy_pct === null ? null : Number(row.distance_to_buy_pct);
  const analysed = row.verdict_rating !== null || row.moat_rating !== null;
  return (
    <Link
      to={storePath(row.holding_id)}
      className="market-stall group block overflow-hidden rounded-lg border border-border bg-surface transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5"
      style={{ "--stall-tone": paint.a } as React.CSSProperties}
    >
      <ObjectArtImage
        id={stallArtId(row.holding_id)}
        width={104}
        className="stall-art"
        fallback={<Awning a={paint.a} b={paint.b} stripes={8} className="market-awning-sm" />}
      />
      <div className="stall-plate">
        <span className="stall-numeral" aria-hidden>
          {boothNumeral(place)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg leading-tight text-ink">{row.name}</p>
          <p className="text-xs text-ink-faint">
            {row.ticker}
            {row.sector ? ` · ${row.sector}` : ""}
          </p>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="stall-tag">{front.tag}</span>
          {row.owned && <span className="rounded-full bg-accent-subtle px-2 py-0.5 font-medium text-ink">In your fortress</span>}
        </div>

        <dl className="stall-ledger tabular grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
          <dt className="text-ink-faint">Price</dt>
          <dd className="text-right text-ink">{row.price ? formatPrice(row.price, row.price_currency) : "—"}</dd>
          <dt className="text-ink-faint">Your price</dt>
          <dd className="text-right text-ink">{row.buy_below_price ? formatPrice(row.buy_below_price, row.buy_below_currency) : "not named"}</dd>
          {d !== null && (
            <>
              <dt className="text-ink-faint">Versus yours</dt>
              <dd className={`text-right ${d <= 0 ? "text-positive" : "text-ink-muted"}`}>
                {d > 0 ? "+" : ""}
                {formatPct100(String(d), 0)}
              </dd>
            </>
          )}
        </dl>

        <div className="flex items-center justify-between gap-2 border-t border-border-subtle pt-3">
          {analysed ? (
            <>
              <div className="flex items-center gap-1" aria-label="Gates the shop window can show">
                {pips.map((p) => (
                  <Pip key={p.id} gate={p} size={18} />
                ))}
              </div>
              <VerdictBadge rating={row.verdict_rating} title="Stored analyst verdict" />
            </>
          ) : (
            <p className="text-xs text-ink-faint">Not analysed yet</p>
          )}
        </div>
        <p className="stall-enter">Enter the store →</p>
      </div>
    </Link>
  );
}

/** A store with no price of yours to compare, as one line: name, what the window knows, the way in. */
function CompactStall({ row }: { row: WatchlistRow }) {
  return (
    <li>
      <Link
        to={storePath(row.holding_id)}
        className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-border-subtle py-2 text-sm hover:bg-raised"
      >
        <span className="font-medium text-ink">
          {row.name} <span className="text-xs font-normal text-ink-faint">{row.ticker}</span>
        </span>
        <span className="flex items-center gap-2 text-xs text-ink-muted">
          {row.verdict_rating ? <VerdictBadge rating={row.verdict_rating} title="Stored analyst verdict" /> : <span className="text-ink-faint">not analysed</span>}
          <span className="text-accent">Enter →</span>
        </span>
      </Link>
    </li>
  );
}

type StreetView = "street" | "plain";
const VIEW_KEY = "aladdin.marketView";
function readView(): StreetView {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "plain" ? "plain" : "street";
  } catch {
    return "street";
  }
}

export default function MarketplacePage() {
  const [list, setList] = useState<Watchlist | null>(null);
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [restocking, setRestocking] = useState(false);
  const [talking, setTalking] = useState(false);
  const [hyping, setHyping] = useState(false);
  const hypeButton = useRef<HTMLButtonElement>(null);
  const boothButton = useRef<HTMLButtonElement>(null);
  const { demoMode } = useDemoMode();
  const artOn = useArtMode() === "stitch";
  const [view, setViewState] = useState<StreetView>(readView);
  const streetOn = artOn && view === "street";
  const setView = (v: StreetView) => {
    setViewState(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* a private window or blocked storage: the choice just is not remembered */
    }
  };

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .getWatchlist()
      .then(setList)
      .catch((e: unknown) => setError(describeError(e, "the street")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    document.title = "Marketplace · Aladdin";
    load();
  }, [load]);

  async function restock() {
    setRestocking(true);
    setError(null);
    try {
      setList(await api.refreshWatchlist());
    } catch (e) {
      setError(describeError(e, "the shelves (restock)"));
    } finally {
      setRestocking(false);
    }
  }

  const closeBooth = useCallback(() => {
    setTalking(false);
    boothButton.current?.focus();
  }, []);

  const closeHype = useCallback(() => {
    setHyping(false);
    hypeButton.current?.focus();
  }, []);

  const rows = useMemo(() => orderStreet(list?.rows ?? []), [list]);
  const inRange = rows.filter((r) => r.status === "buy_zone").length;
  const near = rows.filter((r) => r.status === "near").length;
  const isUnpriced = (r: WatchlistRow) => ["no_target", "no_price", "currency_mismatch"].includes(r.status);
  const priced = rows.filter((r) => !isUnpriced(r));
  const unpricedRows = rows.filter(isUnpriced);
  const unpriced = unpricedRows.length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <nav aria-label="Where you are" className="mb-3 flex items-center gap-1.5 text-sm text-ink-muted">
        <Link to="/fortress" className="hover:text-ink">Fortress</Link>
        <span aria-hidden>›</span>
        <span className="text-ink">Marketplace</span>
      </nav>
      <PageHeader
        title="The Marketplace"
        subtitle={
          streetOn
            ? "Who's near your price?"
            : "One store for every company on your watchlist. Walk the street, then step inside a store for the full appraisal: eight gates, a price board, the moat, the numbers and the case for and against. Nothing here buys or sells anything."
        }
        actions={
          <>
            {artOn && (
              <div className="ms-switch" role="group" aria-label="Market view">
                <button type="button" aria-pressed={view === "street"} onClick={() => setView("street")}>
                  Street
                </button>
                <button type="button" aria-pressed={view === "plain"} onClick={() => setView("plain")}>
                  Plain
                </button>
              </div>
            )}
            <SnapshotStamp at={list?.snapshot_at} />
            <Button variant="secondary" onClick={restock} disabled={restocking || loading} title="Refresh the watchlist prices and valuations (same as Refresh on the Watchlist page)">
              {restocking ? "Restocking…" : "Restock prices"}
            </Button>
          </>
        }
      />

      {!streetOn && (
      <section className="sal-booth mb-4" aria-label="Sal, the sales rep">
        <ObjectArtImage id="sal-counter" width={96} className="sal-counter-art" fallback={<SalesRep mood="pitch" size={64} className="sal-figure" />} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <button ref={boothButton} type="button" className="sal-btn" onClick={() => setTalking(true)}>
              Talk to Sal: open a new stall
            </button>
            <button ref={hypeButton} type="button" className="sal-btn-ghost" onClick={() => setHyping(true)} title="Test a tip against the eight gates">
              The Hype Booth: test a tip
            </button>
          </div>
          <p className="mt-1 text-xs text-[#a8977a]">
            {demoMode === true ? "Demo mode is on: the street is painted scenery." : "Add a company by its Yahoo ticker. Oslo Børs symbols end in .OL."}
          </p>
        </div>
      </section>
      )}

      {error && (
        <div className="mb-4">
          <LoadError message={error.message} retryable={error.retryable} onRetry={load} />
        </div>
      )}
      {!list && loading && <EmptyState>Setting up the stalls…</EmptyState>}

      {list && rows.length === 0 && streetOn && (
        <MarketStreet
          rows={rows}
          loaded
          onTalk={() => setTalking(true)}
          onHype={() => setHyping(true)}
          salRef={boothButton}
          hypeRef={hypeButton}
        />
      )}
      {list && rows.length === 0 && !streetOn && (
        <EmptyState>
          <ObjectArtImage id="booth-goods" width={120} className="mx-auto mb-3" fallback={null} />
          The street is empty. Talk to Sal above to open the first stall, or add companies on the <Link className="text-accent underline underline-offset-2" to="/watchlist">Watchlist</Link> page, and a store will open for each.
        </EmptyState>
      )}

      {list && rows.length > 0 && (
        <div className="space-y-4">
          <dl className="game-hud" aria-label="The street at a glance">
            {[
              { label: "Stalls", value: String(rows.length), tip: "One stall for every company on your watchlist" },
              { label: "In range", value: String(inRange), color: inRange > 0 ? "#f2d16b" : undefined, tip: "At or below the price you named" },
              { label: "Near", value: String(near), tip: "Within 10% of the price you named" },
              { label: "No price", value: String(unpriced), tip: "No price of yours to compare, or no price on file" },
            ].map((i) => (
              <div key={i.label} className="game-hud-item" title={i.tip}>
                <dt className="game-hud-label">{i.label}</dt>
                <dd className="game-hud-value tabular" style={i.color ? { color: i.color } : undefined}>
                  {i.value}
                </dd>
              </div>
            ))}
          </dl>

          {streetOn && (
            <MarketStreet
              rows={rows}
              loaded
              onTalk={() => setTalking(true)}
              onHype={() => setHyping(true)}
              salRef={boothButton}
              hypeRef={hypeButton}
            />
          )}

          {!streetOn && priced.length > 0 && (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {priced.map((r) => (
                <li key={r.id}>
                  <Stall row={r} place={rows.indexOf(r) + 1} />
                </li>
              ))}
            </ul>
          )}

          {!streetOn && unpricedRows.length > 0 && (
            <Disclosure
              label={`the ${unpricedRows.length} ${unpricedRows.length === 1 ? "store" : "stores"} with no price of yours to compare`}
              defaultOpen={priced.length === 0}
            >
              <ul>
                {unpricedRows.map((r) => (
                  <CompactStall key={r.id} row={r} />
                ))}
              </ul>
            </Disclosure>
          )}

          <Disclosure label={streetOn ? "how to read the flags" : "how to read the street"} level="evidence" className="px-1">
            {streetOn ? (
              <FlagKey />
            ) : (
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-faint" aria-label="How to read the street">
                <li>Gold awning: priced at or below the price you named</li>
                <li>Amber: within 10% of it · Blue: above it · Grey: no price to compare</li>
                <li>Round marks, left to right: moat, fair price, your price, analyst word, freshness</li>
                <li>A tick is open, a half is ajar, a cross is closed, a dashed ring is unknown</li>
              </ul>
            )}
          </Disclosure>
        </div>
      )}

      {hyping && <HypeBoothDialog demoMode={demoMode === true} rows={list?.rows ?? []} onClose={closeHype} onAdded={setList} />}
      {talking && <SalesRepDialog demoMode={demoMode === true} rows={list?.rows ?? []} onClose={closeBooth} onAdded={setList} />}
    </div>
  );
}
