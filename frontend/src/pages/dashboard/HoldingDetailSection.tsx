import { useEffect, useState } from "react";
import {
  ApiError,
  createHoldingThesis,
  createHoldingValuationCase,
  getHoldingAnalysis,
  getHoldingValuationDefaults,
  getInvalidationCheck,
  listHoldingAnalyses,
  listHoldingTheses,
  listHoldingValuationCases,
  listHoldings,
  updateThesis,
} from "../../services/api";
import type { Holding } from "../../types/portfolio";
import { WHISKY_COLLECTION, collectionForAssetClass } from "../../components/CollectionFilter";
import type { ConfidenceLevel, HoldingAnalysisDetail, HoldingAnalysisSummary } from "../../types/analysis";
import type { InvalidationSignalOut, ThesisCreate, ThesisOut } from "../../types/thesis";
import type { ValuationCaseCreate, ValuationCaseOut, ValuationDefaults } from "../../types/dcf";
import { num } from "../../lib/num";
import ValuationScenarioChart from "../../charts/ValuationScenarioChart";
import InfoTooltip from "../../components/InfoTooltip";
import { HoldingAnalysisFullDetailWithMemo } from "../../components/HoldingAnalysisDetail";

const SECTION_EXPLANATION =
  "A drill-down into one holding at a time: how its AI analysis score has moved over time, the full results of its latest AI analysis run (the same detail view shown right after running an analysis), your own written thesis for owning it (and whether anything since invalidates it), and bear/base/bull valuation cases from the DCF model. Use this to understand the story behind any position that stands out elsewhere on the dashboard.";

// Every status app.models.thesis.InvestmentThesisStatus defines. Missing
// INVALIDATED from this map (the pre-existing bug this pass fixes) meant a
// broken thesis rendered in the same neutral text color as everything else
// — the one status that most needs to read as risk silently didn't.
const THESIS_STATUS_COLOR: Record<string, string> = {
  ACTIVE: "text-positive",
  UNDER_REVIEW: "text-warning",
  INVALIDATED: "text-negative",
  CLOSED: "text-tertiary",
};
// Plain-language labels for app.models.thesis.InvestmentThesisStatus's
// SCREAMING_SNAKE_CASE values — those are the wire format, not something
// meant to be read as-is in a dropdown.
const THESIS_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  UNDER_REVIEW: "Under review",
  INVALIDATED: "Invalidated",
  CLOSED: "Closed",
};
const THESIS_STATUSES = ["ACTIVE", "UNDER_REVIEW", "INVALIDATED", "CLOSED"];
const CONFIDENCE_LEVELS: ConfidenceLevel[] = ["low", "medium", "high"];
const CASE_TYPES = ["bull", "base", "bear"] as const;
const CASE_TYPE_LABELS: Record<string, string> = { bull: "Bull", base: "Base", bear: "Bear" };

// Shared form-control classes — the finance-terminal design system's own
// input-terminal/label-terminal/btn-terminal component classes, matching
// the convention across PortfolioUpload.tsx / RiskSection.tsx /
// AccountsSection rather than introducing a new style vocabulary.
const inputClass = "input-terminal";
const labelClass = "label-terminal";
const primaryButtonClass = "btn-terminal btn-terminal-primary text-xs px-3 py-1.5";
const ghostButtonClass = "btn-terminal text-xs px-3 py-1.5";

function ScoreTrend({ analyses }: { analyses: HoldingAnalysisSummary[] }) {
  // Oldest -> newest for a left-to-right reading of the trend.
  const ordered = [...analyses].reverse();
  return (
    <div className="flex items-end gap-1 h-16">
      {ordered.map((a) => {
        const score = num(a.overall_score) ?? 0;
        const height = Math.max(4, (score / 10) * 100);
        const color = score >= 7 ? "var(--color-positive)" : score >= 5 ? "var(--color-warning)" : "var(--color-negative)";
        return (
          <div key={a.id} className="flex flex-col items-center gap-1" title={`${a.thesis_status} — ${a.overall_score ?? "n/a"}/10`}>
            <div className="w-4 rounded-t" style={{ height: `${height}%`, background: color }} />
          </div>
        );
      })}
    </div>
  );
}

