import { useState } from "react";
import { api, ApiError } from "../lib/api";
import { formatNok, formatPct100 } from "../lib/format";
import type { FundFacts, InstrumentFact, InstrumentFactInput, InstrumentMetrics } from "../lib/types";
import { Button, Card, StatTile } from "./ui";

/** 2026-10-07: the figures a bond fund, money-market fund or physical-metal
 * ETC is judged on (yield, duration, credit quality — or backing, custody,
 * delivery right), and the numbers computed from them. Backend:
 * app/api/funds.py (PUT /funds/{id}/instrument-facts), app/domain/instrument_facts.py.
 *
 * Same rule as every fund figure (decision 23): typed in here, each citing
 * the uploaded document (and page) it came from; no LLM reads a figure out
 * of a PDF. Every derived number comes from the backend. */

const INPUT =
  "rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none";

function errorText(err: unknown): string {
  return err instanceof ApiError || err instanceof Error ? err.message : "Request failed.";
}

/** "4,85" / "4.85 %" -> "4.85"; anything else -> null. */
function parseNumber(value: string): string | null {
  const cleaned = value.replace(/\s|%/g, "").replace(",", ".");
  return cleaned !== "" && Number.isFinite(Number(cleaned)) ? cleaned : null;
}

interface Draft {
  value: string;
  page: string;
}

function pp(value: string | null, digits = 2): string {
  if (value === null) return "—";
  const n = Number(value);
  return `${n > 0 ? "+" : ""}${n.toFixed(digits)} pp`;
}

function pct(value: string | null, digits = 2): string {
  return value === null ? "—" : formatPct100(value, digits);
}

export function InstrumentMetricsTiles({ metrics }: { metrics: InstrumentMetrics }) {
  const income = metrics.income;
  const commodity = metrics.commodity;
  return (
    <div className="space-y-3">
      {income && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile
            label="Yield"
            value={pct(income.reference_yield_pct)}
            hint={income.reference_yield_basis ?? "Not entered"}
          />
          <StatTile
            label="Spread over T-bill"
            value={pp(income.spread_vs_no_3m_bill_pp)}
            tone={Number(income.spread_vs_no_3m_bill_pp ?? 0) < 0 ? "text-negative" : "text-ink"}
            hint={
              income.no_3m_bill_pct
                ? `Norway 3-month T-bill ${pct(income.no_3m_bill_pct)}${
                    income.spread_vs_no_10y_pp ? ` · over the 10-year ${pp(income.spread_vs_no_10y_pp)}` : ""
                  }`
                : "Needs the Norway T-bill yield (Macro → Refresh data)"
            }
          />
          <StatTile
            label="Real yield"
            value={pp(income.real_yield_pp)}
            tone={Number(income.real_yield_pp ?? 0) < 0 ? "text-negative" : "text-ink"}
            hint={income.no_cpi_pct ? `After Norway CPI ${pct(income.no_cpi_pct)}` : "Needs Norway CPI"}
          />
          <StatTile
            label="Fee share of yield"
            value={pct(income.fee_share_of_yield_pct, 1)}
            hint={income.ongoing_charge_pct ? `Ongoing charge ${pct(income.ongoing_charge_pct)}` : "No ongoing charge"}
          />
          <StatTile
            label="Duration"
            value={income.effective_duration_years ? `${Number(income.effective_duration_years).toFixed(1)} yrs` : "—"}
            hint={
              income.rate_shocks.length > 0
                ? `+1 pp in rates ≈ ${Number(income.rate_shocks[0].price_effect_pct).toFixed(2)} % on the price (approximation)`
                : "Not entered"
            }
          />
          <StatTile
            label="Breakeven rate rise"
            value={income.breakeven_rate_rise_pp ? `${Number(income.breakeven_rate_rise_pp).toFixed(2)} pp` : "—"}
            hint="A year of yield offsets a rise this big (yield ÷ duration)"
          />
          <StatTile
            label="Below investment grade"
            value={pct(income.high_yield_share_pct, 0)}
            hint={income.average_credit_rating ? `Average rating ${income.average_credit_rating}` : "Rating not entered"}
          />
        </div>
      )}
      {commodity && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {commodity.carry_hurdles.length > 0 ? (
            commodity.carry_hurdles.map((h) => (
              <StatTile
                key={h.years}
                label={`Carry hurdle, ${h.years} yrs`}
                value={`+${Number(h.required_rise_pct).toFixed(1)} %`}
                hint={`The metal must rise this much just to match T-bills (${pct(commodity.no_3m_bill_pct)}) after the charge`}
              />
            ))
          ) : (
            <StatTile label="Carry hurdle" value="—" hint="Needs the ongoing charge and the Norway T-bill yield" />
          )}
          <StatTile
            label="Premium / discount"
            value={commodity.premium_discount_pct !== null ? pp(commodity.premium_discount_pct) : "—"}
            hint={
              commodity.premium_discount_pct !== null
                ? "Market price against the metal behind one unit"
                : "Needs NAV and market price per unit"
            }
          />
        </div>
      )}
      <p className="text-xs text-ink-faint">
        {metrics.position_value_nok
          ? `Your position: ${formatNok(metrics.position_value_nok)}${
              metrics.portfolio_weight_pct ? ` · ${formatPct100(metrics.portfolio_weight_pct)} of the portfolio` : ""
            }. `
          : ""}
        Computed from the figures below and stored macro data; nothing here is read by a model.
      </p>
    </div>
  );
}

