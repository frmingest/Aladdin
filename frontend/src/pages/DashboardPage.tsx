import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { formatDate, formatNok, formatPct100 } from "../lib/format";
import type { AllocationSlice, PortfolioOverview, RatingSlice, SummaryPoint } from "../lib/types";
import { INSTRUMENT_TYPE_LABELS } from "../lib/types";
import { Card, EmptyState, PageHeader, SectionTitle, StatTile, VerdictBadge } from "../components/ui";

/** Sprint 5 dashboard, the app's home page. Everything comes from
 * GET /portfolio/overview (backend/app/services/portfolio_overview.py),
 * which reads the database only: no price refresh, no LLM call. So this
 * page loads instantly, and every number and summary sentence is computed
 * deterministically on the server. */

const TONE: Record<SummaryPoint["tone"], { icon: string; className: string; label: string }> = {
  good: { icon: "✓", className: "bg-positive-subtle text-positive", label: "Good" },
  info: { icon: "i", className: "bg-border-subtle text-ink-muted", label: "Note" },
  warn: { icon: "!", className: "bg-caution-subtle text-caution", label: "Check" },
};

type AllocationView = "sector" | "type" | "currency" | "account";

const VIEWS: { key: AllocationView; label: string }[] = [
  { key: "sector", label: "Sector" },
  { key: "type", label: "Instrument" },
  { key: "currency", label: "Currency" },
  { key: "account", label: "Account" },
];

/** One horizontal magnitude bar per row. Single hue (magnitude, not
 * identity), label and value always shown as text, so the colour never
 * carries meaning on its own. */