function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Inline "+ New thesis" toggle + form — the historical thesis ledger (§16)
 * was API-only until this pass; this is the form that closes that gap. */
function NewThesisForm({ holdingId, onCreated }: { holdingId: string; onCreated: (t: ThesisOut) => void }) {
  const [open, setOpen] = useState(false);
  const [thesis, setThesis] = useState("");
  const [bullCase, setBullCase] = useState("");
  const [bearCase, setBearCase] = useState("");
  const [keyAssumptions, setKeyAssumptions] = useState("");
  const [invalidationConditions, setInvalidationConditions] = useState("");
  const [confidence, setConfidence] = useState<ConfidenceLevel>("medium");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!thesis.trim()) return;
    setSubmitting(true);
    setError(null);
    const body: ThesisCreate = {
      thesis: thesis.trim(),
      bull_case: bullCase.trim() || null,
      bear_case: bearCase.trim() || null,
      key_assumptions: linesToList(keyAssumptions),
      invalidation_conditions: linesToList(invalidationConditions),
      confidence,
    };
    try {
      const created = await createHoldingThesis(holdingId, body);
      onCreated(created);
      setThesis("");
      setBullCase("");
      setBearCase("");
      setKeyAssumptions("");
      setInvalidationConditions("");
      setConfidence("medium");
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail ?? err.message) : "Could not save thesis.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={primaryButtonClass}>
        + New thesis
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="terminal-panel space-y-3 mb-3">
      <div>
        <label className={labelClass}>Thesis</label>
        <textarea
          value={thesis}
          onChange={(e) => setThesis(e.target.value)}
          rows={2}
          placeholder="Why you own this — the core case in a sentence or two."
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Bull case (optional)</label>
          <textarea value={bullCase} onChange={(e) => setBullCase(e.target.value)} rows={2} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Bear case (optional)</label>
          <textarea value={bearCase} onChange={(e) => setBearCase(e.target.value)} rows={2} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Key assumptions (one per line)</label>
          <textarea
            value={keyAssumptions}
            onChange={(e) => setKeyAssumptions(e.target.value)}
            rows={2}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Invalidation conditions (one per line)</label>
          <textarea
            value={invalidationConditions}
            onChange={(e) => setInvalidationConditions(e.target.value)}
            rows={2}
            className={inputClass}
          />
        </div>
      </div>
      <div className="flex items-end gap-3">
        <div>
          <label className={labelClass}>Confidence</label>
          <select
            value={confidence}
            onChange={(e) => setConfidence(e.target.value as ConfidenceLevel)}
            className={inputClass}
          >
            {CONFIDENCE_LEVELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={!thesis.trim() || submitting} className={primaryButtonClass}>
          {submitting ? "Saving…" : "Save thesis"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={ghostButtonClass}>
          Cancel
        </button>
      </div>
      {error && <p className="text-negative text-xs">{error}</p>}
    </form>
  );
}

/** Editable status control for one thesis-ledger entry (PATCH /thesis/{id})
 * — replaces the old static status text so a thesis can actually be moved
 * to UNDER_REVIEW/INVALIDATED/CLOSED from the dashboard instead of only
 * ever being created and left ACTIVE forever. */
function ThesisStatusSelect({ thesis, onUpdated }: { thesis: ThesisOut; onUpdated: (t: ThesisOut) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(status: string) {
    if (status === thesis.status) return;
    setSaving(true);
    setError(null);
    try {
      onUpdated(await updateThesis(thesis.id, { status }));
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail ?? err.message) : "Could not update status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <select
        value={thesis.status}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving}
        title="Update thesis status"
        className={`bg-tertiary border border-primary rounded px-1 py-0.5 text-xs font-medium font-mono disabled:opacity-50 ${
          THESIS_STATUS_COLOR[thesis.status] ?? "text-secondary"
        }`}
      >
        {THESIS_STATUSES.map((s) => (
          <option key={s} value={s} className="bg-secondary text-primary">
            {THESIS_STATUS_LABELS[s] ?? s}
          </option>
        ))}
      </select>
      {error && <span className="text-negative text-xs">{error}</span>}
    </span>
  );
}

