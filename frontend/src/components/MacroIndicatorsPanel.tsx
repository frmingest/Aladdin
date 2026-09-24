import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { formatDate, formatIndicatorChange, formatIndicatorValue } from "../lib/format";
import type { MacroIndicator, MacroIndicators, MacroSeriesRefresh } from "../lib/types";
import { Button, Card } from "./ui";

/**
 * Numeric macro data (2026-09-24): Norges Bank, SSB and FRED series,
 * stored by the backend and refreshed in the background. Every number is
 * computed server-side (backend/app/services/macro/indicators.py); this
 * component only formats. GET /macro/indicators reads the database only,
 * so the page loads instantly; "Refresh data" fetches from the publishers.
 */

const REGIONS: { key: string; label: string }[] = [
  { key: "NO", label: "Norway" },
  { key: "US", label: "United States" },
];

function asOf(ind: MacroIndicator): string {
  if (!ind.observed_on) return "";
  if (ind.frequency === "monthly" || (ind.derived && ind.observed_on.endsWith("-01"))) {
    const d = new Date(`${ind.observed_on}T00:00:00Z`);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", timeZone: "UTC" });
  }
  return formatDate(`${ind.observed_on}T00:00:00Z`);
}

/** 24-month trend. Single neutral hue: the direction is read from the
 * change columns as text, never from colour alone. */
