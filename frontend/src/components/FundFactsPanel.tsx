import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { formatNok, formatPct100 } from "../lib/format";
import type {
  FundDimension,
  FundDocument,
  FundExposure,
  FundExposureRowInput,
  FundFacts,
  FundProfile,
  FundProfileInput,
  FundReturn,
  Holding,
  HoldingsImportResult,
} from "../lib/types";
import { Button, Card, EmptyState, StatTile, VerdictBadge } from "./ui";

/** Sprint 8 (F9): the facts a fund / ETF analysis rests on, and every
 * number computed from them. Backend: app/api/funds.py.
 *
 * Decision 23: no LLM reads a figure out of a fund document. Figures are
 * typed in here, each citing the uploaded document (and page) it came from,
 * or imported from the provider's holdings file (CSV/XLSX), parsed in code.
 * Every derived number (fee drag, benchmark gap, concentration,
 * look-through, overlap) is computed by the backend. */

const INPUT =
  "rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none";

const PERIOD_KIND_LABELS: Record<FundReturn["period_kind"], string> = {
  calendar_year: "Calendar year",
  rolling_12m: "12 months",
  trailing: "Trailing (n years)",
  since_inception: "Since inception",
};

const DIMENSION_LABELS: Record<FundDimension, string> = {
  holding: "Holdings",
  sector: "Sectors",
  country: "Countries",
  currency: "Currencies",
};

function errorText(err: unknown): string {
  return err instanceof ApiError || err instanceof Error ? err.message : "Request failed.";
}

function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** "4,85" / "4.85 %" -> "4.85"; anything else -> null. */
function parseNumber(value: string): string | null {
  const cleaned = value.replace(/\s|%/g, "").replace(",", ".");
  return cleaned !== "" && Number.isFinite(Number(cleaned)) ? cleaned : null;
}

