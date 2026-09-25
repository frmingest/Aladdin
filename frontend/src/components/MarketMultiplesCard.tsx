import { useState } from "react";
import { api, ApiError } from "../lib/api";
import type { HoldingMetrics } from "../lib/types";
import { METRIC_LABELS, MONEY_METRICS, PERCENT_METRICS } from "../lib/types";
import {
  formatDate,
  formatMoney,
  formatMultiple,
  formatPercent,
  formatPrice,
  formatShares,
  parseShareCount,
} from "../lib/format";
import { Button, Card } from "./ui";

const MARKET_ORDER = [
  "market_cap",
  "enterprise_value",
  "price_to_earnings",
  "price_to_book",
  "price_to_sales",
  "ev_to_ebitda",
  "fcf_yield",
];

/** Market multiples (today's price × the current share count, on the
 * selected year's figures) plus where the price and share count came
 * from, and a form to enter the share count by hand. */
export function MarketMultiplesCard({
  holdingId,
  metrics,
  onChanged,
}: {
  holdingId: string;
  metrics: HoldingMetrics;
  onChanged: () => void;
}) {
  const market = metrics.market;
  const shares = market?.shares;
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    shares: "",
    asOf: new Date().toISOString().slice(0, 10),
    reference: "",
    note: "",
  });

  function renderValue(key: string, value: string) {
    if (PERCENT_METRICS.has(key)) return formatPercent(value);
    if (MONEY_METRICS.has(key)) return formatMoney(value, metrics.currency ?? market?.reporting_currency ?? null);
    return formatMultiple(value);
  }

  async function save() {
    const parsed = parseShareCount(form.shares);
    if (!parsed) {
      setError("Enter a positive number of shares, e.g. 2 496 406 246 or 2496.4m.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.setShareCount(holdingId, {
        shares: parsed,
        as_of: `${form.asOf}T00:00:00Z`,
        reference: form.reference || undefined,
        note: form.note || undefined,
      });
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the share count.");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    setError(null);
    try {
      await api.clearShareCount(holdingId);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove the share count.");
    } finally {
      setBusy(false);
    }
  }

  const rows = MARKET_ORDER.filter(
    (k) => metrics.computed[k] !== undefined || metrics.skipped[k]?.startsWith("not meaningful"),
  );
  const converted =
    market?.price_currency &&
    market.reporting_currency &&
    market.price_currency !== market.reporting_currency;

  return (
    <Card className="mt-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">Market multiples</h3>
        <span className="text-xs text-ink-muted">
          Today&apos;s price on {metrics.period} figures
          {market?.stale_period ? " — an older year: pick the latest period for current multiples" : ""}
        </span>
      </div>

      {/* Inputs: price (converted to the filing currency) and share count */}
      <dl className="mb-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Share price</dt>
          <dd className="tabular text-right text-ink">
            {market?.price ? formatPrice(market.price, market.price_currency) : "—"}
            {converted && market?.price_in_reporting_currency && (
              <span className="block text-xs text-ink-muted">
                = {formatPrice(market.price_in_reporting_currency, market.reporting_currency)} at{" "}
                {Number(market.fx_rate).toFixed(4)}
              </span>
            )}
            {market?.price_as_of && (
              <span className="block text-xs text-ink-muted">{formatDate(market.price_as_of)}</span>
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Shares outstanding</dt>
          <dd className="tabular text-right text-ink">
            {formatShares(shares?.shares ?? null)}
            {shares?.source_label && (
              <span className="block text-xs text-ink-muted">
                {shares.reference ? (
                  <a
                    href={shares.reference}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:text-accent-hover"
                  >
                    {shares.source_label}
                  </a>
                ) : (
                  shares.source_label
                )}
                {shares.as_of ? ` · ${formatDate(shares.as_of)}` : ""}
              </span>
            )}
            {shares?.eps_implied_low && shares.eps_implied_high && (
              <span className="block text-xs text-ink-muted">
                Net income ÷ EPS: {formatShares(shares.eps_implied_low).replace(" shares", "")}–
                {formatShares(shares.eps_implied_high)}
              </span>
            )}
          </dd>
        </div>
      </dl>

      {market?.unavailable_reason && (
        <p className="mb-3 text-xs text-ink-muted">Not available: {market.unavailable_reason}</p>
      )}

      {rows.length > 0 && (
        <dl className="divide-y divide-border-subtle">
          {rows.map((key) => (
            <div key={key} className="py-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">{METRIC_LABELS[key]}</dt>
                <dd className="tabular font-medium text-ink">
                  {metrics.computed[key] !== undefined ? renderValue(key, metrics.computed[key]) : "n/m"}
                </dd>
              </div>
              {metrics.computed[key] === undefined && (
                <p className="mt-0.5 text-xs text-ink-muted">
                  {metrics.skipped[key].replace(/^not meaningful: /, "")}
                </p>
              )}
              {metrics.notes[key] && <p className="mt-0.5 text-xs text-ink-muted">{metrics.notes[key]}</p>}
            </div>
          ))}
        </dl>
      )}

      <div className="mt-3 border-t border-border-subtle pt-3">
        {!editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" type="button" onClick={() => setEditing(true)} disabled={busy}>
              Enter share count
            </Button>
            {shares?.source === "manual" && (
              <Button variant="secondary" type="button" onClick={clear} disabled={busy}>
                Use Yahoo / SEC again
              </Button>
            )}
            <span className="text-xs text-ink-muted">
              For after a share issue or buyback — cite the Newsweb notice or IR page.
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="text-xs text-ink-muted">
              Shares outstanding
              <input
                value={form.shares}
                onChange={(e) => setForm({ ...form, shares: e.target.value })}
                placeholder="2 496 406 246"
                className="mt-1 w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-ink"
              />
            </label>
            <label className="text-xs text-ink-muted">
              As of
              <input
                type="date"
                value={form.asOf}
                onChange={(e) => setForm({ ...form, asOf: e.target.value })}
                className="mt-1 w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-ink"
              />
            </label>
            <label className="text-xs text-ink-muted">
              Source (link)
              <input
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                placeholder="https://newsweb.oslobors.no/message/…"
                className="mt-1 w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-ink"
              />
            </label>
            <label className="text-xs text-ink-muted">
              Note
              <input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="After the September private placement"
                className="mt-1 w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-ink"
              />
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="button" onClick={save} disabled={busy}>
                Save
              </Button>
              <Button variant="secondary" type="button" onClick={() => setEditing(false)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        )}
        {error && <p className="mt-2 text-xs text-negative">{error}</p>}
      </div>
    </Card>
  );
}