type DcfFieldKey =
  | "revenue_growth_pct"
  | "margin_pct"
  | "capex_pct_of_revenue"
  | "tax_rate_pct"
  | "discount_rate_pct"
  | "terminal_growth_pct"
  | "shares_outstanding"
  | "projection_years";

const DCF_FIELDS: { key: DcfFieldKey; label: string; placeholder: string }[] = [
  { key: "revenue_growth_pct", label: "Revenue growth %", placeholder: "e.g. 6" },
  { key: "margin_pct", label: "Operating margin %", placeholder: "e.g. 18" },
  { key: "capex_pct_of_revenue", label: "Capex % of revenue", placeholder: "e.g. 5" },
  { key: "tax_rate_pct", label: "Tax rate %", placeholder: "e.g. 22" },
  { key: "discount_rate_pct", label: "Discount rate %", placeholder: "e.g. 9" },
  { key: "terminal_growth_pct", label: "Terminal growth %", placeholder: "e.g. 2" },
  { key: "shares_outstanding", label: "Shares outstanding", placeholder: "e.g. 120000000" },
  { key: "projection_years", label: "Projection years", placeholder: "5" },
];
const REQUIRED_DCF_FIELDS: DcfFieldKey[] = [
  "revenue_growth_pct",
  "margin_pct",
  "capex_pct_of_revenue",
  "tax_rate_pct",
  "discount_rate_pct",
  "terminal_growth_pct",
  "shares_outstanding",
];

/** ECON-001 fix (docs/decisions/0014-macro-economic-review.md): a small
 * hint under discount_rate_pct showing the risk-free-rate + equity-risk-
 * premium anchor the app already has, with a one-click "Use" — never
 * auto-filled (§21). Renders nothing while the suggestion is unavailable
 * (no macro refresh yet, or an unmapped currency) rather than an empty box. */
function DiscountRateHint({
  suggestion,
  onUse,
}: {
  suggestion: import("../../types/dcf").DiscountRateSuggestion | null;
  onUse: (value: string) => void;
}) {
  if (!suggestion) return null;
  if (!suggestion.available) {
    return <p className="text-xs text-tertiary mt-1">{suggestion.reason}</p>;
  }
  return (
    <p className="text-xs text-tertiary mt-1">
      Anchor: {num(suggestion.risk_free_pct)}% risk-free ({suggestion.risk_free_series_used.join(" + ")}) +{" "}
      {num(suggestion.equity_risk_premium_pct)}% ERP ={" "}
      <button
        type="button"
        onClick={() => onUse(suggestion.suggested_discount_rate_pct ?? "")}
        className="underline hover:text-secondary"
      >
        {num(suggestion.suggested_discount_rate_pct)}% — use
      </button>
    </p>
  );
}

/** Same pattern as DiscountRateHint for fx_rate_to_reporting. */
function FxRateHint({
  suggestion,
  onUse,
}: {
  suggestion: import("../../types/dcf").FxRateSuggestion | null;
  onUse: (value: string) => void;
}) {
  if (!suggestion) return null;
  if (!suggestion.available) {
    return <p className="text-xs text-tertiary mt-1">{suggestion.reason}</p>;
  }
  return (
    <p className="text-xs text-tertiary mt-1">
      Latest: {suggestion.from_currency}/{suggestion.to_currency} ={" "}
      <button
        type="button"
        onClick={() => onUse(suggestion.rate ?? "")}
        className="underline hover:text-secondary"
      >
        {num(suggestion.rate)} — use
      </button>
    </p>
  );
}