function Sparkline({ points, label }: { points: { date: string; value: string }[]; label: string }) {
  const values = points.map((p) => Number(p.value)).filter((v) => Number.isFinite(v));
  if (values.length < 2) return <span className="text-xs text-ink-faint">—</span>;
  const w = 96;
  const h = 24;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = w / (values.length - 1);
  const path = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`)
    .join(" ");
  const first = points[0];
  const last = points[points.length - 1];
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`${label}: ${first.value} (${first.date}) to ${last.value} (${last.date})`}
    >
      <title>{`${first.date}: ${first.value} → ${last.date}: ${last.value}`}</title>
      <path d={path} fill="none" stroke="currentColor" strokeWidth={1.5} className="text-accent" />
    </svg>
  );
}

function IndicatorRow({ ind }: { ind: MacroIndicator }) {
  const problem = ind.last_error ? `Last fetch failed: ${ind.last_error}` : null;
  return (
    <tr className="border-t border-border-subtle align-top">
      <td className="py-2.5 pr-4">
        <div className="truncate text-sm text-ink" title={ind.description}>
          {ind.label}
        </div>
        <div className="text-xs text-ink-faint">
          {ind.derived ? (
            <span title={ind.formula ?? undefined}>Computed · {ind.source_series_id.replace(" - ", " − ")}</span>
          ) : (
            <a
              href={ind.source_url}
              target="_blank"
              rel="noreferrer"
              className="hover:text-accent"
              title={ind.source_series_id}
            >
              {ind.source_name.replace(" (Federal Reserve Bank of St. Louis)", "")} · {ind.source_series_id}
            </a>
          )}
        </div>
      </td>
      <td className="tabular py-2.5 pr-4 text-right text-base font-semibold text-ink">
        {formatIndicatorValue(ind)}
      </td>
      <td className="py-2.5 pr-4 text-xs text-ink-muted">
        {asOf(ind)}
        {ind.stale && (
          <span className="ml-1.5 rounded-full bg-caution-subtle px-1.5 py-0.5 text-caution" title={`${ind.age_days} days old`}>
            stale
          </span>
        )}
        {problem && (
          <div className="mt-0.5 text-negative" title={problem}>
            last fetch failed
          </div>
        )}
      </td>
      <td className="tabular py-2.5 pr-4 text-right text-xs text-ink">{formatIndicatorChange(ind.change_3m, ind.change_kind)}</td>
      <td className="tabular py-2.5 pr-4 text-right text-xs text-ink">{formatIndicatorChange(ind.change_12m, ind.change_kind)}</td>
      <td className="py-2.5">
        <Sparkline points={ind.history} label={ind.label} />
      </td>
    </tr>
  );
}

function IndicatorTable({ rows }: { rows: MacroIndicator[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] table-fixed text-left">
        <colgroup>
          <col />
          <col className="w-28" />
          <col className="w-32" />
          <col className="w-24" />
          <col className="w-24" />
          <col className="w-28" />
        </colgroup>
        <thead>
          <tr className="text-xs text-ink-muted">
            <th className="pb-2 pr-4 font-medium">Series</th>
            <th className="pb-2 pr-4 text-right font-medium">Latest</th>
            <th className="pb-2 pr-4 font-medium">As of</th>
            <th className="pb-2 pr-4 text-right font-medium">3 mo</th>
            <th className="pb-2 pr-4 text-right font-medium">12 mo</th>
            <th className="pb-2 font-medium">24 mo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((ind) => (
            <IndicatorRow key={ind.key} ind={ind} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RefreshSummary({ results }: { results: MacroSeriesRefresh[] }) {
  const failed = results.filter((r) => r.status === "failed");
  const updated = results.filter((r) => r.status === "updated").length;
  return (
    <p className={`mb-4 text-sm ${failed.length ? "text-caution" : "text-ink-muted"}`}>
      {updated} series had new data, {results.length - updated - failed.length} unchanged
      {failed.length > 0 && (
        <>
          , {failed.length} failed: {failed.map((f) => `${f.label} (${f.error ?? "error"})`).join("; ")}
        </>
      )}
      .
    </p>
  );
}

export function MacroIndicatorsPanel() {
  const [data, setData] = useState<MacroIndicators | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<MacroSeriesRefresh[] | null>(null);

  useEffect(() => {
    api
      .getMacroIndicators()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load macro data."));
  }, []);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      const result = await api.refreshMacroIndicators();
      setData(result.indicators);
      setLastRefresh(result.results);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  const empty = data !== null && data.indicators.every((i) => i.value === null);

  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">Rates, inflation &amp; currency</h2>
          <p className="mt-0.5 text-xs text-ink-faint">
            Official series from Norges Bank, Statistics Norway and FRED. Used as cited evidence in every analysis.
            {data?.last_success_at && <> Last fetched {formatDate(data.last_success_at)}.</>}
          </p>
        </div>
        <div className="shrink-0 whitespace-nowrap">
        <Button
          variant="secondary"
          onClick={refresh}
          disabled={refreshing || (data !== null && !data.fetching_enabled)}
          title={data && !data.fetching_enabled ? "MACRO_DATA_PROVIDER is 'none' on the server" : undefined}
        >
          {refreshing ? "Fetching…" : "Refresh data"}
        </Button>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-negative">{error}</p>}
      {lastRefresh && <RefreshSummary results={lastRefresh} />}
      {!data && !error && <p className="text-sm text-ink-muted">Loading…</p>}
      {empty && (
        <p className="mb-4 text-sm text-ink-muted">
          Nothing captured yet. The server fetches these every few hours; click <strong>Refresh data</strong> to
          fetch now.
        </p>
      )}

      {data && !empty && (
        <div className="space-y-6">
          {REGIONS.map((region) => (
            <div key={region.key}>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">{region.label}</h3>
              <IndicatorTable rows={data.indicators.filter((i) => i.region === region.key)} />
            </div>
          ))}
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">Computed</h3>
            <IndicatorTable rows={data.derived} />
          </div>
        </div>
      )}
    </Card>
  );
}

/** Dashboard strip: the handful of numbers worth a glance every day. */
const HEADLINE_KEYS = ["no_policy_rate", "no_cpi_yoy", "no_10y", "usd_nok", "us_fed_funds_upper", "us_10y"];

export function MacroHeadlineStrip({ data }: { data: MacroIndicators }) {
  const byKey = new Map(data.indicators.map((i) => [i.key, i]));
  const rows = HEADLINE_KEYS.map((k) => byKey.get(k)).filter((i): i is MacroIndicator => Boolean(i?.value));
  if (rows.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {rows.map((ind) => (
        <div key={ind.key} className="rounded-md border border-border-subtle bg-background/40 px-3 py-2">
          <p className="truncate text-xs text-ink-muted" title={ind.label}>
            {ind.label.replace(" (upper bound)", "").replace(" government bond yield", "").replace(" (12-month)", "")}
          </p>
          <p className="tabular mt-0.5 text-lg font-semibold text-ink">
            {formatIndicatorValue(ind)}
            {ind.stale && <span className="ml-1 text-xs font-normal text-caution">stale</span>}
          </p>
          <p className="tabular text-xs text-ink-faint">12 mo {formatIndicatorChange(ind.change_12m, ind.change_kind)}</p>
        </div>
      ))}
    </div>
  );
}
