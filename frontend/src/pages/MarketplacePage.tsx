import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useDemoMode } from "../lib/demoMode";
import { formatPct100, formatPrice } from "../lib/format";
import { orderStreet, shopFront, shopPips, storePath } from "../lib/marketplace";
import { boothLine } from "../lib/salesRep";
import type { Watchlist, WatchlistRow } from "../lib/types";
import { Awning, Pip } from "../components/marketplace/MarketArt";
import SalesRepDialog from "../components/marketplace/SalesRepDialog";
import { SalesRep } from "../components/marketplace/SalesRepArt";
import { TONE_PAINT } from "../lib/marketplacePaint";
import { Button, Card, EmptyState, PageHeader, SnapshotStamp, VerdictBadge } from "../components/ui";

/** The Marketplace street (game mode, G9): one store per watchlist company. The shop window
 * shows only what the watchlist already knows (your price against the quote, the stored moat
 * and verdict, the age of the analysis). Open a store for the full appraisal. Read-only. */

function Stall({ row }: { row: WatchlistRow }) {
  const front = shopFront(row);
  const paint = TONE_PAINT[front.tone];
  const pips = shopPips(row);
  const d = row.distance_to_buy_pct === null ? null : Number(row.distance_to_buy_pct);
  return (
    <Link
      to={storePath(row.holding_id)}
      className="market-stall group block overflow-hidden rounded-lg border border-border bg-surface transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5"
      aria-label={`Enter the ${row.name} store. ${front.tag}.`}
    >
      <Awning a={paint.a} b={paint.b} stripes={8} className="market-awning-sm" />
      <div className="space-y-3 p-4">
        <div>
          <p className="font-display text-lg leading-tight text-ink">{row.name}</p>
          <p className="text-xs text-ink-faint">
            {row.ticker}
            {row.sector ? ` · ${row.sector}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="rounded-full bg-border-subtle px-2 py-0.5 text-ink-muted">{front.tag}</span>
          {row.owned && <span className="rounded-full bg-accent-subtle px-2 py-0.5 font-medium text-ink">In your fortress</span>}
        </div>

        <dl className="tabular grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
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
          <div className="flex items-center gap-1" aria-label="Gates the shop window can show">
            {pips.map((p) => (
              <Pip key={p.id} gate={p} size={18} />
            ))}
          </div>
          <VerdictBadge rating={row.verdict_rating} title="Stored analyst verdict" />
        </div>
        <p className="text-xs font-medium text-accent group-hover:underline">Enter the store →</p>
      </div>
    </Link>
  );
}

export default function MarketplacePage() {
  const [list, setList] = useState<Watchlist | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [restocking, setRestocking] = useState(false);
  const [talking, setTalking] = useState(false);
  const [boothSeed] = useState(() => Math.floor(Math.random() * 1000));
  const boothButton = useRef<HTMLButtonElement>(null);
  const { demoMode } = useDemoMode();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .getWatchlist()
      .then(setList)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Could not load the street."))
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
      setError(e instanceof ApiError ? e.message : "Could not restock the shelves.");
    } finally {
      setRestocking(false);
    }
  }

  const closeBooth = useCallback(() => {
    setTalking(false);
    boothButton.current?.focus();
  }, []);

  const rows = useMemo(() => orderStreet(list?.rows ?? []), [list]);
  const inRange = rows.filter((r) => r.status === "buy_zone").length;
  const near = rows.filter((r) => r.status === "near").length;
  const unpriced = rows.filter((r) => ["no_target", "no_price", "currency_mismatch"].includes(r.status)).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <nav aria-label="Where you are" className="mb-3 flex items-center gap-1.5 text-sm text-ink-muted">
        <Link to="/fortress" className="hover:text-ink">Fortress</Link>
        <span aria-hidden>›</span>
        <span className="text-ink">Marketplace</span>
      </nav>
      <PageHeader
        title="The Marketplace"
        subtitle="One store for every company on your watchlist. Walk the street, then step inside a store for the full appraisal: eight gates, a price board, the moat, the numbers and the case for and against. Nothing here buys or sells anything."
        actions={
          <>
            <SnapshotStamp at={list?.snapshot_at} />
            <Button variant="secondary" onClick={restock} disabled={restocking || loading} title="Refresh the watchlist prices and valuations (same as Refresh on the Watchlist page)">
              {restocking ? "Restocking…" : "Restock prices"}
            </Button>
          </>
        }
      />

      <section className="sal-booth mb-4" aria-label="Sal, the sales rep">
        <SalesRep mood="pitch" size={96} className="sal-figure" />
        <div className="min-w-0 space-y-2">
          <div className="market-bubble sal-bubble">
            <p className="text-[0.95rem] leading-relaxed">{demoMode === true ? "Demo mode is on, so the street is painted scenery. Switch it off in Settings and I'll open real stalls." : boothLine(boothSeed)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button ref={boothButton} type="button" className="sal-btn" onClick={() => setTalking(true)}>
              Talk to Sal: open a new stall
            </button>
            <span className="text-xs text-[#a8977a]">Add a company by its Yahoo ticker. Oslo Børs symbols end in .OL.</span>
          </div>
        </div>
      </section>

      {error && <Card className="mb-4 border-negative/40 bg-negative-subtle text-sm text-negative">{error}</Card>}
      {!list && loading && <EmptyState>Setting up the stalls…</EmptyState>}

      {list && rows.length === 0 && (
        <EmptyState>
          The street is empty. Talk to Sal above to open the first stall, or add companies on the <Link className="text-accent hover:underline" to="/watchlist">Watchlist</Link> page, and a store will open for each.
        </EmptyState>
      )}

      {list && rows.length > 0 && (
        <div className="space-y-4">
          <dl className="game-hud" aria-label="The street at a glance">
            {[
              { label: "Stores open", value: String(rows.length) },
              { label: "In your price range", value: String(inRange), color: inRange > 0 ? "#f2d16b" : undefined },
              { label: "Within 10% of it", value: String(near) },
              { label: "No price to compare", value: String(unpriced) },
            ].map((i) => (
              <div key={i.label} className="game-hud-item">
                <div className="min-w-0">
                  <dt className="game-hud-label">{i.label}</dt>
                  <dd className="game-hud-value tabular" style={i.color ? { color: i.color } : undefined}>
                    {i.value}
                  </dd>
                </div>
              </div>
            ))}
          </dl>

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <li key={r.id}>
                <Stall row={r} />
              </li>
            ))}
          </ul>

          <ul className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-ink-faint" aria-label="How to read the street">
            <li>Gold awning: priced at or below the price you named</li>
            <li>Amber: within 10% of it · Blue: above it · Grey: no price to compare</li>
            <li>Round marks, left to right: moat, fair price, your price, analyst word, freshness</li>
            <li>A tick is open, a half is ajar, a cross is closed, a dashed ring is unknown</li>
          </ul>
        </div>
      )}

      {talking && <SalesRepDialog demoMode={demoMode === true} rows={list?.rows ?? []} onClose={closeBooth} onAdded={setList} />}
    </div>
  );
}