function BarRows({
  rows,
}: {
  rows: { key: string; label: React.ReactNode; pct: number; value: string; sub?: string }[];
}) {
  const max = Math.max(...rows.map((r) => r.pct), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key} title={`${r.sub ?? ""}${r.sub ? " · " : ""}${r.value} · ${formatPct100(r.pct)}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink">{r.label}</span>
            <span className="tabular shrink-0 text-xs text-ink-muted">
              {r.value}
              <span className="ml-2 inline-block w-12 text-right font-medium text-ink">{formatPct100(r.pct)}</span>
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-border-subtle">
            <div
              className="h-1.5 rounded-full bg-accent"
              style={{ width: `${Math.max((r.pct / max) * 100, r.pct > 0 ? 1.5 : 0)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function allocationRows(slices: AllocationSlice[]) {
  return slices.map((s) => ({
    key: s.key,
    label: s.label,
    pct: Number(s.weight_pct),
    value: formatNok(s.value_nok),
    sub: `${s.holding_count} holding${s.holding_count === 1 ? "" : "s"}`,
  }));
}

function AllocationCard({ overview }: { overview: PortfolioOverview }) {
  const [view, setView] = useState<AllocationView>("sector");
  const total = Number(overview.total_value_nok);
  const rows =
    view === "sector"
      ? allocationRows(overview.by_sector)
      : view === "type"
        ? allocationRows(overview.by_instrument_type)
        : view === "currency"
          ? allocationRows(overview.by_currency)
          : overview.accounts.map((a) => ({
              key: a.account_id ?? a.name,
              label: a.name,
              pct: total > 0 ? (Number(a.value_nok) / total) * 100 : 0,
              value: formatNok(a.value_nok),
              sub: `${a.position_count} positions, snapshot ${formatDate(a.snapshot_at)}`,
            }));

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Allocation</h2>
        <div role="tablist" className="flex rounded-md border border-border bg-background/40 p-0.5 text-xs">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              role="tab"
              aria-selected={view === v.key}
              onClick={() => setView(v.key)}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                view === v.key ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
      <BarRows rows={rows} />
    </Card>
  );
}

function RatingRows({ slices, kind }: { slices: RatingSlice[]; kind: "verdict" | "moat" }) {
  if (slices.length === 0) return <p className="text-sm text-ink-muted">No stocks or equity ETFs owned.</p>;
  return (
    <BarRows
      rows={slices.map((s) => ({
        key: s.rating,
        label:
          kind === "verdict" ? (
            s.rating === "Not analyzed" ? (
              <span className="text-ink-muted">Not analyzed</span>
            ) : (
              <VerdictBadge rating={s.rating} />
            )
          ) : (
            <span className={s.rating === "Not analyzed" ? "text-ink-muted" : ""}>
              {s.rating === "None" ? "No moat" : s.rating === "Not analyzed" ? s.rating : `${s.rating} moat`}
            </span>
          ),
        pct: Number(s.weight_pct),
        value: `${s.holding_count} ${s.holding_count === 1 ? "stock" : "stocks"} · ${formatNok(s.value_nok)}`,
      }))}
    />
  );
}

function SummaryCard({ points }: { points: SummaryPoint[] }) {
  return (
    <Card>
      <SectionTitle hint="Rule-based, computed from your data. Not model output.">Executive summary</SectionTitle>
      <ul className="space-y-2">
        {points.map((p, i) => (
          <li key={i} className="flex gap-2.5 text-sm text-ink">
            <span
              aria-label={TONE[p.tone].label}
              className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${TONE[p.tone].className}`}
            >
              {TONE[p.tone].icon}
            </span>
            <span>{p.text}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function PositionsCard({ overview }: { overview: PortfolioOverview }) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? overview.positions : overview.positions.slice(0, 10);
  const maxWeight = Math.max(...overview.positions.map((p) => Number(p.weight_pct ?? 0)), 1);

  return (
    <Card>
      <SectionTitle hint="Summed across accounts, largest first.">Positions</SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-muted">
              <th className="py-2 pr-4 font-medium">Holding</th>
              <th className="py-2 pr-4 font-medium">Type · sector</th>
              <th className="py-2 pr-4 font-medium">Verdict</th>
              <th className="py-2 pr-4 font-medium">Moat</th>
              <th className="py-2 pr-4 text-right font-medium">Value</th>
              <th className="w-40 py-2 font-medium">Weight</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.holding_id} className="border-t border-border-subtle align-middle">
                <td className="py-2.5 pr-4">
                  <Link to={`/holdings/${p.holding_id}`} className="font-medium text-ink hover:text-accent">
                    {p.name}
                  </Link>
                  <p className="text-xs text-ink-faint">
                    {p.ticker}
                    {p.account_count > 1 && ` · ${p.account_count} accounts`}
                  </p>
                </td>
                <td className="py-2.5 pr-4 text-xs text-ink-muted">
                  {INSTRUMENT_TYPE_LABELS[p.instrument_type] ?? p.instrument_type}
                  {p.sector && <> · {p.sector}</>}
                </td>
                <td className="py-2.5 pr-4">
                  {p.instrument_type === "stock" || p.instrument_type === "equity_etf" ? (
                    <span className="inline-flex items-center gap-1.5">
                      <VerdictBadge
                        rating={p.verdict_rating}
                        title={p.analyzed_at ? `Analyzed ${formatDate(p.analyzed_at)}` : undefined}
                      />
                      {p.analysis_stale && (
                        <span className="text-xs text-caution" title="Older than 180 days">
                          stale
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-ink-faint">n/a</span>
                  )}
                </td>
                <td className="py-2.5 pr-4 text-xs text-ink-muted">{p.moat_rating ?? "—"}</td>
                <td className="tabular py-2.5 pr-4 text-right text-ink">{formatNok(p.value_nok)}</td>
                <td className="py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-border-subtle">
                      <div
                        className="h-1.5 rounded-full bg-accent"
                        style={{ width: `${(Number(p.weight_pct ?? 0) / maxWeight) * 100}%` }}
                      />
                    </div>
                    <span className="tabular w-12 text-right text-xs text-ink">{formatPct100(p.weight_pct)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {overview.positions.length > 10 && (
        <button
          onClick={() => setShowAll((s) => !s)}
          className="mt-3 text-sm font-medium text-accent hover:text-accent-hover"
        >
          {showAll ? "Show top 10" : `Show all ${overview.positions.length}`}
        </button>
      )}
    </Card>
  );
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<PortfolioOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getPortfolioOverview()
      .then(setOverview)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load the overview."));
  }, []);

  const c = overview?.concentration;
  const coverage = overview?.analyzed_equity_value_pct;

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <PageHeader
        title="Dashboard"
        subtitle={
          overview?.as_of
            ? `Latest snapshot of each account, newest from ${formatDate(overview.as_of)}.`
            : "Your portfolio at a glance."
        }
      />

      {error && <p className="text-sm text-negative">{error}</p>}
      {!overview && !error && <p className="text-sm text-ink-muted">Loading…</p>}

      {overview && overview.as_of === null && (
        <EmptyState>
          No portfolio imported yet. Upload a broker export on the{" "}
          <Link to="/portfolio" className="text-accent hover:text-accent-hover">
            Portfolio
          </Link>{" "}
          page to fill this dashboard.
        </EmptyState>
      )}

      {overview && overview.as_of !== null && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label="Portfolio value"
              value={formatNok(overview.total_value_nok)}
              hint={`${formatNok(overview.equity_value_nok)} in stocks and equity ETFs`}
            />
            <StatTile
              label="Holdings"
              value={overview.holding_count}
              hint={`${overview.position_count} positions in ${overview.accounts.length} account${
                overview.accounts.length === 1 ? "" : "s"
              }`}
            />
            <StatTile
              label="Top 5 share"
              value={formatPct100(c?.top5_pct ?? null)}
              hint={
                c?.effective_holdings
                  ? `Like ${Number(c.effective_holdings).toFixed(1)} equal positions (HHI ${Math.round(Number(c.hhi))})`
                  : undefined
              }
            />
            <StatTile
              label="Analysis coverage"
              value={formatPct100(coverage ?? null, 0)}
              tone={coverage !== null && coverage !== undefined && Number(coverage) < 50 ? "text-caution" : "text-ink"}
              hint={`${overview.analyzed_equity_count} of ${overview.equity_count} equities, by value`}
            />
          </div>

          {overview.summary.length > 0 && <SummaryCard points={overview.summary} />}

          <div className="grid gap-6 lg:grid-cols-2">
            <AllocationCard overview={overview} />
            <Card>
              <SectionTitle hint="Latest analysis per stock, share of equity value.">
                Buffett/Munger verdicts
              </SectionTitle>
              <RatingRows slices={overview.verdicts} kind="verdict" />
              <div className="my-5 border-t border-border-subtle" />
              <SectionTitle>Moat</SectionTitle>
              <RatingRows slices={overview.moats} kind="moat" />
              <p className="mt-4 text-xs text-ink-faint">
                See which ones are cheap on the{" "}
                <Link to="/margin-of-safety" className="text-accent hover:text-accent-hover">
                  Margin of safety
                </Link>{" "}
                board.
              </p>
            </Card>
          </div>

          <PositionsCard overview={overview} />
        </div>
      )}
    </div>
  );
}
