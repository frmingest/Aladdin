import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useCachedQuery } from "../lib/queryCache";
import { formatDate, formatDecimal, formatPct100, formatPercent } from "../lib/format";
import type { HoldingFieldOptions, Watchlist, WatchlistRow, WatchlistStatus } from "../lib/types";
import { Button, Card, EmptyState, PageHeader, SnapshotStamp, VerdictBadge } from "../components/ui";

/** Feature F7 — companies you follow, with your own buy-below price.
 * Prices and DCF values come from the same cached valuation as the
 * margin-of-safety board (backend/app/services/watchlist.py). A watched
 * company is an ordinary holding, so its page offers the full valuation,
 * research and Buffett/Munger analysis. */

const STATUS: Record<WatchlistStatus, { label: string; className: string }> = {
  buy_zone: { label: "At or below buy price", className: "bg-positive-subtle text-positive" },
  near: { label: "Within 10%", className: "bg-caution-subtle text-caution" },
  above: { label: "Above buy price", className: "bg-border-subtle text-ink-muted" },
  no_target: { label: "No buy price set", className: "bg-border-subtle text-ink-faint" },
  no_price: { label: "No price", className: "bg-border-subtle text-ink-faint" },
  currency_mismatch: { label: "Currency differs", className: "bg-caution-subtle text-caution" },
};

/** Where today's price sits relative to your buy-below price: the tick is the
 * buy price, everything left of it is the buy zone. Track spans -30%..+50%. */