function DocumentSelect({
  documents,
  value,
  onChange,
  width = "max-w-xs",
}: {
  documents: FundDocument[];
  value: string;
  onChange: (id: string) => void;
  width?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT} ${width}`}>
      <option value="">Source document…</option>
      {documents.map((d) => (
        <option key={d.id} value={d.id}>
          {d.original_filename} ({d.type.replace(/_/g, " ")})
        </option>
      ))}
    </select>
  );
}

function sourceName(documents: FundDocument[], id: string, page: number | null): string {
  const doc = documents.find((d) => d.id === id);
  return `${doc?.original_filename ?? "unknown document"}${page ? `, p. ${page}` : ""}`;
}

// ---------------------------------------------------------------------------
// Summary

function Summary({ facts }: { facts: FundFacts }) {
  const m = facts.metrics;
  const drag20 = m.cost.fee_drag_pct["20"];
  const track = m.track_record;
  const roe = m.look_through.metrics.find((x) => x.key === "roe");
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatTile
        label="Ongoing charge"
        value={m.cost.ongoing_charge_pct ? formatPct100(m.cost.ongoing_charge_pct, 2) : "—"}
        hint={
          drag20
            ? `Fees take ${formatPct100(drag20)} of ending wealth over 20 years${
                m.cost.yearly_fee_nok ? ` · ${formatNok(m.cost.yearly_fee_nok)}/yr on your position` : ""
              }`
            : "Not entered"
        }
      />
      <StatTile
        label={track.gap_label === "tracking difference" ? "Tracking difference" : "Excess return"}
        value={
          track.longest_period_annualised_difference_pp !== null
            ? `${Number(track.longest_period_annualised_difference_pp) > 0 ? "+" : ""}${formatPct100(track.longest_period_annualised_difference_pp, 2).replace("%", " pp/yr")}`
            : track.average_one_year_difference_pp !== null
              ? `${Number(track.average_one_year_difference_pp) > 0 ? "+" : ""}${formatPct100(track.average_one_year_difference_pp, 2).replace("%", " pp")}`
              : "—"
        }
        tone={
          Number(track.longest_period_annualised_difference_pp ?? track.average_one_year_difference_pp ?? 0) < 0
            ? "text-negative"
            : "text-ink"
        }
        hint={
          track.one_year_periods_compared > 0
            ? `Beat the benchmark in ${track.one_year_periods_beaten} of ${track.one_year_periods_compared} one-year periods${
                track.longest_period_label ? ` · per year ${track.longest_period_label}` : ""
              }`
            : "No benchmark returns entered"
        }
      />
      <StatTile
        label="Top 10 holdings"
        value={m.concentration.top10_pct ? formatPct100(m.concentration.top10_pct) : "—"}
        hint={
          m.concentration.rows_known > 0
            ? `${m.concentration.rows_known} known${
                m.concentration.stated_holdings_count ? ` of ${m.concentration.stated_holdings_count}` : ""
              }, covering ${formatPct100(m.concentration.coverage_pct)}`
            : "No holdings yet"
        }
      />
      <StatTile
        label="Look-through ROE"
        value={roe?.value ? formatPct100(roe.value) : "—"}
        hint={
          roe && roe.holdings_used > 0
            ? `From ${roe.holdings_used} holdings = ${formatPct100(roe.coverage_pct)} of the fund`
            : "Needs holdings linked to companies with figures"
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile

const EMPTY_PROFILE: FundProfileInput = {
  management_style: "active",
  benchmark_name: null,
  ongoing_charge_pct: null,
  performance_fee: null,
  domicile: null,
  base_currency: null,
  replication: null,
  distribution: null,
  fund_size: null,
  fund_size_currency: null,
  inception_date: null,
  risk_class: null,
  holdings_count: null,
  strategy_summary: null,
  report_name_filter: null,
  as_of_date: null,
  source_document_id: "",
  source_page: null,
};

function ProfileCard({
  holdingId,
  facts,
  onSaved,
}: {
  holdingId: string;
  facts: FundFacts;
  onSaved: (f: FundFacts) => void;
}) {
  const profile = facts.profile;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FundProfileInput>(EMPTY_PROFILE);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function startEdit() {
    if (profile) {
      const rest: Partial<FundProfile> = { ...profile };
      delete rest.id;
      delete rest.holding_id;
      delete rest.updated_at;
      setForm(rest as FundProfileInput);
    } else {
      setForm({ ...EMPTY_PROFILE, source_document_id: facts.documents[0]?.id ?? "" });
    }
    setError(null);
    setEditing(true);
  }

  function set<K extends keyof FundProfileInput>(key: K, value: FundProfileInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      onSaved(await api.saveFundProfile(holdingId, form));
      setEditing(false);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  const text = (key: keyof FundProfileInput, label: string, placeholder = "", width = "w-40") => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-ink-muted">{label}</span>
      <input
        value={(form[key] as string | number | null) ?? ""}
        placeholder={placeholder}
        onChange={(e) => set(key, orNull(e.target.value) as never)}
        className={`${INPUT} ${width}`}
      />
    </label>
  );

  if (!editing) {
    const rows: [string, string | number | null][] = profile
      ? [
          ["Style", profile.management_style === "index" ? "Index (passive)" : "Active"],
          ["Benchmark", profile.benchmark_name],
          ["Ongoing charge", profile.ongoing_charge_pct ? formatPct100(profile.ongoing_charge_pct, 2) : null],
          ["Performance fee", profile.performance_fee],
          ["Domicile", profile.domicile],
          ["Base currency", profile.base_currency],
          ["Replication", profile.replication],
          ["Distribution", profile.distribution],
          ["Fund size", profile.fund_size ? `${Number(profile.fund_size).toLocaleString("en-US")} ${profile.fund_size_currency ?? ""}` : null],
          ["Inception", profile.inception_date],
          ["Risk class (1-7)", profile.risk_class],
          ["Holdings (stated)", profile.holdings_count],
          ["Umbrella-report filter", profile.report_name_filter],
          ["As of", profile.as_of_date],
        ]
      : [];
    return (
      <Card>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink">Profile &amp; cost</h3>
          <Button variant="secondary" onClick={startEdit} disabled={facts.documents.length === 0}>
            {profile ? "Edit" : "Add profile"}
          </Button>
        </div>
        {!profile ? (
          <p className="mt-2 text-sm text-ink-muted">
            Not entered yet. Copy the style, benchmark and ongoing charge from the fact sheet or KID.
          </p>
        ) : (
          <>
            <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1 text-sm md:grid-cols-2">
              {rows
                .filter(([, v]) => v !== null && v !== "")
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-b border-border-subtle py-1">
                    <dt className="text-ink-muted">{k}</dt>
                    <dd className="text-right text-ink">{v}</dd>
                  </div>
                ))}
            </dl>
            {profile.strategy_summary && (
              <p className="mt-3 text-sm text-ink-muted">
                <span className="font-medium text-ink">Stated objective: </span>
                {profile.strategy_summary}
              </p>
            )}
            <p className="mt-2 text-xs text-ink-faint">
              Source: {sourceName(facts.documents, profile.source_document_id, profile.source_page)}
            </p>
          </>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-ink">Profile &amp; cost</h3>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">Style</span>
          <select
            value={form.management_style}
            onChange={(e) => set("management_style", e.target.value as "active" | "index")}
            className={INPUT}
          >
            <option value="active">Active</option>
            <option value="index">Index (passive)</option>
          </select>
        </label>
        {text("benchmark_name", "Benchmark", "Oslo Børs Fondsindeks", "w-64")}
        {text("ongoing_charge_pct", "Ongoing charge %", "1.25", "w-28")}
        {text("performance_fee", "Performance fee", "none", "w-40")}
        {text("domicile", "Domicile", "Norway", "w-32")}
        {text("base_currency", "Base currency", "NOK", "w-24")}
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">Replication</span>
          <select
            value={form.replication ?? ""}
            onChange={(e) => set("replication", (orNull(e.target.value) as FundProfileInput["replication"]) ?? null)}
            className={INPUT}
          >
            <option value="">—</option>
            <option value="physical">Physical</option>
            <option value="sampling">Sampling</option>
            <option value="synthetic">Synthetic</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">Distribution</span>
          <select
            value={form.distribution ?? ""}
            onChange={(e) => set("distribution", (orNull(e.target.value) as FundProfileInput["distribution"]) ?? null)}
            className={INPUT}
          >
            <option value="">—</option>
            <option value="accumulating">Accumulating</option>
            <option value="distributing">Distributing</option>
          </select>
        </label>
        {text("fund_size", "Fund size", "6610000000", "w-36")}
        {text("fund_size_currency", "Size currency", "NOK", "w-24")}
        {text("inception_date", "Inception (YYYY-MM-DD)", "2022-12-05", "w-36")}
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">Risk class 1-7</span>
          <input
            value={form.risk_class ?? ""}
            onChange={(e) => set("risk_class", e.target.value ? Number(e.target.value) : null)}
            className={`${INPUT} w-20`}
            inputMode="numeric"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">Holdings stated</span>
          <input
            value={form.holdings_count ?? ""}
            onChange={(e) => set("holdings_count", e.target.value ? Number(e.target.value) : null)}
            className={`${INPUT} w-24`}
            inputMode="numeric"
          />
        </label>
        {text("as_of_date", "Facts as of", "2026-08-31", "w-32")}
      </div>
      <label className="mt-3 flex flex-col gap-1 text-sm">
        <span className="text-ink-muted">Stated objective (copy the fund&apos;s own words)</span>
        <textarea
          value={form.strategy_summary ?? ""}
          onChange={(e) => set("strategy_summary", orNull(e.target.value))}
          rows={3}
          className={INPUT}
        />
      </label>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        {text("report_name_filter", "Umbrella-report filter", "Gold Mining", "w-48")}
        <p className="max-w-md text-xs text-ink-faint">
          For a report covering many sub-funds: only passages mentioning this text (several separated by
          &quot;;&quot;) are used as excerpts.
        </p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border-subtle pt-3">
        <span className="text-sm text-ink-muted">Read from</span>
        <DocumentSelect
          documents={facts.documents}
          value={form.source_document_id}
          onChange={(id) => set("source_document_id", id)}
        />
        <input
          value={form.source_page ?? ""}
          onChange={(e) => set("source_page", e.target.value ? Number(e.target.value) : null)}
          placeholder="page"
          className={`${INPUT} w-20`}
          inputMode="numeric"
        />
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving || !form.source_document_id}>
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-negative">{error}</p>}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Returns

function emptyReturn(documentId: string): FundReturn {
  return {
    period_kind: "calendar_year",
    period_label: "",
    years: null,
    annualised: false,
    fund_return_pct: "",
    benchmark_return_pct: null,
    benchmark_name: null,
    end_date: null,
    source_document_id: documentId,
    source_page: null,
  };
}

function ReturnsCard({
  holdingId,
  facts,
  onSaved,
}: {
  holdingId: string;
  facts: FundFacts;
  onSaved: (f: FundFacts) => void;
}) {
  const [rows, setRows] = useState<FundReturn[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const track = facts.metrics.track_record;
  const defaultDoc = facts.documents[0]?.id ?? "";

  function update(i: number, patch: Partial<FundReturn>) {
    setRows((r) => (r ? r.map((row, j) => (j === i ? { ...row, ...patch } : row)) : r));
  }

  async function save() {
    if (!rows) return;
    setSaving(true);
    setError(null);
    try {
      const cleaned = rows
        .filter((r) => r.period_label.trim() !== "" || r.fund_return_pct.trim() !== "")
        .map((r) => {
          const fund = parseNumber(r.fund_return_pct);
          if (fund === null) throw new Error(`"${r.period_label || "a row"}": fund return is not a number`);
          return {
            ...r,
            fund_return_pct: fund,
            benchmark_return_pct: r.benchmark_return_pct ? parseNumber(r.benchmark_return_pct) : null,
            years: r.years ? parseNumber(r.years) : null,
          };
        });
      onSaved(await api.saveFundReturns(holdingId, cleaned));
      setRows(null);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  const signed = (v: string | null, unit = " pp") =>
    v === null ? "—" : `${Number(v) > 0 ? "+" : ""}${Number(v).toFixed(2)}${unit}`;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">Track record vs benchmark</h3>
        {rows === null && (
          <Button
            variant="secondary"
            disabled={facts.documents.length === 0}
            onClick={() =>
              setRows(facts.returns.length > 0 ? facts.returns.map((r) => ({ ...r })) : [emptyReturn(defaultDoc)])
            }
          >
            {facts.returns.length > 0 ? "Edit" : "Add returns"}
          </Button>
        )}
      </div>

      {rows === null ? (
        track.rows.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">
            Not entered yet. Copy the yearly and since-inception returns (fund and benchmark) from the fact
            sheet.
          </p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="py-2 font-medium">Period</th>
                <th className="py-2 text-right font-medium">Fund</th>
                <th className="py-2 text-right font-medium">Benchmark</th>
                <th className="py-2 text-right font-medium">{track.gap_label}</th>
                <th className="py-2 text-right font-medium">Per year</th>
              </tr>
            </thead>
            <tbody>
              {track.rows.map((r) => (
                <tr key={r.id} className="border-t border-border-subtle">
                  <td className="py-2 text-ink">
                    {r.period_label}
                    <span className="ml-1 text-xs text-ink-faint">
                      {PERIOD_KIND_LABELS[r.period_kind as FundReturn["period_kind"]] ?? r.period_kind}
                    </span>
                  </td>
                  <td className="tabular py-2 text-right">{formatPct100(r.fund_return_pct)}</td>
                  <td className="tabular py-2 text-right text-ink-muted">
                    {r.benchmark_return_pct ? formatPct100(r.benchmark_return_pct) : "—"}
                  </td>
                  <td
                    className={`tabular py-2 text-right ${
                      r.difference_pp !== null && Number(r.difference_pp) < 0 ? "text-negative" : "text-ink"
                    }`}
                  >
                    {signed(r.difference_pp)}
                  </td>
                  <td className="tabular py-2 text-right text-ink-muted">
                    {r.period_kind === "trailing" || r.period_kind === "since_inception"
                      ? signed(r.annualised_difference_pp, " pp/yr")
                      : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : (
        <div className="mt-3 space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 border-b border-border-subtle pb-2">
              <select
                value={r.period_kind}
                onChange={(e) => update(i, { period_kind: e.target.value as FundReturn["period_kind"] })}
                className={INPUT}
              >
                {Object.entries(PERIOD_KIND_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                value={r.period_label}
                onChange={(e) => update(i, { period_label: e.target.value })}
                placeholder="2025 / since 2022-12-05"
                className={`${INPUT} w-40`}
              />
              <input
                value={r.fund_return_pct}
                onChange={(e) => update(i, { fund_return_pct: e.target.value })}
                placeholder="fund %"
                className={`${INPUT} w-24`}
              />
              <input
                value={r.benchmark_return_pct ?? ""}
                onChange={(e) => update(i, { benchmark_return_pct: orNull(e.target.value) })}
                placeholder="benchmark %"
                className={`${INPUT} w-28`}
              />
              {(r.period_kind === "trailing" || r.period_kind === "since_inception") && (
                <>
                  <input
                    value={r.years ?? ""}
                    onChange={(e) => update(i, { years: orNull(e.target.value) })}
                    placeholder="years"
                    className={`${INPUT} w-20`}
                  />
                  <label className="flex items-center gap-1 text-xs text-ink-muted">
                    <input
                      type="checkbox"
                      checked={r.annualised}
                      onChange={(e) => update(i, { annualised: e.target.checked })}
                    />
                    already per year
                  </label>
                </>
              )}
              <DocumentSelect
                documents={facts.documents}
                value={r.source_document_id}
                onChange={(id) => update(i, { source_document_id: id })}
                width="max-w-[11rem]"
              />
              <input
                value={r.source_page ?? ""}
                onChange={(e) => update(i, { source_page: e.target.value ? Number(e.target.value) : null })}
                placeholder="page"
                className={`${INPUT} w-16`}
              />
              <button
                type="button"
                onClick={() => setRows((all) => (all ? all.filter((_, j) => j !== i) : all))}
                className="text-xs text-negative hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
          <p className="text-xs text-ink-faint">
            Returns in % as the document prints them (19.7, not 0.197). A cumulative multi-year figure needs
            its length in years to be annualised; tick &quot;already per year&quot; when the document annualises it.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => setRows((all) => [...(all ?? []), emptyReturn(all && all.length > 0 ? all[all.length - 1].source_document_id : defaultDoc)])}
            >
              Add period
            </Button>
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" onClick={() => setRows(null)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? "Saving…" : "Save returns"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-negative">{error}</p>}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Exposures: typed-in editor (all dimensions) + holdings import

/** Parses pasted lines "Name ; 4,85" / "Name<TAB>4.85 %" / "Name 4.85". */
function parseExposureLines(text: string): { rows: FundExposureRowInput[]; bad: string[] } {
  const rows: FundExposureRowInput[] = [];
  const bad: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const match = line.match(/^(.*?)(?:\s*[;\t|]\s*|\s+)(-?[\d.,]+)\s*%?$/);
    const weight = match ? parseNumber(match[2]) : null;
    if (!match || !match[1].trim() || weight === null) {
      bad.push(line);
      continue;
    }
    rows.push({ label: match[1].trim(), weight_pct: weight });
  }
  return { rows, bad };
}

function ExposureEditor({
  holdingId,
  dimension,
  facts,
  onSaved,
  onCancel,
}: {
  holdingId: string;
  dimension: FundDimension;
  facts: FundFacts;
  onSaved: (f: FundFacts) => void;
  onCancel: () => void;
}) {
  const existing = facts.exposures[dimension];
  const [text, setText] = useState(existing.map((e) => `${e.label}; ${Number(e.weight_pct)}`).join("\n"));
  const [asOf, setAsOf] = useState(existing[0]?.as_of_date ?? facts.profile?.as_of_date ?? "");
  const [documentId, setDocumentId] = useState(existing[0]?.source_document_id ?? facts.documents[0]?.id ?? "");
  const [page, setPage] = useState<string>(existing[0]?.source_page ? String(existing[0].source_page) : "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const parsed = parseExposureLines(text);
  const total = parsed.rows.reduce((sum, r) => sum + Number(r.weight_pct), 0);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      onSaved(
        await api.saveFundExposures(holdingId, dimension, {
          as_of_date: asOf,
          source_document_id: documentId,
          rows: parsed.rows.map((r) => ({ ...r, source_page: page ? Number(page) : null })),
        }),
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 rounded-md bg-background p-3">
      <p className="mb-2 text-xs text-ink-muted">
        One per line: name and weight in %, e.g. <code>Kongsberg Gruppen; 5,1</code>. Saving replaces the{" "}
        {DIMENSION_LABELS[dimension].toLowerCase()} for this date.
      </p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} className={`${INPUT} w-full font-mono`} />
      <p className="mt-1 text-xs text-ink-faint">
        {parsed.rows.length} rows, total {total.toFixed(2)}%
        {parsed.bad.length > 0 && <span className="text-negative"> · can&apos;t read: {parsed.bad.slice(0, 3).join(" | ")}</span>}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input value={asOf} onChange={(e) => setAsOf(e.target.value)} placeholder="as of YYYY-MM-DD" className={`${INPUT} w-36`} />
        <DocumentSelect documents={facts.documents} value={documentId} onChange={setDocumentId} />
        <input value={page} onChange={(e) => setPage(e.target.value)} placeholder="page" className={`${INPUT} w-16`} />
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving || !asOf || !documentId || parsed.bad.length > 0}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-negative">{error}</p>}
    </div>
  );
}

function HoldingsImport({
  holdingId,
  onImported,
}: {
  holdingId: string;
  onImported: (result: HoldingsImportResult) => void;
}) {
  const [asOf, setAsOf] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(file: File) {
    setBusy(true);
    setError(null);
    try {
      onImported(await api.importFundHoldings(holdingId, file, asOf || undefined));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted">As of (if the file doesn&apos;t say)</span>
        <input value={asOf} onChange={(e) => setAsOf(e.target.value)} placeholder="YYYY-MM-DD" className={`${INPUT} w-36`} />
      </label>
      <label>
        <span className="sr-only">Holdings file</span>
        <input
          type="file"
          accept=".csv,.xlsx"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handle(file);
            e.target.value = "";
          }}
          className="text-sm text-ink-muted file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-accent-hover disabled:opacity-50"
        />
      </label>
      {busy && <span className="text-sm text-ink-muted">Importing…</span>}
      {error && <p className="basis-full text-sm text-negative">{error}</p>}
    </div>
  );
}

function HoldingsCard({
  holdingId,
  facts,
  holdings,
  onSaved,
  reload,
}: {
  holdingId: string;
  facts: FundFacts;
  holdings: Holding[];
  onSaved: (f: FundFacts) => void;
  reload: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [importNote, setImportNote] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const rows = facts.exposures.holding;
  const byExposure = new Map(facts.metrics.look_through.holdings.map((h) => [h.exposure_id, h]));
  const candidates = holdings.filter((h) => h.id !== holdingId).sort((a, b) => a.name.localeCompare(b.name));
  const c = facts.metrics.concentration;

  async function link(exposure: FundExposure, target: string) {
    setLinkError(null);
    try {
      onSaved(await api.setFundHoldingLink(holdingId, exposure.id, target || null));
    } catch (err) {
      setLinkError(errorText(err));
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">What the fund owns (look-through)</h3>
          {rows.length > 0 && (
            <p className="mt-0.5 text-xs text-ink-muted">
              As of {c.as_of_date} · {c.rows_known} holdings covering {formatPct100(c.coverage_pct)}
              {c.hhi && ` · HHI ${c.complete ? "" : "≥ "}${c.hhi}`}
              {c.effective_holdings && ` · effective number of holdings ${c.effective_holdings}`}
            </p>
          )}
        </div>
        {!editing && (
          <Button variant="secondary" onClick={() => setEditing(true)} disabled={facts.documents.length === 0}>
            Type in holdings
          </Button>
        )}
      </div>

      <div className="mt-3 border-b border-border-subtle pb-3">
        <HoldingsImport
          holdingId={holdingId}
          onImported={(result) => {
            setImportNote(
              `Imported ${result.rows_imported} holdings (${formatPct100(result.weight_sum_pct)} of the fund) as of ${result.as_of_date}` +
                ` from '${result.columns.name ?? "name"}' / '${result.columns.weight ?? "weight"}' (row ${result.header_row})` +
                (result.weights_were_fractions ? ", weights converted from fractions" : "") +
                `; ${result.linked} linked to companies in the app` +
                (result.derived_dimensions.length ? `; ${result.derived_dimensions.join(", ")} split derived` : "") +
                (result.warnings.length ? `. ${result.warnings.join(" ")}` : "."),
            );
            reload();
          }}
        />
        <p className="mt-1 text-xs text-ink-faint">
          Best source: the provider&apos;s full holdings download (CSV/Excel). Otherwise type in the top 10 from the
          fact sheet.
        </p>
        {importNote && <p className="mt-2 text-xs text-ink-muted">{importNote}</p>}
      </div>

      {editing && (
        <ExposureEditor
          holdingId={holdingId}
          dimension="holding"
          facts={facts}
          onSaved={(f) => {
            onSaved(f);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}

      {linkError && <p className="mt-2 text-sm text-negative">{linkError}</p>}

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">No holdings yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="py-2 font-medium">Holding</th>
                <th className="py-2 text-right font-medium">Weight</th>
                <th className="py-2 pl-3 font-medium">Company in the app</th>
                <th className="py-2 text-right font-medium">ROE</th>
                <th className="py-2 text-right font-medium">Op. margin</th>
                <th className="py-2 pl-3 font-medium">Moat / verdict</th>
                <th className="py-2 text-right font-medium">Also owned directly</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const look = byExposure.get(row.id);
                return (
                  <tr key={row.id} className="border-t border-border-subtle">
                    <td className="py-2 text-ink">
                      {row.label}
                      {row.ticker && <span className="ml-1 text-xs text-ink-faint">{row.ticker}</span>}
                    </td>
                    <td className="tabular py-2 text-right">{formatPct100(row.weight_pct, 2)}</td>
                    <td className="py-2 pl-3">
                      <select
                        value={row.linked_holding_id ?? ""}
                        onChange={(e) => void link(row, e.target.value)}
                        className={`${INPUT} max-w-[12rem] py-1 text-xs`}
                        title={row.link_method ? `Linked by ${row.link_method}` : "Not linked"}
                      >
                        <option value="">— not linked —</option>
                        {candidates.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name} ({h.ticker})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="tabular py-2 text-right text-ink-muted">
                      {look?.roe_pct ? formatPct100(look.roe_pct) : "—"}
                    </td>
                    <td className="tabular py-2 text-right text-ink-muted">
                      {look?.operating_margin_pct ? formatPct100(look.operating_margin_pct) : "—"}
                    </td>
                    <td className="py-2 pl-3 text-xs">
                      {look?.moat_rating ? (
                        <span className="flex items-center gap-1">
                          <span className="text-ink-muted">{look.moat_rating}</span>
                          <VerdictBadge rating={look.verdict_rating} />
                        </span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="tabular py-2 text-right text-ink-muted">
                      {look?.direct_value_nok ? formatNok(look.direct_value_nok) : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-ink-faint">
        Linking a holding to a company in the app lets the look-through use that company&apos;s own figures and
        analysis, and shows overlap with what you own directly. Links are matched by ticker or name
        automatically; a link you set by hand is kept on re-import.
      </p>
    </Card>
  );
}

function SplitsCard({
  holdingId,
  facts,
  onSaved,
}: {
  holdingId: string;
  facts: FundFacts;
  onSaved: (f: FundFacts) => void;
}) {
  const [editing, setEditing] = useState<FundDimension | null>(null);
  const dims: FundDimension[] = ["sector", "country", "currency"];
  return (
    <Card>
      <h3 className="text-sm font-semibold text-ink">Sector, country and currency split</h3>
      {facts.metrics.foreign_currency_pct !== null && (
        <p className="mt-1 text-xs text-ink-muted">
          {formatPct100(facts.metrics.foreign_currency_pct)} of the fund is in currencies other than NOK.
        </p>
      )}
      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
        {dims.map((dim) => {
          const rows = facts.exposures[dim];
          return (
            <div key={dim}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{DIMENSION_LABELS[dim]}</p>
                <button
                  type="button"
                  onClick={() => setEditing(dim)}
                  disabled={facts.documents.length === 0}
                  className="text-xs text-accent hover:underline disabled:opacity-50"
                >
                  {rows.length ? "Edit" : "Add"}
                </button>
              </div>
              {rows.length === 0 ? (
                <p className="mt-1 text-xs text-ink-faint">Not entered</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {rows.map((r) => (
                    <li key={r.id} className="text-xs">
                      <div className="flex justify-between gap-2">
                        <span className="text-ink">{r.label}</span>
                        <span className="tabular text-ink-muted">{formatPct100(r.weight_pct)}</span>
                      </div>
                      <div className="mt-0.5 h-1 rounded bg-border-subtle">
                        <div className="h-1 rounded bg-accent" style={{ width: `${Math.min(100, Number(r.weight_pct))}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      {editing && (
        <ExposureEditor
          holdingId={holdingId}
          dimension={editing}
          facts={facts}
          onSaved={(f) => {
            onSaved(f);
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------

export function FundFactsPanel({ holdingId, onChanged }: { holdingId: string; onChanged?: () => void }) {
  const [facts, setFacts] = useState<FundFacts | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .getFundFacts(holdingId)
      .then(setFacts)
      .catch((err) => setError(errorText(err)));
  }, [holdingId]);

  useEffect(() => {
    load();
    api
      .listHoldings()
      .then(setHoldings)
      .catch(() => setHoldings([]));
  }, [load]);

  function saved(f: FundFacts) {
    setFacts(f);
    onChanged?.();
  }

  if (error) return <p className="text-sm text-negative">{error}</p>;
  if (!facts) return <p className="text-sm text-ink-muted">Loading…</p>;

  const overlap = facts.metrics.overlap;
  return (
    <div className="space-y-4">
      {facts.documents.length === 0 && (
        <EmptyState>
          Upload the fund&apos;s fact sheet, KID or monthly report under Documents first. Every figure you enter
          here cites the document (and page) it came from.
        </EmptyState>
      )}
      <Summary facts={facts} />
      {facts.metrics.gaps.length > 0 && (
        <div className="rounded-md border border-caution/30 bg-caution/5 px-4 py-3">
          <p className="mb-1 text-sm font-semibold text-ink">Not computed yet</p>
          <ul className="list-disc space-y-1 pl-5 text-xs text-ink-muted">
            {facts.metrics.gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
      )}
      <ProfileCard holdingId={holdingId} facts={facts} onSaved={saved} />
      <ReturnsCard holdingId={holdingId} facts={facts} onSaved={saved} />
      <HoldingsCard
        holdingId={holdingId}
        facts={facts}
        holdings={holdings}
        onSaved={saved}
        reload={() => {
          load();
          onChanged?.();
        }}
      />
      <SplitsCard holdingId={holdingId} facts={facts} onSaved={saved} />
      {overlap.fund_value_nok !== null && overlap.rows.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-ink">Overlap with stocks you own directly</h3>
          <p className="mt-1 text-xs text-ink-muted">
            Your position in this fund: {formatNok(overlap.fund_value_nok)}. Held twice (through the fund):{" "}
            {formatNok(overlap.total_through_fund_nok)}.
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {overlap.rows.map((r) => (
              <li key={r.exposure_id} className="flex justify-between gap-4">
                <span className="text-ink">{r.label}</span>
                <span className="tabular text-ink-muted">
                  {formatNok(r.through_fund_value_nok)} via fund + {formatNok(r.direct_value_nok)} directly
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
