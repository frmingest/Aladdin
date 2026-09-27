import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAnalystMode } from "../lib/analystMode";
import { AGREEMENT_LABELS, ENVIRONMENT_LABELS, ROLE_LABELS } from "../lib/analystTypes";
import type {
  Agreement,
  AllWeather,
  Beta,
  CycleFitBoard,
  DalioMacro,
  DalioRefreshResult,
  WeightSlice,
} from "../lib/analystTypes";
import { formatDate, formatDecimal, formatNok, formatPct100 } from "../lib/format";
import { Button, Card, EmptyState, SectionTitle, VerdictBadge } from "./ui";

/**
 * Epic F22 portfolio-level views for Dalio and side-by-side modes:
 * - CycleFitBoardCard (story 22.11) — every owned holding by Dalio verdict
 *   and portfolio role, with the Buffett/Munger verdict beside it;
 * - AllWeatherPanel (story 22.9) — balance by role and environment,
 *   currency, country risk, rate sensitivity, correlation clusters;
 * - DalioMacroPanel (stories 22.3/22.10) — the Dalio-only macro series,
 *   sovereign stress per portfolio country, central-bank gold demand.
 * Every number is computed server-side (CLAUDE.md Rule 1); these only lay
 * them out. Weight bars are one hue with the value always printed beside
 * them, so nothing is read from colour alone.
 */

function errorText(e: unknown): string {
  return e instanceof ApiError || e instanceof Error ? e.message : "Request failed.";
}

const AGREEMENT_STYLES: Record<Agreement, string> = {
  agree: "bg-positive-subtle text-positive",
  partly_agree: "bg-caution-subtle text-caution",
  disagree: "bg-negative-subtle text-negative",
  incomplete: "bg-border-subtle text-ink-muted",
};