const GAUGE_MIN = -30;
const GAUGE_MAX = 50;
function BuyGauge({ row }: { row: WatchlistRow }) {
  const d = row.distance_to_buy_pct === null ? null : Number(row.distance_to_buy_pct);
  const pos = (v: number) => ((Math.min(GAUGE_MAX, Math.max(GAUGE_MIN, v)) - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN)) * 100;
  const dot =
    row.status === "buy_zone" ? "bg-positive" : row.status === "near" ? "bg-caution" : "bg-ink-faint";
  if (d === null) {
    return <span className="text-xs text-ink-faint">{STATUS[row.status].label}</span>;
  }
  return (
    <div className="w-40" title={STATUS[row.status].label}>
      <div
        className="relative h-4"
        role="img"
        aria-label={`${STATUS[row.status].label}: ${d > 0 ? "+" : ""}${d.toFixed(0)}% versus your buy price`}
      >
        <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-border-subtle" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-l-full bg-positive/25"
          style={{ left: 0, width: `${pos(0)}%` }}
        />
        <div className="absolute top-1/2 h-3.5 w-px -translate-y-1/2 bg-ink" style={{ left: `${pos(0)}%` }} />
        <div
          className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface ${dot}`}
          style={{ left: `${pos(d)}%` }}
        />
      </div>
      <p className={`tabular mt-0.5 text-xs font-medium ${d <= 0 ? "text-positive" : "text-ink-muted"}`}>
        {d > 0 ? "+" : ""}
        {formatPct100(String(d))} vs. buy price
      </p>
    </div>
  );
}

function StatusTiles({ rows }: { rows: WatchlistRow[] }) {
  const tiles: { label: string; count: number; tone: string }[] = [
    { label: "At or below buy price", count: rows.filter((r) => r.status === "buy_zone").length, tone: "text-positive" },
    { label: "Within 10%", count: rows.filter((r) => r.status === "near").length, tone: "text-caution" },
    { label: "Above buy price", count: rows.filter((r) => r.status === "above").length, tone: "text-ink" },
    {
      label: "Needs a buy price or price",
      count: rows.filter((r) => ["no_target", "no_price", "currency_mismatch"].includes(r.status)).length,
      tone: "text-ink-muted",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {tiles.map((t) => (
        <Card key={t.label}>
          <p className="text-xs text-ink-muted">{t.label}</p>
          <p className={`tabular mt-1 text-2xl font-semibold ${t.tone}`}>{t.count}</p>
        </Card>
      ))}
    </div>
  );
}

function AddForm({ onAdded }: { onAdded: () => void }) {
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("NOK");
  const [sector, setSector] = useState("");
  const [buyBelow, setBuyBelow] = useState("");
  const [options, setOptions] = useState<HoldingFieldOptions | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getHoldingFieldOptions().then(setOptions).catch(() => setOptions(null));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ticker.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const added = await api.addToWatchlist({
        ticker: ticker.trim(),
        name: name.trim() || undefined,
        trading_currency: currency.trim() || undefined,
        sector: sector || null,
        buy_below_price: buyBelow.trim() || null,
      });
      setTicker("");
      setName("");
      setBuyBelow("");
      setSector("");
      // A page load no longer fetches a first price (Sprint 20); ask for it
      // now, as part of the add. Best effort: the add itself already worked,
      // and the worker (or Refresh prices) fills in anything this misses.
      if (added?.holding_id) await api.warmUpHolding(added.holding_id).catch(() => undefined);
      onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add.");
    } finally {
      setBusy(false);
    }
  }

  const input = "rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-ink";
  return (
    <Card>
      <h2 className="text-sm font-semibold text-ink">Add a company</h2>
      <p className="mt-0.5 text-xs text-ink-faint">
        Use the Yahoo symbol on the home exchange (e.g. ORK.OL, KO). Name and currency are only needed if it
        isn't already a holding.
      </p>
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Ticker
          <input className={`${input} w-28 uppercase`} value={ticker} onChange={(e) => setTicker(e.target.value)} required />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Name
          <input className={`${input} w-52`} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Currency
          <input className={`${input} w-20 uppercase`} maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Sector
          <select className={`${input} w-44`} value={sector} onChange={(e) => setSector(e.target.value)}>
            <option value="">—</option>
            {options?.sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Buy below
          <input
            className={`${input} w-28`}
            inputMode="decimal"
            placeholder="optional"
            value={buyBelow}
            onChange={(e) => setBuyBelow(e.target.value.replace(",", "."))}
          />
        </label>
        <Button type="submit" disabled={busy || !ticker.trim()}>
          {busy ? "Adding…" : "Add to watchlist"}
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-negative">{error}</p>}
    </Card>
  );
}

function BuyBelowCell({ row, onSaved }: { row: WatchlistRow; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(row.buy_below_price ? String(Number(row.buy_below_price)) : "");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    try {
      await api.updateWatchlistEntry(row.id, { buy_below_price: value.trim() || null });
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid price");
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="tabular text-right text-ink hover:text-accent"
        title="Edit buy-below price"
      >
        {row.buy_below_price ? formatDecimal(row.buy_below_price) : <span className="text-xs text-accent">Set</span>}
        {row.buy_below_currency && <span className="ml-1 text-xs text-ink-faint">{row.buy_below_currency}</span>}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <input
        autoFocus
        className="tabular w-20 rounded border border-border bg-surface px-1.5 py-0.5 text-right text-sm"
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value.replace(",", "."))}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <button onClick={save} className="text-xs font-medium text-accent">
        Save
      </button>
      {error && <span className="text-xs text-negative">{error}</span>}
    </span>
  );
}

export default function WatchlistPage() {
  const query = useCachedQuery<Watchlist>("watchlist", () => api.getWatchlist(), {
    errorText: "Could not load the watchlist.",
  });
  const rows = query.data?.rows ?? null;
  const snapshotAt = query.data?.snapshot_at ?? null;
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const error = actionError ?? query.error;
  const load = query.reload;

  function refreshPrices() {
    setRefreshing(true);
    setActionError(null);
    api
      .refreshWatchlist()
      .then(query.mutate)
      .catch((e) => setActionError(e instanceof ApiError ? e.message : "Could not refresh the watchlist."))
      .finally(() => setRefreshing(false));
  }

  async function remove(row: WatchlistRow) {
    if (!window.confirm(`Remove ${row.name} from the watchlist? The holding and its data stay.`)) return;
    try {
      await api.removeFromWatchlist(row.id);
      load();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Could not remove.");
    }
  }

  const inZone = rows?.filter((r) => r.status === "buy_zone") ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
      <PageHeader
        title="Watchlist"
        subtitle="Wonderful businesses you'd like to own at a fair price. Flagged when the price reaches your buy-below level."
        actions={
          <div className="flex items-center gap-3">
            <SnapshotStamp at={snapshotAt} />
            <Button variant="secondary" onClick={refreshPrices} disabled={refreshing}>
              {refreshing ? "Refreshing…" : "Refresh prices"}
            </Button>
          </div>
        }
      />

      <div className="space-y-6">
        <AddForm onAdded={load} />

        {error && <p className="text-sm text-negative">{error}</p>}
        {!rows && !error && <p className="text-sm text-ink-muted">Loading prices…</p>}

        {rows && rows.length === 0 && (
          <EmptyState>Nothing on the watchlist yet. Add a company above, or use Watch on any holding page.</EmptyState>
        )}

        {rows && rows.length > 0 && <StatusTiles rows={rows} />}

        {inZone.length > 0 && (
          <p className="text-sm text-ink-muted">
            <span className="font-semibold text-positive">At or below your buy price:</span>{" "}
            {inZone.map((r) => r.name).join(", ")}. Re-read the thesis and run an analysis before acting.
          </p>
        )}

        {rows && rows.length > 0 && (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-muted">
                    <th className="py-2 pr-4 font-medium">Company</th>
                    <th className="py-2 pr-4 font-medium">Price vs. your buy price</th>
                    <th className="py-2 pr-4 text-right font-medium">Price</th>
                    <th className="py-2 pr-4 text-right font-medium">Buy below</th>
                    <th className="py-2 pr-4 text-right font-medium">DCF base · MoS</th>
                    <th className="py-2 pr-4 font-medium">Verdict</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const mos = row.margin_of_safety_base;
                    return (
                      <tr key={row.id} className="border-t border-border-subtle align-middle">
                        <td className="py-3 pr-4">
                          <Link to={`/holdings/${row.holding_id}`} className="font-medium text-ink hover:text-accent">
                            {row.name}
                          </Link>
                          <p className="text-xs text-ink-faint">
                            {row.ticker}
                            {row.sector && ` · ${row.sector}`}
                            {row.owned && <span className="ml-1.5 rounded bg-accent-subtle px-1 text-accent">owned</span>}
                          </p>
                          {row.notes && <p className="mt-0.5 max-w-xs truncate text-xs text-ink-muted" title={row.notes}>{row.notes}</p>}
                        </td>
                        <td className="py-3 pr-4">
                          <BuyGauge row={row} />
                        </td>
                        <td className="tabular py-3 pr-4 text-right text-ink" title={row.price_as_of ? `As of ${formatDate(row.price_as_of)}` : row.unavailable_reason ?? undefined}>
                          {row.price ? formatDecimal(row.price) : "—"}
                          <span className="ml-1 text-xs text-ink-faint">{row.price_currency}</span>
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <BuyBelowCell row={row} onSaved={load} />
                        </td>
                        <td
                          className="tabular py-3 pr-4 text-right text-ink-muted"
                          title={row.valuation_status === "implausible" ? row.unavailable_reason ?? "Valuation withheld — not reliable" : undefined}
                        >
                          {row.dcf_base ? formatDecimal(row.dcf_base) : row.valuation_status === "implausible" ? "Not reliable" : "—"}
                          {mos !== null && (
                            <span className={`ml-2 ${Number(mos) >= 0 ? "text-positive" : "text-negative"}`}>
                              {formatPercent(mos)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <VerdictBadge rating={row.verdict_rating} />
                        </td>
                        <td className="py-3 text-right">
                          <button onClick={() => remove(row)} className="text-xs text-ink-faint hover:text-negative">
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-ink-faint">
              Click a buy-below price to edit it. DCF values need at least two years of financials. Open the
              company to import them from SEC EDGAR or upload an annual report.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