/** Inline "+ New valuation case" toggle + form — the DCF engine (§17) was
 * API-only until this pass. Required inputs are a flat grid (the common
 * case); the currency/FX/commodity/base-revenue overrides that most
 * holdings never need are tucked behind "Advanced options" so this doesn't
 * turn into a 13-field wall on every holding. */
function NewValuationCaseForm({
  holdingId,
  onCreated,
}: {
  holdingId: string;
  onCreated: (c: ValuationCaseOut) => void;
}) {
  const [open, setOpen] = useState(false);
  const [caseType, setCaseType] = useState<(typeof CASE_TYPES)[number]>("base");
  const [fields, setFields] = useState<Record<DcfFieldKey, string>>({
    revenue_growth_pct: "",
    margin_pct: "",
    capex_pct_of_revenue: "",
    tax_rate_pct: "",
    discount_rate_pct: "",
    terminal_growth_pct: "",
    shares_outstanding: "",
    projection_years: "5",
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [commodityMultiplier, setCommodityMultiplier] = useState("");
  const [fxRate, setFxRate] = useState("");
  const [netDebt, setNetDebt] = useState("");
  const [baseRevenueOverride, setBaseRevenueOverride] = useState("");
  const [currency, setCurrency] = useState("");
  const [runCritique, setRunCritique] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ECON-001 fix (docs/decisions/0014): a suggested discount rate/FX rate,
  // grounded in the macro/FX data the app already fetches — shown next to
  // the fields it applies to, never auto-filled (§21).
  const [defaults, setDefaults] = useState<ValuationDefaults | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getHoldingValuationDefaults(holdingId)
      .then((d) => {
        if (!cancelled) setDefaults(d);
      })
      .catch(() => {
        if (!cancelled) setDefaults(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, holdingId]);

  const requiredFilled = REQUIRED_DCF_FIELDS.every((k) => fields[k].trim() !== "");

  function updateField(key: DcfFieldKey, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!requiredFilled) return;
    setSubmitting(true);
    setError(null);
    const body: ValuationCaseCreate = {
      case_type: caseType,
      revenue_growth_pct: Number(fields.revenue_growth_pct),
      margin_pct: Number(fields.margin_pct),
      capex_pct_of_revenue: Number(fields.capex_pct_of_revenue),
      tax_rate_pct: Number(fields.tax_rate_pct),
      discount_rate_pct: Number(fields.discount_rate_pct),
      terminal_growth_pct: Number(fields.terminal_growth_pct),
      shares_outstanding: Number(fields.shares_outstanding),
      projection_years: fields.projection_years.trim() ? Number(fields.projection_years) : 5,
      commodity_price_multiplier: commodityMultiplier.trim() ? Number(commodityMultiplier) : null,
      fx_rate_to_reporting: fxRate.trim() ? Number(fxRate) : null,
      net_debt: netDebt.trim() ? Number(netDebt) : null,
      base_revenue_override: baseRevenueOverride.trim() ? Number(baseRevenueOverride) : null,
      currency: currency.trim() ? currency.trim().toUpperCase() : null,
      run_critique: runCritique,
    };
    try {
      const created = await createHoldingValuationCase(holdingId, body);
      onCreated(created);
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail ?? err.message) : "Valuation calculation failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={primaryButtonClass}>
        + New valuation case
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="terminal-panel space-y-3 mb-3">
      <div className="flex items-end gap-3">
        <div>
          <label className={labelClass}>Case type</label>
          <select
            value={caseType}
            onChange={(e) => setCaseType(e.target.value as (typeof CASE_TYPES)[number])}
            className={inputClass}
          >
            {CASE_TYPES.map((c) => (
              <option key={c} value={c}>
                {CASE_TYPE_LABELS[c] ?? c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {DCF_FIELDS.map((f) => (
          <div key={f.key}>
            <label className={labelClass}>{f.label}</label>
            <input
              type="number"
              step="any"
              value={fields[f.key]}
              onChange={(e) => updateField(f.key, e.target.value)}
              placeholder={f.placeholder}
              className={inputClass}
            />
            {f.key === "discount_rate_pct" && (
              <DiscountRateHint
                suggestion={defaults?.discount_rate ?? null}
                onUse={(value) => updateField("discount_rate_pct", value)}
              />
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="text-xs text-tertiary hover:text-secondary underline"
      >
        {showAdvanced ? "Hide advanced options" : "Advanced options (commodity multiplier, FX, net debt, currency override)"}
      </button>

      {showAdvanced && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className={labelClass}>Commodity price multiplier</label>
            <input
              type="number"
              step="any"
              value={commodityMultiplier}
              onChange={(e) => setCommodityMultiplier(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>FX rate to reporting ccy</label>
            <input type="number" step="any" value={fxRate} onChange={(e) => setFxRate(e.target.value)} className={inputClass} />
            <FxRateHint suggestion={defaults?.fx_rate ?? null} onUse={setFxRate} />
          </div>
          <div>
            <label className={labelClass}>Net debt</label>
            <input type="number" step="any" value={netDebt} onChange={(e) => setNetDebt(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Base revenue override</label>
            <input
              type="number"
              step="any"
              value={baseRevenueOverride}
              onChange={(e) => setBaseRevenueOverride(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Currency override</label>
            <input
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              maxLength={3}
              placeholder="e.g. USD"
              className={inputClass}
            />
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 text-xs text-tertiary">
        <input type="checkbox" checked={runCritique} onChange={(e) => setRunCritique(e.target.checked)} />
        Run AI critique of these assumptions
      </label>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={!requiredFilled || submitting} className={primaryButtonClass}>
          {submitting ? "Calculating…" : "Calculate valuation"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={ghostButtonClass}>
          Cancel
        </button>
      </div>
      {error && <p className="text-negative text-xs">{error}</p>}
    </form>
  );
}

/** One valuation case, with its AI critique (previously computed but never
 * surfaced anywhere in the UI) available behind a "Show critique" toggle so
 * the list stays scannable — case type, value, and confidence are the three
 * things the eye needs first; the critique's reasoning is detail on demand. */
function ValuationCaseRow({ c }: { c: ValuationCaseOut }) {
  const [expanded, setExpanded] = useState(false);
  const value = num(c.calculated_value);
  return (
    <li className="border-l-2 border-primary pl-3">
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <span className="font-medium text-primary uppercase">{c.case_type}</span>
        <span className="text-primary font-medium font-mono">{value !== null ? `${value.toFixed(2)} ${c.currency}` : "n/a"}</span>
        <span className="text-xs text-tertiary">{c.confidence} confidence</span>
        <span className="text-xs text-disabled font-mono">{new Date(c.created_at).toLocaleDateString()}</span>
        {(c.critique || c.critique_error) && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-accent hover:underline ml-auto"
          >
            {expanded ? "Hide critique" : "Show critique"}
          </button>
        )}
      </div>
      {c.calculation_note && <p className="text-xs text-tertiary mt-1">{c.calculation_note}</p>}
      {expanded && c.critique && (
        <div className="text-xs text-secondary mt-1 space-y-1">
          <p className={c.critique.assumptions_reasonable ? "text-positive" : "text-warning"}>
            {c.critique.assumptions_reasonable ? "Assumptions look reasonable" : "Assumptions flagged for review"}
          </p>
          <p>{c.critique.reasoning}</p>
          {c.critique.key_risks_to_assumptions.length > 0 && (
            <ul className="list-disc list-inside text-tertiary">
              {c.critique.key_risks_to_assumptions.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {expanded && c.critique_error && (
        <p className="text-xs text-tertiary mt-1">Critique unavailable: {c.critique_error}</p>
      )}
    </li>
  );
}

/**
 * Per-holding drill-down: analysis comparison (§19 "Analysis comparison —
 * why today's analysis differs from prior runs"), evidence panel (§19
 * "Evidence panel — sources behind material conclusions"), thesis timeline
 * (§19 "Thesis timeline — how thesis/confidence changes", §16), and
 * valuation scenarios (§19 "Valuation scenarios — bear/base/bull
 * valuation", §17).
 *
 * Phase 6 shipped this read-only; creating a thesis or a valuation case was
 * still API-only (see docs/PROGRESS.md's "Frontend data-entry" follow-up).
 * This pass adds that data-entry loop — a thesis can now be created and its
 * status moved forward from here, and a valuation case can be calculated
 * (with its AI critique surfaced) without leaving the dashboard. Reading
 * analyses/evidence stays exactly as it was.
 */
export default function HoldingDetailSection({ accountIds }: { accountIds: string[] }) {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [holdingId, setHoldingId] = useState<string>("");

  const [analyses, setAnalyses] = useState<HoldingAnalysisSummary[]>([]);
  const [latest, setLatest] = useState<HoldingAnalysisDetail | null>(null);
  const [previous, setPrevious] = useState<HoldingAnalysisDetail | null>(null);

  const [theses, setTheses] = useState<ThesisOut[]>([]);
  const [invalidation, setInvalidation] = useState<Record<string, InvalidationSignalOut>>({});

  const [cases, setCases] = useState<ValuationCaseOut[]>([]);

  useEffect(() => {
    listHoldings(accountIds)
      .then((list) => {
        // Whisky bottles have no AI analysis, thesis, or DCF valuation to
        // drill into here (ADR 0011 — no financial statements exist for a
        // bottle) — leaving them out of the picker avoids a selection that
        // can only ever show empty "No analyses/thesis/cases" sections.
        const analyzable = list.filter((h) => collectionForAssetClass(h.asset_class) !== WHISKY_COLLECTION);
        setHoldings(analyzable);
        // Keep the current selection if it's still in the filtered list;
        // otherwise fall back to the first holding (or none).
        setHoldingId((current) =>
          analyzable.some((h) => h.id === current) ? current : (analyzable[0]?.id ?? ""),
        );
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountIds.join(",")]);

  useEffect(() => {
    if (!holdingId) return;
    setLatest(null);
    setPrevious(null);
    listHoldingAnalyses(holdingId)
      .then(async (list) => {
        setAnalyses(list);
        if (list[0]) setLatest(await getHoldingAnalysis(list[0].id));
        if (list[1]) setPrevious(await getHoldingAnalysis(list[1].id));
      })
      .catch(() => undefined);
    listHoldingTheses(holdingId)
      .then(setTheses)
      .catch(() => undefined);
    listHoldingValuationCases(holdingId)
      .then(setCases)
      .catch(() => undefined);
  }, [holdingId]);

  async function checkInvalidation(thesisId: string) {
    const result = await getInvalidationCheck(thesisId);
    setInvalidation((prev) => ({ ...prev, [thesisId]: result }));
  }

  return (
    <section className="terminal-card space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="terminal-card-title flex items-center gap-2">
          Holding detail
          <InfoTooltip text={SECTION_EXPLANATION} />
        </h2>
        <select
          value={holdingId}
          onChange={(e) => setHoldingId(e.target.value)}
          className="input-terminal w-auto"
          title="Selected holding"
        >
          {holdings.length === 0 && <option value="">No holdings</option>}
          {holdings.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name} ({h.ticker})
            </option>
          ))}
        </select>
      </div>

      <div>
        <h3 className="text-sm font-medium text-secondary mb-2">Analysis comparison</h3>
        {analyses.length === 0 && <p className="text-sm text-tertiary">No analyses on record for this holding.</p>}
        {analyses.length > 0 && (
          <div className="flex items-center gap-4">
            <ScoreTrend analyses={analyses} />
            <span className="text-xs text-tertiary">{analyses.length} run(s), oldest to newest</span>
          </div>
        )}
        {latest && previous && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="terminal-panel">
              <p className="stat-label mb-1">
                Previous ({new Date(previous.created_at).toLocaleDateString()})
              </p>
              <p className="text-secondary">Overall: <span className="font-mono text-primary">{previous.overall_score ?? "n/a"}/10</span> — {previous.structured_output.thesis_status}</p>
            </div>
            <div className="terminal-panel">
              <p className="stat-label mb-1">
                Latest ({new Date(latest.created_at).toLocaleDateString()})
              </p>
              <p className="text-secondary">Overall: <span className="font-mono text-primary">{latest.overall_score ?? "n/a"}/10</span> — {latest.structured_output.thesis_status}</p>
            </div>
            {latest.structured_output.new_information.length > 0 && (
              <div className="sm:col-span-2">
                <p className="stat-label mb-1">New information since previous run</p>
                <ul className="list-disc list-inside text-secondary">
                  {latest.structured_output.new_information.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {latest && (
        <div>
          <h3 className="text-sm font-medium text-secondary mb-2">
            Latest analysis — full detail
          </h3>
          <div className="terminal-panel">
            <HoldingAnalysisFullDetailWithMemo detail={latest} />
          </div>
        </div>
      )}

      {latest && (
        <div>
          <h3 className="text-sm font-medium text-secondary mb-2">Evidence panel</h3>
          {latest.evidence_references.length === 0 ? (
            <p className="text-sm text-tertiary">No evidence references on the latest analysis.</p>
          ) : (
            <ul className="text-sm space-y-1">
              {latest.evidence_references.map((ref, i) => (
                <li key={i} className="text-secondary">
                  <span className="text-tertiary">[{ref.source_type}]</span> {ref.source_id}
                  {ref.section && ` — ${ref.section}`}
                  {ref.page_start && ` (p.${ref.page_start}${ref.page_end && ref.page_end !== ref.page_start ? `-${ref.page_end}` : ""})`}
                  <span className="text-xs text-disabled"> · {ref.relevance}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-secondary">Thesis timeline</h3>
          {holdingId && (
            <NewThesisForm
              key={`thesis-${holdingId}`}
              holdingId={holdingId}
              onCreated={(t) => setTheses((prev) => [t, ...prev])}
            />
          )}
        </div>
        {theses.length === 0 && <p className="text-sm text-tertiary">No thesis recorded for this holding.</p>}
        <ul className="space-y-2">
          {theses.map((t) => (
            <li key={t.id} className="border-l-2 border-primary pl-3">
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <ThesisStatusSelect
                  thesis={t}
                  onUpdated={(updated) => setTheses((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))}
                />
                <span className="text-xs text-tertiary">{t.confidence} confidence</span>
                <span className="text-xs text-disabled font-mono">{new Date(t.updated_at).toLocaleDateString()}</span>
                <button onClick={() => checkInvalidation(t.id)} className="text-xs text-accent hover:underline ml-auto">
                  Check invalidation signal
                </button>
              </div>
              <p className="text-sm text-secondary mt-1">{t.thesis}</p>
              {invalidation[t.id] && (
                <p className={`text-xs mt-1 ${invalidation[t.id].has_signal ? "text-warning" : "text-tertiary"}`}>
                  {invalidation[t.id].has_signal
                    ? `Invalidation signal: ${invalidation[t.id].reasons.join("; ")}`
                    : "No invalidation signal against the latest analysis."}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-secondary">Valuation scenarios</h3>
          {holdingId && (
            <NewValuationCaseForm
              key={`valuation-${holdingId}`}
              holdingId={holdingId}
              onCreated={(c) => setCases((prev) => [c, ...prev])}
            />
          )}
        </div>
        <ValuationScenarioChart
          data={cases
            .map((c) => ({ case_type: c.case_type, calculated_value: num(c.calculated_value), currency: c.currency }))
            .filter((c): c is { case_type: string; calculated_value: number; currency: string } => c.calculated_value !== null)}
        />
        {cases.length === 0 ? (
          <p className="text-sm text-tertiary mt-2">No valuation cases recorded for this holding.</p>
        ) : (
          <ul className="space-y-2 mt-3">
            {cases.map((c) => (
              <ValuationCaseRow key={c.id} c={c} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