function RoleTag({ role }: { role: string | null }) {
  if (!role) return <span className="text-xs text-ink-faint">—</span>;
  return (
    <span className="whitespace-nowrap rounded-full bg-accent-subtle px-2 py-0.5 text-xs font-medium text-accent">
      {ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Cycle-fit board

export function CycleFitBoardCard({ showBuffett }: { showBuffett: boolean }) {
  const [board, setBoard] = useState<CycleFitBoard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getCycleFitBoard()
      .then(setBoard)
      .catch((e) => setError(errorText(e)));
  }, []);

  if (error) return <p className="text-sm text-negative">{error}</p>;
  if (!board) return <p className="text-sm text-ink-muted">Loading the cycle-fit board…</p>;
  if (board.rows.length === 0) return <EmptyState>No owned positions yet.</EmptyState>;

  return (
    <Card>
      <SectionTitle
        hint={`${board.dalio_analyzed_count} of ${board.rows.length} holdings have a Dalio analysis. Ranked by Dalio verdict, then weight.`}
      >
        Cycle-fit board
      </SectionTitle>
      {showBuffett && (
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          {(Object.keys(AGREEMENT_LABELS) as Agreement[]).map((a) =>
            board.agreement_counts[a] ? (
              <span key={a} className={`rounded-full px-2 py-0.5 font-medium ${AGREEMENT_STYLES[a]}`}>
                {AGREEMENT_LABELS[a]}: {board.agreement_counts[a]}
              </span>
            ) : null,
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-muted">
              <th className="py-2 pr-4 font-medium">Holding</th>
              <th className="py-2 pr-4 font-medium">Weight</th>
              <th className="py-2 pr-4 font-medium">Dalio verdict</th>
              <th className="py-2 pr-4 font-medium">Portfolio role</th>
              {showBuffett && <th className="py-2 pr-4 font-medium">Buffett/Munger</th>}
              {showBuffett && <th className="py-2 pr-4 font-medium">Agreement</th>}
              <th className="py-2 font-medium">Analyzed</th>
            </tr>
          </thead>
          <tbody>
            {board.rows.map((r) => (
              <tr key={r.holding_id} className="border-t border-border-subtle">
                <td className="py-2.5 pr-4">
                  <Link to={`/holdings/${r.holding_id}`} className="font-medium text-ink hover:text-accent">
                    {r.name}
                  </Link>
                  <span className="block text-xs text-ink-faint">{r.ticker}</span>
                </td>
                <td className="tabular py-2.5 pr-4 text-ink-muted">{formatPct100(r.weight_pct)}</td>
                <td className="py-2.5 pr-4">
                  <VerdictBadge rating={r.dalio_verdict} />
                </td>
                <td className="py-2.5 pr-4">
                  <RoleTag role={r.portfolio_role} />
                </td>
                {showBuffett && (
                  <td className="py-2.5 pr-4">
                    <VerdictBadge rating={r.buffett_verdict} />
                  </td>
                )}
                {showBuffett && (
                  <td className="py-2.5 pr-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${AGREEMENT_STYLES[r.agreement]}`}>
                      {AGREEMENT_LABELS[r.agreement]}
                    </span>
                  </td>
                )}
                <td className="py-2.5 text-xs text-ink-muted">
                  {r.dalio_analyzed_at ? formatDate(r.dalio_analyzed_at) : "—"}
                  {r.dalio_stale && <span className="ml-1 text-caution">stale</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// All-Weather

function WeightBars({ slices, empty }: { slices: WeightSlice[]; empty: string }) {
  if (slices.length === 0) return <p className="text-xs text-ink-faint">{empty}</p>;
  const max = Math.max(100, ...slices.map((s) => Number(s.weight_pct)));
  return (
    <ul className="space-y-2">
      {slices.map((s) => {
        const pct = Number(s.weight_pct);
        return (
          <li key={s.key} title={`${s.label}: ${formatPct100(s.weight_pct)} across ${s.count} holding(s)`}>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-ink">{s.label}</span>
              <span className="tabular text-ink-muted">
                {formatPct100(s.weight_pct)} · {s.count}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-border-subtle">
              <div className="h-1.5 rounded-full bg-accent" style={{ width: `${Math.max(0, (pct / max) * 100)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function BetaCell({ beta }: { beta: Beta }) {
  if (beta.beta === null) {
    return (
      <span className="text-xs text-ink-faint" title={beta.reason ?? undefined}>
        n/a
      </span>
    );
  }
  return (
    <span
      className={`tabular text-xs ${beta.significant ? "font-medium text-ink" : "text-ink-faint"}`}
      title={`t = ${beta.t_stat}, ${beta.n_months} months${beta.significant ? "" : " — not statistically clear"}`}
    >
      {formatDecimal(beta.beta)}
      {!beta.significant && "*"}
    </span>
  );
}

export function AllWeatherPanel() {
  const [data, setData] = useState<AllWeather | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getAllWeather()
      .then(setData)
      .catch((e) => setError(errorText(e)));
  }, []);

  if (error) return <p className="text-sm text-negative">{error}</p>;
  if (!data) return <p className="text-sm text-ink-muted">Building the All-Weather view…</p>;
  if (data.positions.length === 0) return <EmptyState>No owned positions yet.</EmptyState>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <SectionTitle hint="From each holding's latest Dalio analysis (judged, market-value weighted)">
            Portfolio roles
          </SectionTitle>
          <WeightBars slices={data.by_role} empty="No Dalio analyses yet." />
        </Card>
        <Card>
          <SectionTitle hint="Environments each Dalio analysis says the holding suits (judged)">
            Environments — judged
          </SectionTitle>
          <WeightBars slices={data.by_judged_environment} empty="No Dalio analyses yet." />
        </Card>
        <Card>
          <SectionTitle hint="From statistically clear return betas only (measured)">Environments — measured</SectionTitle>
          <WeightBars slices={data.by_measured_environment} empty="Not enough history." />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <SectionTitle hint="Trading currency, market value">Currency split</SectionTitle>
          <WeightBars slices={data.by_currency} empty="No values stored." />
        </Card>
        <Card>
          <SectionTitle hint="Monthly portfolio return per +1pp move in the yield (weighted beta)">
            Rate sensitivity
          </SectionTitle>
          <ul className="space-y-2 text-sm">
            {data.rate_sensitivity.map((r) => (
              <li key={r.key} className="flex items-baseline justify-between gap-3" title={r.note}>
                <span className="text-ink">{r.label}</span>
                <span className="tabular text-ink-muted">
                  {r.weighted_beta === null ? "n/a" : `${formatDecimal(r.weighted_beta)}%`}
                  <span className="ml-1 text-xs text-ink-faint">({formatPct100(r.coverage_pct)} covered)</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-ink-faint">Macro regime today: {data.regime}.</p>
        </Card>
        <Card>
          <SectionTitle hint={`Market-value weighted, fund look-through; ${formatPct100(data.country_coverage_pct)} of the portfolio covered`}>
            Country risk
          </SectionTitle>
          {data.by_country.length === 0 ? (
            <p className="text-xs text-ink-faint">No country exposure determined yet.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {data.by_country.map((c) => (
                <li key={c.country} className="flex items-baseline justify-between gap-3">
                  <span className="text-ink">
                    {c.name} <span className="tabular text-xs text-ink-faint">{formatPct100(c.weight_pct)}</span>
                  </span>
                  <span className="text-xs text-ink-muted" title="Sovereign Stress Index, 0-100 (higher = more stress); no crisis probability">
                    {c.ssi_score === null ? "SSI n/a" : `SSI ${c.ssi_score} · ${c.ssi_band}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {data.clusters.length > 0 && (
        <Card>
          <SectionTitle hint="Pairs that move together — the same bet twice, in Dalio's terms">
            Correlated clusters
          </SectionTitle>
          <ul className="space-y-1 text-sm text-ink">
            {data.clusters.map((c, i) => (
              <li key={i}>
                {c.names.join(" + ")} — correlation {formatDecimal(c.correlation)}, together{" "}
                {formatPct100(c.combined_weight_pct)}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <SectionTitle hint="Betas are % monthly return per +1pp factor change; * = not statistically clear (|t| < 2)">
          Holdings
        </SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-muted">
                <th className="py-2 pr-3 font-medium">Holding</th>
                <th className="py-2 pr-3 font-medium">Weight</th>
                <th className="py-2 pr-3 font-medium">Role</th>
                <th className="py-2 pr-3 font-medium">Growth β</th>
                <th className="py-2 pr-3 font-medium">Inflation β</th>
                <th className="py-2 pr-3 font-medium">US 10y β</th>
                <th className="py-2 pr-3 font-medium">NO 10y β</th>
                <th className="py-2 font-medium">Suits (judged)</th>
              </tr>
            </thead>
            <tbody>
              {data.positions.map((p) => (
                <tr key={p.holding_id} className="border-t border-border-subtle">
                  <td className="py-2 pr-3">
                    <Link to={`/holdings/${p.holding_id}`} className="font-medium text-ink hover:text-accent">
                      {p.name}
                    </Link>
                    <span className="block text-xs text-ink-faint">
                      {p.ticker} · {p.trading_currency}
                    </span>
                  </td>
                  <td className="tabular py-2 pr-3 text-ink-muted">{formatPct100(p.weight_pct)}</td>
                  <td className="py-2 pr-3">
                    <RoleTag role={p.portfolio_role} />
                  </td>
                  <td className="py-2 pr-3"><BetaCell beta={p.growth} /></td>
                  <td className="py-2 pr-3"><BetaCell beta={p.inflation} /></td>
                  <td className="py-2 pr-3"><BetaCell beta={p.rates_us} /></td>
                  <td className="py-2 pr-3"><BetaCell beta={p.rates_no} /></td>
                  <td className="py-2 text-xs text-ink-muted">
                    {p.favoured_environments.map((e) => ENVIRONMENT_LABELS[e]).join(", ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.notes.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-ink-faint">
            {data.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-ink-faint">Total value {formatNok(data.total_value_nok)}.</p>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dalio macro + country data

export function DalioMacroPanel() {
  const [data, setData] = useState<DalioMacro | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<DalioRefreshResult | null>(null);

  const load = useCallback(() => {
    api
      .getDalioMacro()
      .then(setData)
      .catch((e) => setError(errorText(e)));
  }, []);
  useEffect(load, [load]);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      setResult(await api.refreshDalioData());
      load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setRefreshing(false);
    }
  }

  const failed = [
    ...(result?.macro.filter((m) => m.status === "failed").map((m) => `${m.label}: ${m.error}`) ?? []),
    ...(result?.countries.flatMap((c) => c.errors.map((e) => `${c.country}: ${e}`)) ?? []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[70ch] text-sm text-ink-muted">
          Liquidity, US long-term debt and dollar series from FRED, and sovereign stress for every country the
          portfolio is exposed to (World Bank, keyless). Stored values only until you refresh.
        </p>
        <Button variant="secondary" onClick={() => void refresh()} disabled={refreshing}>
          {refreshing ? "Refreshing…" : "Refresh Dalio data"}
        </Button>
      </div>
      {error && <p className="text-sm text-negative">{error}</p>}
      {failed.length > 0 && (
        <details className="text-xs text-caution">
          <summary className="cursor-pointer">{failed.length} fetch problem(s)</summary>
          <ul className="mt-1 list-disc pl-5">
            {failed.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </details>
      )}
      {!data ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {data.derived.map((d) => (
              <Card key={d.key}>
                <p className="text-xs text-ink-muted">{d.label}</p>
                <p className="tabular mt-1 font-display text-2xl font-semibold text-ink">
                  {d.value === null ? "—" : `${formatDecimal(d.value)} ${d.unit}`}
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  {d.value === null
                    ? d.reason
                    : `${d.observed_on}${d.change_12m !== null ? ` · 12-month change ${Number(d.change_12m) > 0 ? "+" : ""}${formatDecimal(d.change_12m)}` : ""}`}
                </p>
                <p className="mt-2 text-xs text-ink-faint">{d.description}</p>
              </Card>
            ))}
          </div>
          <Card>
            <SectionTitle hint={`Catalogue ${data.series_version}`}>FRED series</SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <tbody>
                  {data.series.map((s) => (
                    <tr key={s.key} className="border-t border-border-subtle first:border-t-0">
                      <td className="py-2 pr-3">
                        <span className="text-ink">{s.label}</span>
                        <span className="block text-xs text-ink-faint">{s.source_series_id}</span>
                      </td>
                      <td className="tabular py-2 pr-3 text-right text-ink">
                        {s.value === null ? "—" : `${formatDecimal(s.value)} ${s.display_unit}`}
                      </td>
                      <td className="py-2 text-xs text-ink-muted">
                        {s.value === null ? s.last_error ?? "not fetched yet" : s.observed_on}
                        {s.stale && <span className="ml-1 text-caution">stale</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card>
            <SectionTitle hint="Sovereign Stress Index 0-100 (higher = more stress). Ported from the CWO app, without its uncalibrated crisis probabilities.">
              Country risk
            </SectionTitle>
            {data.countries.length === 0 ? (
              <p className="text-xs text-ink-faint">No portfolio countries determined yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {data.countries.map((c) => (
                  <div key={c.country} className="rounded-lg border border-border-subtle p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-medium text-ink">{c.name}</p>
                      <p className="text-sm text-ink-muted">
                        {c.ssi_score === null ? "SSI n/a" : `SSI ${c.ssi_score} · ${c.ssi_band}`}
                      </p>
                    </div>
                    <p className="text-xs text-ink-faint">
                      {c.currency} {c.sdr_basket_currency ? "(SDR reserve currency)" : ""} · data quality {c.data_quality}
                    </p>
                    <ul className="mt-2 space-y-0.5 text-xs text-ink-muted">
                      {c.figures
                        .filter((f) => f.value !== null)
                        .map((f) => (
                          <li key={f.label}>
                            {f.label}: <span className="tabular text-ink">{formatDecimal(f.value as string)}</span> ({f.data_year})
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card>
            <SectionTitle hint={`${data.gold_demand.source}`}>Central-bank gold demand</SectionTitle>
            <p className="text-sm text-ink">
              Last four quarters: {data.gold_demand.last_four_quarters.map(([p, t]) => `${p} ${formatDecimal(t, 0)} t`).join(" · ")}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              Yearly average 2015-2021: {data.gold_demand.avg_2015_2021} t; 2022-2024: {data.gold_demand.avg_2022_2024} t.
            </p>
            {data.gold_demand.quarters_behind > 0 && (
              <p className="mt-1 text-xs text-caution">
                Static dataset ending {data.gold_demand.as_of} — {data.gold_demand.quarters_behind} published quarter(s)
                behind; needs a manual refresh.
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard

/** Small dashboard card in Dalio / side-by-side mode. In side-by-side mode it
 * also triggers the portfolio-wide auto-queue (story 22.7, server-guarded). */
export function AnalystModeDashboardCard() {
  const { mode } = useAnalystMode();
  const [board, setBoard] = useState<CycleFitBoard | null>(null);
  const [queuedLine, setQueuedLine] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "buffett_munger") return;
    api.getCycleFitBoard().then(setBoard).catch(() => setBoard(null));
    if (mode === "side_by_side") {
      api
        .autoQueuePortfolio()
        .then((r) => setQueuedLine(r.queued_count ? `${r.queued_count} missing run(s) auto-queued on your PC.` : null))
        .catch(() => undefined);
    }
  }, [mode]);

  if (mode === "buffett_munger" || !board) return null;
  const roles = new Map<string, number>();
  for (const r of board.rows) {
    if (r.portfolio_role) roles.set(r.portfolio_role, (roles.get(r.portfolio_role) ?? 0) + Number(r.weight_pct ?? 0));
  }
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <SectionTitle hint={`${board.dalio_analyzed_count} of ${board.rows.length} holdings have a Dalio analysis`}>
            {mode === "dalio" ? "Dalio view" : "Buffett/Munger vs Dalio"}
          </SectionTitle>
          <div className="flex flex-wrap gap-2">
            {[...roles.entries()].map(([role, w]) => (
              <span key={role} className="rounded-full bg-accent-subtle px-2 py-0.5 text-xs font-medium text-accent">
                {ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role} {formatPct100(w)}
              </span>
            ))}
            {mode === "side_by_side" &&
              (Object.keys(AGREEMENT_LABELS) as Agreement[]).map((a) =>
                board.agreement_counts[a] ? (
                  <span key={a} className={`rounded-full px-2 py-0.5 text-xs font-medium ${AGREEMENT_STYLES[a]}`}>
                    {AGREEMENT_LABELS[a]} {board.agreement_counts[a]}
                  </span>
                ) : null,
              )}
          </div>
          {queuedLine && <p className="mt-2 text-xs text-ink-muted">{queuedLine}</p>}
        </div>
        <div className="flex gap-3 text-sm">
          <Link to="/margin-of-safety" className="text-accent hover:text-accent-hover">
            Cycle-fit board →
          </Link>
          <Link to="/risk" className="text-accent hover:text-accent-hover">
            All-Weather →
          </Link>
        </div>
      </div>
    </Card>
  );
}