function factValue(f: InstrumentFact, unit: string): string {
  if (f.value_number !== null) {
    const n = Number(f.value_number);
    return `${Number.isInteger(n) ? n.toLocaleString("en-US") : String(n)}${unit ? ` ${unit}` : ""}`;
  }
  return f.value_text ?? "";
}

export function InstrumentFactsCard({
  holdingId,
  facts,
  onSaved,
}: {
  holdingId: string;
  facts: FundFacts;
  onSaved: (f: FundFacts) => void;
}) {
  const specs = facts.instrument_fact_specs;
  const byKey = new Map(facts.instrument_facts.map((f) => [f.fact_key, f]));
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [documentId, setDocumentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function startEdit() {
    const next: Record<string, Draft> = {};
    for (const spec of specs) {
      const f = byKey.get(spec.key);
      next[spec.key] = {
        value: f ? (f.value_number !== null ? String(Number(f.value_number)) : (f.value_text ?? "")) : "",
        page: f?.source_page ? String(f.source_page) : "",
      };
    }
    setDrafts(next);
    setDocumentId(facts.instrument_facts[0]?.source_document_id ?? facts.documents[0]?.id ?? "");
    setError(null);
    setEditing(true);
  }

  async function save() {
    if (!documentId) {
      setError("Choose the document these figures come from.");
      return;
    }
    const rows: InstrumentFactInput[] = [];
    for (const spec of specs) {
      const draft = drafts[spec.key];
      if (!draft || draft.value.trim() === "") continue;
      const existing = byKey.get(spec.key);
      const number = spec.kind === "number" ? parseNumber(draft.value) : null;
      if (spec.kind === "number" && number === null) {
        setError(`${spec.label}: enter a number.`);
        return;
      }
      const page = Number.parseInt(draft.page, 10);
      rows.push({
        fact_key: spec.key,
        value_number: number,
        value_text: spec.kind === "text" ? draft.value.trim() : null,
        as_of_date: existing?.as_of_date ?? null,
        source_document_id: documentId,
        source_page: Number.isFinite(page) && page > 0 ? page : null,
      });
    }
    setSaving(true);
    setError(null);
    try {
      onSaved(await api.saveInstrumentFacts(holdingId, rows));
      setEditing(false);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    const entered = specs.filter((s) => byKey.has(s.key));
    return (
      <Card>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink">Instrument figures</h3>
          <Button variant="secondary" onClick={startEdit} disabled={facts.documents.length === 0}>
            {entered.length > 0 ? "Edit" : "Add figures"}
          </Button>
        </div>
        {entered.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">
            None entered yet. Copy them from the fact sheet, KID or issuer page — the analysis cannot run without them.
          </p>
        ) : (
          <dl className="mt-3 space-y-1 text-sm">
            {entered.map((spec) => {
              const f = byKey.get(spec.key)!;
              const doc = facts.documents.find((d) => d.id === f.source_document_id);
              return (
                <div key={spec.key} className="flex justify-between gap-4 border-b border-border-subtle py-1">
                  <dt className="text-ink-muted">{spec.label}</dt>
                  <dd className="text-right text-ink">
                    {factValue(f, spec.unit)}
                    <span className="ml-2 text-xs text-ink-faint">
                      {doc?.original_filename ?? "document"}
                      {f.source_page ? `, p. ${f.source_page}` : ""}
                    </span>
                  </dd>
                </div>
              );
            })}
          </dl>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-ink">Instrument figures</h3>
      <label className="mb-3 flex flex-col gap-1 text-sm">
        <span className="text-ink-muted">Source document (every figure below cites it)</span>
        <select value={documentId} onChange={(e) => setDocumentId(e.target.value)} className={`${INPUT} max-w-md`}>
          <option value="">Choose a document…</option>
          {facts.documents.map((d) => (
            <option key={d.id} value={d.id}>
              {d.original_filename} ({d.type.replace(/_/g, " ")})
            </option>
          ))}
        </select>
      </label>
      <div className="space-y-2">
        {specs.map((spec) => (
          <div key={spec.key} className="grid grid-cols-1 items-start gap-2 md:grid-cols-[minmax(0,16rem)_1fr_5rem]">
            <div>
              <p className="text-sm text-ink">{spec.label}</p>
              {spec.help && <p className="text-xs text-ink-faint">{spec.help}</p>}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={drafts[spec.key]?.value ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [spec.key]: { ...d[spec.key], value: e.target.value } }))}
                placeholder={spec.kind === "number" ? "Number" : "Text, as the document states it"}
                aria-label={spec.label}
                className={`${INPUT} w-full`}
              />
              {spec.unit && <span className="shrink-0 text-xs text-ink-faint">{spec.unit}</span>}
            </div>
            <input
              value={drafts[spec.key]?.page ?? ""}
              onChange={(e) => setDrafts((d) => ({ ...d, [spec.key]: { ...d[spec.key], page: e.target.value } }))}
              placeholder="Page"
              aria-label={`${spec.label} page`}
              className={`${INPUT} w-20`}
            />
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-faint">Leave a row empty if the document does not give it.</p>
      {error && <p className="mt-2 text-sm text-negative">{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save figures"}
        </Button>
        <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
