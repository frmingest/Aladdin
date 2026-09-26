import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { formatDate, formatNok, formatPercent, formatPct100 } from "../lib/format";
import type { ClusterFlag, CorrelationMatrix, HoldingStress, PortfolioRisk, Regime } from "../lib/types";
import { Button, Card, EmptyState, PageHeader, SectionTitle } from "../components/ui";

/** Sprint 12 — correlation matrix, correlated-cluster flags, drawdown/
 * stress scenarios and macro regime, all from GET /risk/portfolio
 * (backend/app/services/risk/). Every number is deterministic, computed
 * from real fetched price history and stored macro data — never model
 * output. */

const REGIME_LABEL: Record<Regime["regime"], string> = {
  baseline: "Baseline",
  stagflation: "Stagflation",
  crisis: "Crisis",
};

const REGIME_STYLE: Record<Regime["regime"], string> = {
  baseline: "bg-positive-subtle text-positive",
  stagflation: "bg-caution-subtle text-caution",
  crisis: "bg-negative-subtle text-negative",
};

/** Diverging correlation cell: the app's own positive/negative tokens as
 * the two poles, a near-white/near-black midpoint (no fill) at r=0, and
 * |r| driving how saturated the fill is — a two-hue-plus-neutral diverging
 * encoding built from tokens already in this design system rather than a
 * new palette. */
function correlationCellStyle(r: number): React.CSSProperties {
  const alpha = Math.min(Math.abs(r), 1) * 0.85;
  const varName = r >= 0 ? "--c-positive" : "--c-negative";
  return { backgroundColor: `rgb(var(${varName}) / ${alpha})` };
}

