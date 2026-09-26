import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { formatDate, formatDecimal, formatPct100, formatPercent } from "../lib/format";
import type { HoldingFieldOptions, WatchlistRow, WatchlistStatus } from "../lib/types";
import { Button, Card, EmptyState, PageHeader, VerdictBadge } from "../components/ui";

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
      await api.addToWatchlist({
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
  const [rows, setRows] = useState<WatchlistRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .getWatchlist()
      .then((w) => setRows(w.rows))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load the watchlist."));
  }, []);
  useEffect(load, [load]);

  async function remove(row: WatchlistRow) {
    if (!window.confirm(`Remove ${row.name} from the watchlist? The holding and its data stay.`)) return;
    try {
      await api.removeFromWatchlist(row.id);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not remove.");
    }
  }

  const inZone = rows?.filter((r) => r.status === "buy_zone") ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
      <PageHeader
        title="Watchlist"
        subtitle="Wonderful businesses you'd like to own at a fair price. Flagged when the price reaches your buy-below level."
      />

      <div className="space-y-6">
        <AddForm onAdded={load} />

        {error && <p className="text-sm text-negative">{error}</p>}
        {!rows && !error && <p className="text-sm text-ink-muted">Loading prices…</p>}

        {rows && rows.length === 0 && (
          <EmptyState>Nothing on the watchlist yet. Add a company above, or use Watch on any holding page.</EmptyState>
        )}

        {inZone.length > 0 && (
          <Card className="border-positive/40">
            <p className="text-sm text-ink">
              <span className="font-semibold text-positive">
                {inZone.length} {inZone.length === 1 ? "company is" : "companies are"} at or below your buy price:
              </span>{" "}
              {inZone.map((r) => r.name).join(", ")}. Re-read the thesis and run an analysis before acting.
            </p>
          </Card>
        )}

        {rows && rows.length > 0 && (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-muted">
                    <th className="py-2 pr-4 font-medium">Company</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 text-right font-medium">Price</th>
                    <th className="py-2 pr-4 text-right font-medium">Buy below</th>
                    <th className="py-2 pr-4 text-right font-medium">vs. buy price</th>
                    <th className="py-2 pr-4 text-right font-medium">DCF base · MoS</th>
                    <th className="py-2 pr-4 font-medium">Verdict</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const d = row.distance_to_buy_pct;
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
                          <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[row.status].className}`}>
                            {STATUS[row.status].label}
                          </span>
                        </td>
                        <td className="tabular py-3 pr-4 text-right text-ink" title={row.price_as_of ? `As of ${formatDate(row.price_as_of)}` : row.unavailable_reason ?? undefined}>
                          {row.price ? formatDecimal(row.price) : "—"}
                          <span className="ml-1 text-xs text-ink-faint">{row.price_currency}</span>
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <BuyBelowCell row={row} onSaved={load} />
                        </td>
                        <td className={`tabular py-3 pr-4 text-right font-medium ${d === null ? "text-ink-faint" : Number(d) <= 0 ? "text-positive" : "text-ink"}`}>
                          {d === null ? "—" : `${Number(d) > 0 ? "+" : ""}${formatPct100(d)}`}
                        </td>
                        <td className="tabular py-3 pr-4 text-right text-ink-muted">
                          {row.dcf_base ? formatDecimal(row.dcf_base) : "—"}
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
