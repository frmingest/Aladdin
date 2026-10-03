import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { loadStore, type StoreData } from "../lib/marketStore";
import { formatDate, formatMoney, formatMultiple, formatPercent, formatRelative } from "../lib/format";
import { METRIC_INFO } from "../lib/glossary";
import {
  MARKET_PATH,
  MARKET_RULES,
  MARKET_RULES_VERSION,
  MERCHANT_LINE,
  STORE_LEVEL_LABEL,
  analystMoat,
  analystVerdict,
  baseScenario,
  buildGates,
  buildLadder,
  cushionPrice,
  judgeStore,
  nextSteps,
  scenarioPoints,
  shopFront,
  type Gate,
} from "../lib/marketplace";
import {
  METRIC_LABELS,
  MONEY_METRICS,
  PERCENT_METRICS,
  isFundBlindPass,
  type AnalysisRun,
  type HoldingMetrics,
  type HoldingThesis,
  type VerdictContent,
  type WatchlistRow,
} from "../lib/types";
import { Awning, DecisionScales, DoorIcon, Merchant } from "../components/marketplace/MarketArt";
import { LEVEL_PAINT, TONE_PAINT } from "../lib/marketplacePaint";
import PriceBoard from "../components/marketplace/PriceBoard";
import { InfoTooltip } from "../components/InfoTooltip";
import { Button, Card, EmptyState, SectionJumpBar, VerdictBadge } from "../components/ui";

/** A store in the Marketplace (game mode, G9): the deep-dive on one watchlist company, built
 * to help decide whether to look further, wait or pass. Read-only: it shows what the app has
 * already stored (valuation, ratios, the stored analysis, the thesis monitor) and reads it
 * through eight gates. The one thing it can change is your own price on the watchlist. It
 * never trades, scores or rewards anything. */

const METHOD_LABEL: Record<string, string> = {
  owner_earnings_dcf: "Owner-earnings DCF (bear, base and bull growth)",
  financials_price_to_book: "Justified price-to-book (banks and insurers)",
  fund_look_through_pe: "Look-through earnings yield of the fund's holdings",
};

const SOURCE_LABEL: Record<Gate["source"], string> = {
  rule: "Fixed rule over stored numbers",
  model: "The analysis model's reading",
  you: "Your own input",
};

const STATUS_TEXT_TONE: Record<Gate["status"], string> = {
  open: "text-positive",
  ajar: "text-caution",
  closed: "text-negative",
  unknown: "text-ink-faint",
  na: "text-ink-faint",
};

const SHELF_KEYS = [
  "roic",
  "roe",
  "operating_margin",
  "net_margin",
  "net_debt_to_ebitda",
  "interest_coverage",
  "fcf_yield",
  "price_to_earnings",
  "price_to_book",
  "ev_to_ebitda",
] as const;

function shelfValue(key: string, value: string, currency: string | null): string {
  if (PERCENT_METRICS.has(key)) return formatPercent(value);
  if (MONEY_METRICS.has(key)) return formatMoney(value, currency);
  return formatMultiple(value);
}

function fmtPrice(v: number | null, currency: string | null): string {
  if (v === null) return "—";
  return `${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ""}`;
}