function CorrelationHeatmap({ matrix }: { matrix: CorrelationMatrix }) {
  if (matrix.tickers.length < 2) {
    return (
      <p className="text-sm text-ink-muted">
        Not enough holdings with sufficient price history yet to compute a correlation matrix.
      </p>
    );
  }
  const get = (a: string, b: string): number | null => {
    if (a === b) return 1;
    const pair = matrix.pairs.find(
      (p) => (p.ticker_a === a && p.ticker_b === b) || (p.ticker_a === b && p.ticker_b === a)
    );
    return pair ? Number(pair.correlation) : null;
  };

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-0.5 text-xs">
        <thead>
          <tr>
            <th className="p-1" />
            {matrix.tickers.map((t) => (
              <th key={t} className="p-1 text-center font-medium text-ink-muted">
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.tickers.map((rowTicker) => (
            <tr key={rowTicker}>
              <th className="pr-2 text-right font-medium text-ink-muted">{rowTicker}</th>
              {matrix.tickers.map((colTicker) => {
                const r = get(rowTicker, colTicker);
                return (
                  <td
                    key={colTicker}
                    className="tabular h-9 w-14 rounded text-center align-middle"
                    style={r !== null ? correlationCellStyle(r) : undefined}
                    title={`${rowTicker} vs ${colTicker}: ${r !== null ? r.toFixed(2) : "not computable"}`}
                  >
                    {r !== null ? r.toFixed(2) : <span className="text-ink-faint">—</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClusterFlags({ clusters, threshold }: { clusters: ClusterFlag[]; threshold: string }) {
  if (clusters.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        No pair of your largest holdings is correlated at or above {formatPercent(threshold, 0)} — no
        correlated risk cluster flagged.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {clusters.map((c, i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm">
          <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-caution-subtle text-[10px] font-bold text-caution">
            !
          </span>
          <span className="text-ink">
            <span className="font-medium">{c.names.join(" & ")}</span> ({c.tickers.join("/")}) are correlated
            at {formatPercent(c.correlation, 2)} and together are {formatPct100(c.combined_weight_pct)} of the
            portfolio — concentration risk and co-movement risk compound each other here.
          </span>
        </li>
      ))}
    </ul>
  );
}

const STRESS_METHOD_LABEL: Record<HoldingStress["method"], string> = {
  dcf_bear: "DCF bear case",
  volatility: "Historical volatility",
  unavailable: "Unavailable",
};

function StressTable({ holdings }: { holdings: HoldingStress[] }) {
  const withShock = holdings.filter((h) => h.shock_pct !== null).slice(0, 10);
  const unavailable = holdings.filter((h) => h.shock_pct === null);

  return (
    <div className="space-y-4">
      {withShock.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-muted">
                <th className="py-2 pr-4 font-medium">Holding</th>
                <th className="py-2 pr-4 font-medium">Method</th>
                <th className="py-2 pr-4 text-right font-medium">Shock</th>
                <th className="py-2 text-right font-medium">Value impact</th>
              </tr>
            </thead>
            <tbody>
              {withShock.map((h) => (
                <tr key={h.holding_id} className="border-t border-border-subtle">
                  <td className="py-2 pr-4">
                    <Link to={`/holdings/${h.holding_id}`} className="font-medium text-ink hover:text-accent">
                      {h.name}
                    </Link>
                    <p className="text-xs text-ink-faint">{h.ticker}</p>
                  </td>
                  <td className="py-2 pr-4 text-xs text-ink-muted">{STRESS_METHOD_LABEL[h.method]}</td>
                  <td className="tabular py-2 pr-4 text-right text-negative">
                    {formatPercent(h.shock_pct as string, 1)}
                  </td>
                  <td className="tabular py-2 text-right text-ink-muted">
                    {h.contribution_nok !== null ? formatNok(h.contribution_nok) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {unavailable.length > 0 && (
        <p className="text-xs text-ink-faint">
          No stress estimate for {unavailable.map((h) => h.name).join(", ")} — no DCF and insufficient/
          unavailable price history.
        </p>
      )}
    </div>
  );
}

function RegimeCard({ regime }: { regime: Regime }) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <SectionTitle hint="Baseline / stagflation / crisis, smoothed over 3 months so one noisy print can't flip it.">
          Macro regime
        </SectionTitle>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${REGIME_STYLE[regime.regime]}`}>
          {REGIME_LABEL[regime.regime]}
        </span>
      </div>
      <p className="text-sm text-ink">{regime.explanation}</p>
      {!regime.data_complete && (
        <p className="mt-2 text-xs text-caution">
          Not enough macro data captured yet ({regime.missing.join(", ")}) — defaulting to baseline.
        </p>
      )}
      {regime.curve_and_credit_are_us_only && (
        <p className="mt-2 text-xs text-ink-faint">
          The credit-spread and yield-curve inputs are US-only — Norges Bank does not publish an equivalent
          series in Aladdin's macro catalogue. {regime.home_market_series_included && "Norway's own CPI is included in the inflation leg."}
        </p>
      )}
      {regime.inputs.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-ink-muted">
                <th className="py-1.5 pr-4 font-medium">Series</th>
                <th className="py-1.5 pr-4 text-right font-medium">Latest</th>
                <th className="py-1.5 text-right font-medium">3-month avg</th>
              </tr>
            </thead>
            <tbody>
              {regime.inputs.map((i) => (
                <tr key={i.key} className="border-t border-border-subtle">
                  <td className="py-1.5 pr-4 text-ink">
                    {i.label} <span className="text-ink-faint">({i.region})</span>
                  </td>
                  <td className="tabular py-1.5 pr-4 text-right text-ink-muted">
                    {i.latest_value !== null ? `${i.latest_value}${i.unit}` : "—"}
                  </td>
                  <td className="tabular py-1.5 text-right text-ink">
                    {i.smoothed_value !== null ? `${i.smoothed_value}${i.unit}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-ink-faint">{regime.method_note}</p>
    </Card>
  );
}

export default function PortfolioRiskPage() {
  const [risk, setRisk] = useState<PortfolioRisk | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = () => {
    api
      .getPortfolioRisk()
      .then(setRisk)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load portfolio risk."));
  };

  useEffect(load, []);

  const onRefresh = () => {
    setRefreshing(true);
    api
      .refreshPortfolioRisk()
      .then(setRisk)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Refresh failed."))
      .finally(() => setRefreshing(false));
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
      <PageHeader
        title="Portfolio risk"
        subtitle={
          risk
            ? `Correlation over ${risk.lookback_days} days of daily prices; stress and regime as of ${
                risk.as_of ? formatDate(risk.as_of) : "no portfolio yet"
              }.`
            : "Correlation, stress scenarios and macro regime."
        }
        actions={
          <Button variant="secondary" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh price data"}
          </Button>
        }
      />

      {error && <p className="text-sm text-negative">{error}</p>}
      {!risk && !error && <p className="text-sm text-ink-muted">Loading…</p>}

      {risk && risk.as_of === null && (
        <EmptyState>
          No portfolio imported yet. Upload a broker export on the{" "}
          <Link to="/portfolio" className="text-accent hover:text-accent-hover">
            Portfolio
          </Link>{" "}
          page first.
        </EmptyState>
      )}

      {risk && risk.as_of !== null && (
        <div className="space-y-6">
          <RegimeCard regime={risk.regime} />

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <SectionTitle hint={`${risk.lookback_days}-day lookback, Pearson correlation of daily returns.`}>
                Correlation matrix
              </SectionTitle>
              <CorrelationHeatmap matrix={risk.correlation} />
              {risk.correlation.excluded.length > 0 && (
                <p className="mt-3 text-xs text-ink-faint">
                  Excluded: {risk.correlation.excluded.map((e) => `${e.key} (${e.reason})`).join("; ")}
                </p>
              )}
            </Card>
            <Card>
              <SectionTitle hint={`Two or more top holdings correlated at |r| ≥ ${formatPercent(risk.cluster_threshold, 0)}.`}>
                Correlated risk clusters
              </SectionTitle>
              <ClusterFlags clusters={risk.clusters} threshold={risk.cluster_threshold} />
            </Card>
          </div>

          <Card>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
              <SectionTitle hint={risk.stress.horizon_note}>Stress scenario</SectionTitle>
              {risk.stress.portfolio_shock_pct !== null && (
                <div className="text-right">
                  <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">Portfolio impact</p>
                  <p className="tabular font-display text-xl font-semibold text-negative">
                    {formatPercent(risk.stress.portfolio_shock_pct, 1)}
                    {risk.stress.portfolio_drawdown_nok !== null && (
                      <span className="ml-2 text-sm text-ink-muted">
                        ({formatNok(risk.stress.portfolio_drawdown_nok)})
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
            <StressTable holdings={risk.stress.holdings} />
          </Card>

          {risk.price_history_notes.length > 0 && (
            <p className="text-xs text-ink-faint">{risk.price_history_notes.join(" · ")}</p>
          )}
        </div>
      )}
    </div>
  );
}