export default function MarketStorePage() {
  const { holdingId = "" } = useParams();
  const [data, setData] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    loadStore(holdingId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [holdingId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    document.title = `${data?.holding?.name ?? "Store"} · Marketplace · Aladdin`;
  }, [data?.holding?.name]);

  const view = useMemo(() => {
    if (!data) return null;
    const gates = buildGates({
      instrumentType: data.holding?.asset_class_raw ?? data.row?.instrument_type ?? "stock",
      row: data.row,
      valuation: data.valuation,
      analysis: data.analysis,
      thesis: data.thesis,
      metrics: data.metrics,
    });
    const verdict = judgeStore(gates);
    return {
      gates,
      verdict,
      ladder: buildLadder(data.valuation, data.row),
      steps: nextSteps(gates, data.valuation),
    };
  }, [data]);

  if (!data && loading) return <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6"><EmptyState>The merchant is counting his stock…</EmptyState></div>;
  if (!data || !view) return null;

  const { holding, row, valuation, analysis, thesis, metrics } = data;

  if (!holding) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
        <Link to={MARKET_PATH} className="text-sm text-accent hover:underline">← Back to the Marketplace</Link>
        <Card className="border-negative/40 bg-negative-subtle text-sm text-negative">
          This store could not be opened. {data.problems.join(" ")}
        </Card>
      </div>
    );
  }

  const { gates, verdict, ladder, steps } = view;
  const paint = LEVEL_PAINT[verdict.level];
  const front = row ? shopFront(row) : null;
  const awning = front ? TONE_PAINT[front.tone] : TONE_PAINT.mist;
  const currency = valuation?.valuation_currency ?? row?.price_currency ?? null;
  const base = baseScenario(scenarioPoints(valuation));
  const cushion = cushionPrice(valuation);
  const verdictRating = analystVerdict(analysis, row);
  const priceNow = valuation?.current_price_per_share ?? row?.price ?? null;

  const hud: { label: string; value: React.ReactNode }[] = [
    { label: "Price today", value: fmtPrice(priceNow === null ? null : Number(priceNow), currency) },
    { label: "Your price", value: row?.buy_below_price ? fmtPrice(Number(row.buy_below_price), row.buy_below_currency) : "Not named" },
    { label: "Base-case value", value: fmtPrice(base ? base.value : null, currency) },
    { label: "Price with a 25% cushion", value: fmtPrice(cushion, currency) },
    { label: "Stored analyst word", value: <VerdictBadge rating={verdictRating} /> },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <nav aria-label="Where you are" className="mb-3 flex flex-wrap items-center gap-1.5 text-sm text-ink-muted">
        <Link to="/fortress" className="hover:text-ink">Fortress</Link>
        <span aria-hidden>›</span>
        <Link to={MARKET_PATH} className="hover:text-ink">Marketplace</Link>
        <span aria-hidden>›</span>
        <span className="text-ink">{holding.name}</span>
      </nav>

      {/* The shopfront */}
      <div className="market-shop">
        <Awning a={awning.a} b={awning.b} className="market-awning" />
        <div className="grid items-center gap-4 p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <div className="market-sign">
              <h1 className="font-display text-xl text-[#f3e4bf] sm:text-2xl">{holding.name}</h1>
              <p className="text-xs text-[#c9b68a]">
                {holding.ticker}
                {holding.sector ? ` · ${holding.sector}` : ""}
                {` · ${holding.trading_currency}`}
              </p>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              {row?.owned && <span className="rounded-full bg-accent-subtle px-2.5 py-1 font-semibold text-ink">Already a tower in your fortress</span>}
              {front && <span className="rounded-full bg-border-subtle px-2.5 py-1 text-ink-muted">{front.tag}</span>}
              {!row && <span className="rounded-full bg-caution-subtle px-2.5 py-1 font-semibold text-caution">Not on your watchlist</span>}
            </div>
          </div>
          <div className="flex items-end gap-3">
            <Merchant level={verdict.level} />
            <p className="market-bubble max-w-[16rem] text-sm">{MERCHANT_LINE[verdict.level]}</p>
          </div>
        </div>
        <dl className="game-hud mx-3 mb-3" aria-label="The store at a glance">
          {hud.map((i) => (
            <div key={i.label} className="game-hud-item">
              <div className="min-w-0">
                <dt className="game-hud-label">{i.label}</dt>
                <dd className="game-hud-value tabular">{i.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>

      {data.problems.length > 0 && (
        <Card className="mt-4 border-caution/40 bg-caution-subtle text-sm text-caution">
          <p className="font-semibold">Some shelves could not be stocked</p>
          <ul className="mt-1 list-disc pl-5">
            {data.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-6">
        <SectionJumpBar
          items={[
            { id: "market-verdict", label: "Decision" },
            { id: "market-gates", label: "Gates" },
            { id: "market-price", label: "Price board" },
            { id: "market-moat", label: "Moat tour" },
            { id: "market-shelves", label: "Numbers" },
            { id: "market-case", label: "The case" },
            { id: "market-tripwires", label: "Tripwires" },
            { id: "market-haggle", label: "Your price" },
          ]}
        />
      </div>

      <div className="space-y-6">
        {/* The decision */}
        <section id="market-verdict" className="scroll-mt-24">
          <Card>
            <div className="grid items-center gap-6 md:grid-cols-2">
              <div>
                <DecisionScales gates={gates} />
                <p className="tabular mt-2 text-center text-xs text-ink-muted">
                  {verdict.counts.open} open · {verdict.counts.ajar} ajar · {verdict.counts.closed} closed · {verdict.counts.unknown} unknown
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-faint">Where the store stands</p>
                <p className="mt-1 font-display text-2xl" style={{ color: paint.text }}>
                  {STORE_LEVEL_LABEL[verdict.level]}
                </p>
                <p className="mt-1 text-sm text-ink">{verdict.headline}</p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-muted">
                  {verdict.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                {steps.length > 0 && (
                  <div className="mt-4 rounded-md border border-border bg-raised p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">What would change the answer</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-muted">
                      {steps.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <p className="mt-4 text-xs text-ink-faint">
              A reading aid, not advice and not a score. It reports which gates stand open; the decision, and the homework behind it, stay with you.
              Nothing here trades.
            </p>
          </Card>
        </section>

        {/* The gates */}
        <section id="market-gates" className="scroll-mt-24">
          <h2 className="section-title">The gates</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {gates.map((g) => (
              <div key={g.id} className="rounded-lg border border-border bg-raised p-3">
                <div className="flex items-start gap-3">
                  <DoorIcon status={g.status} />
                  <div className="min-w-0">
                    <p className="font-display text-base text-ink">{g.title}</p>
                    <p className={`text-xs font-semibold uppercase tracking-wide ${STATUS_TEXT_TONE[g.status]}`}>
                      {g.status === "open" ? "Open" : g.status === "ajar" ? "Ajar" : g.status === "closed" ? "Closed" : g.status === "unknown" ? "Unknown" : "Not applicable"}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-xs italic text-ink-faint">{g.question}</p>
                <p className="mt-1 text-sm text-ink">{g.reading}</p>
                {g.facts.length > 0 && <p className="tabular mt-1 text-xs text-ink-muted">{g.facts.join(" · ")}</p>}
                <p className="mt-2 text-[11px] uppercase tracking-wide text-ink-faint">{SOURCE_LABEL[g.source]}</p>
              </div>
            ))}
          </div>
          <details className="mt-3 text-sm text-ink-muted">
            <summary className="cursor-pointer text-ink">How the gates are read ({MARKET_RULES_VERSION})</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Moat, analyst word: the stored analysis (Wide / Narrow / None; Strong Buy or Buy, Hold, Sell or Avoid). These are the model&apos;s readings of cited evidence.</li>
              <li>
                Walls: net debt / EBITDA up to {MARKET_RULES.debtOpenMax}× is open, up to {MARKET_RULES.debtAjarMax}× ajar, above that closed; interest cover under {MARKET_RULES.interestCoverMin}× lowers it one step. Net cash is open. Banks and funds are not judged this way.
              </li>
              <li>
                Earning power: ROIC of {MARKET_RULES.roicOpen * 100}% or more is open, {MARKET_RULES.roicAjar * 100}% or more ajar, below that closed (banks use ROE: {MARKET_RULES.roeOpen * 100}% and {MARKET_RULES.roeAjar * 100}%).
              </li>
              <li>Fair price: base-case margin of safety of {MARKET_RULES.priceOpenMos * 100}% or more is open, above zero ajar, zero or below closed. A withheld valuation is unknown, never a guess.</li>
              <li>Your price: at or below the price you named is open, within 10% above is ajar, further above is closed.</li>
              <li>Tripwires: intact is open, flagged for review is ajar, a fired tripwire is closed.</li>
              <li>Freshness: an analysis up to {MARKET_RULES.analysisFreshDays} days old is open, up to {MARKET_RULES.analysisStaleDays} ajar, older closed.</li>
              <li>
                Overall: a closed moat, walls, earning-power, analyst or tripwire gate means &quot;Pass for now&quot;; otherwise a closed price gate means &quot;Wait for the price&quot;; otherwise
                an unknown moat or price means &quot;Cannot judge yet&quot;; &quot;Gates open&quot; needs every business gate open and a real cushion.
              </li>
            </ul>
          </details>
        </section>

        {/* The price board */}
        <section id="market-price" className="scroll-mt-24">
          <h2 className="section-title">The price board</h2>
          <Card>
            {ladder ? (
              <PriceBoard ladder={ladder} />
            ) : (
              <p className="text-sm text-ink-muted">
                No valuation is on the board.{" "}
                {valuation?.valuation_status_reason ?? valuation?.unavailable_reasons?.[0] ?? "Open the company page to refresh the valuation."}
              </p>
            )}
            {valuation && (
              <p className="mt-3 text-xs text-ink-faint">
                Method: {METHOD_LABEL[valuation.valuation_method ?? "owner_earnings_dcf"] ?? valuation.valuation_method}. Assumptions {valuation.assumptions_version}
                {valuation.as_of ? ` · as of ${formatDate(valuation.as_of)}` : ""}.
              </p>
            )}
          </Card>
        </section>

        {/* Moat tour */}
        <section id="market-moat" className="scroll-mt-24">
          <h2 className="section-title">The moat tour</h2>
          <MoatTour analysis={analysis} fallback={analystMoat(analysis, row)} />
        </section>

        {/* Shelves */}
        <section id="market-shelves" className="scroll-mt-24">
          <h2 className="section-title">The numbers on the shelves</h2>
          <Shelves metrics={metrics} />
        </section>

        {/* The case */}
        <section id="market-case" className="scroll-mt-24">
          <h2 className="section-title">The case, from the stored analysis</h2>
          <TheCase analysis={analysis} />
        </section>

        {/* Tripwires */}
        <section id="market-tripwires" className="scroll-mt-24">
          <h2 className="section-title">Tripwires and changes</h2>
          <Tripwires thesis={thesis} holdingId={holding.id} />
        </section>

        {/* Your price */}
        <section id="market-haggle" className="scroll-mt-24">
          <h2 className="section-title">Name your price</h2>
          <NameYourPrice row={row} currency={currency} cushion={cushion} bear={scenarioPoints(valuation).find((p) => p.label.toLowerCase().includes("bear"))?.value ?? null} onSaved={load} />
        </section>

        <Card className="bg-raised">
          <p className="text-sm text-ink-muted">
            Where to go next: the{" "}
            <Link className="text-accent hover:underline" to={`/holdings/${holding.id}`}>full company page</Link> (filings, research, re-run the analysis), the{" "}
            <Link className="text-accent hover:underline" to="/journal">decision journal</Link> to write down what you decide and why, or back to the{" "}
            <Link className="text-accent hover:underline" to={MARKET_PATH}>street</Link>.
          </p>
          <p className="mt-2 text-xs text-ink-faint">
            Rules {MARKET_RULES_VERSION}. Shown only from stored data
            {analysis ? ` · analysis ${formatRelative(analysis.completed_at ?? analysis.started_at)}` : ""}. Missing data is drawn as unknown, never as a guess. Nothing on this page trades, scores or rewards anything.
          </p>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function MoatTour({ analysis, fallback }: { analysis: AnalysisRun | null; fallback: string | null }) {
  const moat = analysis?.blind_pass?.moat;
  if (!moat) {
    return (
      <Card>
        <p className="text-sm text-ink-muted">
          {fallback ? `The watchlist shows a ${fallback.toLowerCase()} moat, but the analysis behind it is not on file.` : "No analysis has been run, so the moat is not surveyed."}
        </p>
      </Card>
    );
  }
  const sources = "sources" in moat ? moat.sources : [];
  const tone = (r: string) => (r === "Wide" ? "bg-positive-subtle text-positive" : r === "Narrow" ? "bg-caution-subtle text-caution" : "bg-negative-subtle text-negative");
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone(moat.overall_rating)}`}>Overall: {moat.overall_rating}</span>
        {analysis && isFundBlindPass(analysis.blind_pass!) && <span className="text-xs text-ink-faint">Look-through reading of the fund&apos;s holdings</span>}
      </div>
      <p className="mt-3 text-sm text-ink">{moat.circle_of_competence_summary}</p>
      {"coverage_caveat" in moat && moat.coverage_caveat && <p className="mt-2 text-xs text-ink-faint">{moat.coverage_caveat}</p>}
      {sources.length > 0 && (
        <ul className="mt-4 grid gap-2 md:grid-cols-2">
          {sources.map((s) => (
            <li key={s.source} className="rounded-md border border-border bg-raised p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium capitalize text-ink">{s.source.replace(/_/g, " ")}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone(s.rating)}`}>{s.rating}</span>
              </div>
              <p className="mt-1 text-xs text-ink-muted">{s.reasoning}</p>
              <p className="mt-1 text-[11px] text-ink-faint">{s.evidence_ids.length} cited evidence {s.evidence_ids.length === 1 ? "item" : "items"}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Shelves({ metrics }: { metrics: HoldingMetrics | null }) {
  if (!metrics) {
    return (
      <Card>
        <p className="text-sm text-ink-muted">No filing ratios are stored. Upload the latest annual report (.xhtml) on the company page to stock these shelves.</p>
      </Card>
    );
  }
  const have = SHELF_KEYS.filter((k) => metrics.computed[k] !== undefined);
  const missing = SHELF_KEYS.filter((k) => metrics.computed[k] === undefined);
  return (
    <Card>
      <p className="mb-3 text-xs text-ink-faint">
        Period {metrics.period}
        {metrics.currency ? ` · figures in ${metrics.currency}` : ""}
        {metrics.prior_period ? ` · returns averaged with ${metrics.prior_period}` : ""}. Deterministic ratios from the stored filing; no model involved.
      </p>
      {metrics.warnings.length > 0 && (
        <div className="mb-3 rounded-md border border-negative/30 bg-negative/5 px-3 py-2 text-xs text-ink-muted">
          <p className="font-semibold text-ink">Check before relying on these figures</p>
          <ul className="list-disc pl-5">
            {metrics.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {have.map((k) => (
          <div key={k} className="rounded-md border border-border bg-raised p-3">
            <dt className="inline-flex items-center gap-1 text-xs text-ink-muted">
              {METRIC_LABELS[k]}
              {METRIC_INFO[k] && <InfoTooltip text={METRIC_INFO[k]} align="left" />}
            </dt>
            <dd className="tabular mt-1 font-display text-lg text-ink">{shelfValue(k, metrics.computed[k], metrics.currency)}</dd>
          </div>
        ))}
      </dl>
      {missing.length > 0 && (
        <p className="mt-3 text-xs text-ink-faint">
          Not stored or not meaningful for this company: {missing.map((k) => METRIC_LABELS[k]).join(", ")}.
        </p>
      )}
    </Card>
  );
}

function verdictContent(analysis: AnalysisRun | null): VerdictContent | null {
  return analysis?.reconciliation?.verdict ?? analysis?.blind_pass?.verdict ?? null;
}

function TheCase({ analysis }: { analysis: AnalysisRun | null }) {
  const v = verdictContent(analysis);
  if (!analysis || !v) {
    return (
      <Card>
        <p className="text-sm text-ink-muted">No analysis has been run for this company. Run it from the company page (it uses analysis quota, so it is not started from here).</p>
      </Card>
    );
  }
  const cols: { title: string; items: string[]; mark: string }[] = [
    { title: "Why it could be worth owning", items: v.thesis_bullets, mark: "◆" },
    { title: "What could go wrong", items: v.top_risks, mark: "▲" },
    { title: "What would prove it wrong", items: v.invalidation_triggers, mark: "✕" },
    { title: "What to keep watching", items: v.metrics_to_monitor, mark: "◉" },
  ];
  const bp = analysis.blind_pass;
  const notes: { title: string; text: string }[] = [];
  if (bp) {
    if (isFundBlindPass(bp)) {
      notes.push(
        { title: "Costs and stewardship", text: bp.steward_and_costs.summary },
        { title: "Portfolio construction", text: bp.portfolio_construction.summary },
        { title: "Role in a portfolio", text: bp.role_in_portfolio.summary },
      );
    } else {
      notes.push({ title: "Capital efficiency", text: bp.capital_efficiency.summary }, { title: "Financial fortress", text: bp.financial_fortress.summary });
    }
    notes.push({ title: "Under macro stress", text: bp.macro_stress_test.summary }, { title: "Valuation notes", text: bp.valuation_synthesis.summary });
  }
  if (analysis.reconciliation?.reconciliation_narrative) {
    notes.push({ title: "After reconciling with your notes", text: analysis.reconciliation.reconciliation_narrative });
  }
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-faint">
        <VerdictBadge rating={v.rating} />
        <span>
          Written by {analysis.model_name ?? analysis.provider ?? "the analysis model"} from cited evidence · {formatDate(analysis.completed_at ?? analysis.started_at)}. It is the model&apos;s reading, not a computed figure.
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {cols.map((c) => (
          <div key={c.title}>
            <h3 className="mb-1 text-sm font-semibold text-ink">{c.title}</h3>
            {c.items.length === 0 ? (
              <p className="text-xs text-ink-faint">Nothing listed.</p>
            ) : (
              <ul className="space-y-1.5 text-sm text-ink-muted">
                {c.items.map((it) => (
                  <li key={it} className="flex gap-2">
                    <span aria-hidden className="mt-0.5 text-accent">{c.mark}</span>
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      {analysis.price_target_low && analysis.price_target_high && (
        <p className="tabular mt-4 text-sm text-ink-muted">
          Stored price range from the bear and bull DCF: {analysis.price_target_low} to {analysis.price_target_high} {analysis.price_target_currency ?? ""}
          {analysis.price_target_warning ? ` · ${analysis.price_target_warning}` : ""}
        </p>
      )}
      {notes.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-ink">Read the analyst&apos;s notes</summary>
          <div className="mt-2 space-y-3 text-sm text-ink-muted">
            {notes.map((n) => (
              <div key={n.title}>
                <p className="font-medium text-ink">{n.title}</p>
                <p>{n.text}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </Card>
  );
}

function Tripwires({ thesis, holdingId }: { thesis: HoldingThesis | null; holdingId: string }) {
  if (!thesis) {
    return (
      <Card>
        <p className="text-sm text-ink-muted">The thesis monitor could not be read.</p>
      </Card>
    );
  }
  const active = thesis.tripwires.filter((t) => t.active);
  return (
    <Card>
      <p className="text-sm text-ink">
        Thesis: <span className="font-medium">{thesis.status_label}</span>
        {thesis.analyzed_at ? <span className="text-ink-faint"> · analysed {formatDate(thesis.analyzed_at)}</span> : null}
      </p>
      {thesis.change_reasons.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
          {thesis.change_reasons.map((r) => (
            <li key={r.key}>{r.text}</li>
          ))}
        </ul>
      )}
      {active.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">No tripwires are set yet. Set them on the thesis page so a change you care about rings a bell.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border-subtle text-sm">
          {active.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="text-ink">{t.label ?? t.metric_label}</span>
              <span className="tabular text-ink-muted">
                {t.metric_label} {t.operator} {t.threshold}
                {t.current_value !== null ? ` · now ${t.current_value}` : ""}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${t.firing ? "bg-negative-subtle text-negative" : "bg-positive-subtle text-positive"}`}>
                {t.firing ? "Fired" : "Quiet"}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-ink-faint">
        <Link className="text-accent hover:underline" to="/thesis">Open the thesis monitor</Link> · <Link className="text-accent hover:underline" to={`/holdings/${holdingId}`}>company page</Link>
      </p>
    </Card>
  );
}

function NameYourPrice({
  row,
  currency,
  cushion,
  bear,
  onSaved,
}: {
  row: WatchlistRow | null;
  currency: string | null;
  cushion: number | null;
  bear: number | null;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(row?.buy_below_price ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => setValue(row?.buy_below_price ?? ""), [row?.buy_below_price]);

  if (!row) {
    return (
      <Card>
        <p className="text-sm text-ink-muted">
          This company is not on your watchlist, so there is no price to name. Add it on the <Link className="text-accent hover:underline" to="/watchlist">Watchlist</Link> page.
        </p>
      </Card>
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!row) return;
    const cleaned = value.trim().replace(/\s/g, "").replace(",", ".");
    if (cleaned !== "" && !/^\d+(\.\d+)?$/.test(cleaned)) {
      setMsg({ ok: false, text: "Type a plain positive number, like 120 or 120.50." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await api.updateWatchlistEntry(row.id, { buy_below_price: cleaned === "" ? null : cleaned });
      setMsg({ ok: true, text: cleaned === "" ? "Your price was cleared." : "Your price was saved." });
      onSaved();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : "Could not save." });
    } finally {
      setBusy(false);
    }
  }

  const chip = "rounded-full border border-border px-3 py-1 text-xs text-ink-muted transition-colors hover:border-accent hover:text-ink";
  return (
    <Card>
      <p className="text-sm text-ink-muted">
        The price at which you would be happy to own it. It is your own number, kept on your watchlist; it places nothing and trades nothing.
      </p>
      <form onSubmit={save} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Your price{currency ? ` (${currency})` : ""}
          <input
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="tabular w-40 rounded-md border border-border px-2.5 py-1.5 text-sm text-ink"
            placeholder="e.g. 120"
          />
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save my price"}
        </Button>
        {cushion !== null && (
          <button type="button" className={chip} onClick={() => setValue(cushion.toFixed(2))}>
            Use the 25% cushion price ({cushion.toFixed(2)})
          </button>
        )}
        {bear !== null && (
          <button type="button" className={chip} onClick={() => setValue(bear.toFixed(2))}>
            Use the bear case ({bear.toFixed(2)})
          </button>
        )}
      </form>
      {msg && (
        <p role="status" className={`mt-2 text-sm ${msg.ok ? "text-positive" : "text-negative"}`}>
          {msg.text}
        </p>
      )}
      {row.notes && <p className="mt-3 text-sm text-ink-muted">Your note on the watchlist: {row.notes}</p>}
    </Card>
  );
}
