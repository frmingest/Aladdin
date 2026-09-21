import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import type { Holding, HoldingCreateInput, HoldingFieldOptions, HoldingUpdateInput } from "../lib/types";
import { INSTRUMENT_TYPE_LABELS, WHISKY_SECTORS } from "../lib/types";
import { Button, Card, EmptyState, PageHeader } from "../components/ui";

const CURRENCIES = ["NOK", "USD", "EUR", "GBP", "SEK", "DKK"];

function NewHoldingForm({
  onCreated,
  onCancel,
}: {
  onCreated: (holding: Holding) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<HoldingCreateInput>({
    ticker: "",
    name: "",
    trading_currency: "NOK",
    sector: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const holding = await api.createHolding({
        ...form,
        sector: form.sector || null,
      });
      onCreated(holding);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the holding.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mb-6">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">Ticker</span>
          <input
            required
            value={form.ticker}
            onChange={(e) => setForm({ ...form, ticker: e.target.value })}
            placeholder="EQNR.OL"
            className="w-32 rounded-md border border-border px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">Name</span>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Equinor ASA"
            className="w-56 rounded-md border border-border px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">Currency</span>
          <select
            value={form.trading_currency}
            onChange={(e) => setForm({ ...form, trading_currency: e.target.value })}
            className="rounded-md border border-border px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">Sector (optional)</span>
          <input
            value={form.sector ?? ""}
            onChange={(e) => setForm({ ...form, sector: e.target.value })}
            placeholder="Energy"
            className="w-40 rounded-md border border-border px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
          />
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Adding…" : "Add holding"}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
      {error && <p className="mt-3 text-sm text-negative">{error}</p>}
    </Card>
  );
}

/** One row in the table: either a plain holding, or the collapsed whisky
 * group (see lib/types.ts's WHISKY_SECTORS — Faiz's request, 2026-09-21:
 * these legacy pre-reset bottles/distilleries should fold into one row
 * instead of listing individually; gold/silver stay as individual rows,
 * his explicit choice). */
type HoldingsRow =
  | { kind: "holding"; holding: Holding }
  | { kind: "whisky-group"; holdings: Holding[] };

function groupHoldings(holdings: Holding[]): HoldingsRow[] {
  const whisky: Holding[] = [];
  const rows: HoldingsRow[] = [];
  for (const h of holdings) {
    if (h.sector && WHISKY_SECTORS.has(h.sector)) {
      whisky.push(h);
    } else {
      rows.push({ kind: "holding", holding: h });
    }
  }
  if (whisky.length > 0) {
    rows.push({ kind: "whisky-group", holdings: whisky });
  }
  return rows;
}

function WhiskyGroupRow({ holdings }: { holdings: Holding[] }) {
  const [expanded, setExpanded] = useState(false);
  const distilleries = new Set(holdings.map((h) => h.sector)).size;
  const documentCount = holdings.reduce((sum, h) => sum + h.document_count, 0);

  return (
    <>
      <tr
        className="cursor-pointer border-b border-border-subtle bg-border-subtle/40 last:border-0 hover:bg-border-subtle"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-4 py-3 font-medium text-ink" colSpan={2}>
          {expanded ? "▾" : "▸"} Whisky ({holdings.length} bottle{holdings.length === 1 ? "" : "s"})
        </td>
        <td className="px-4 py-3 text-ink-muted">Commodity (collectible)</td>
        <td className="px-4 py-3 text-ink-muted">{distilleries} distiller{distilleries === 1 ? "y" : "ies"}</td>
        <td className="px-4 py-3 tabular text-ink-muted">—</td>
        <td className="px-4 py-3 text-right tabular text-ink-muted">{documentCount}</td>
        <td className="px-2 py-3"></td>
      </tr>
      {expanded &&
        holdings.map((h) => (
          <tr key={h.id} className="border-b border-border-subtle bg-border-subtle/20 last:border-0">
            <td className="px-4 py-3 pl-8">
              <Link
                to={`/holdings/${h.id}`}
                className="font-medium text-accent hover:text-accent-hover"
              >
                {h.ticker}
              </Link>
            </td>
            <td className="px-4 py-3 text-ink">{h.name}</td>
            <td className="px-4 py-3 text-ink-muted">
              {INSTRUMENT_TYPE_LABELS[h.asset_class_raw] ?? h.asset_class_raw}
            </td>
            <td className="px-4 py-3 text-ink-muted">{h.sector ?? "—"}</td>
            <td className="px-4 py-3 tabular text-ink-muted">{h.trading_currency}</td>
            <td className="px-4 py-3 text-right tabular text-ink-muted">{h.document_count}</td>
            <td className="px-2 py-3"></td>
          </tr>
        ))}
    </>
  );
}

/** Ticker / Type / Sector are editable in place (Faiz's request,
 * 2026-09-21 — the CSV importer can only ever guess at both: a slugified
 * placeholder ticker, and a name-based instrument-type/sector guess).
 * One "Edit" toggle per row rather than per-cell — the three fields are
 * usually fixed together in one pass after a CSV import. */
function HoldingRow({
  holding,
  fieldOptions,
  onSaved,
}: {
  holding: Holding;
  fieldOptions: HoldingFieldOptions | null;
  onSaved: (updated: Holding) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [ticker, setTicker] = useState(holding.ticker);
  const [sector, setSector] = useState(holding.sector ?? "");
  const [assetClassRaw, setAssetClassRaw] = useState(holding.asset_class_raw);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setTicker(holding.ticker);
    setSector(holding.sector ?? "");
    setAssetClassRaw(holding.asset_class_raw);
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    const input: HoldingUpdateInput = {
      ticker: ticker.trim(),
      sector: sector || null,
      asset_class_raw: assetClassRaw,
    };
    try {
      const updated = await api.updateHolding(holding.id, input);
      onSaved(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <tr className="group border-b border-border-subtle last:border-0">
        <td className="px-4 py-3">
          <Link to={`/holdings/${holding.id}`} className="font-medium text-accent hover:text-accent-hover">
            {holding.ticker}
          </Link>
        </td>
        <td className="px-4 py-3 text-ink">{holding.name}</td>
        <td className="px-4 py-3 text-ink-muted">
          {INSTRUMENT_TYPE_LABELS[holding.asset_class_raw] ?? holding.asset_class_raw}
        </td>
        <td className="px-4 py-3 text-ink-muted">{holding.sector ?? "—"}</td>
        <td className="px-4 py-3 tabular text-ink-muted">{holding.trading_currency}</td>
        <td className="px-4 py-3 text-right tabular text-ink-muted">{holding.document_count}</td>
        <td className="px-2 py-3 text-right">
          <button
            type="button"
            onClick={startEditing}
            className="rounded px-2 py-1 text-xs font-medium text-ink-muted opacity-0 transition-opacity hover:bg-border-subtle hover:text-ink group-hover:opacity-100"
          >
            Edit
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border-subtle bg-accent/5 last:border-0">
      <td className="px-4 py-2">
        <input
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          className="w-28 rounded-md border border-border px-2 py-1 text-sm focus:border-accent focus:outline-none"
        />
      </td>
      <td className="px-4 py-2 text-ink">{holding.name}</td>
      <td className="px-4 py-2">
        <select
          value={assetClassRaw}
          onChange={(e) => setAssetClassRaw(e.target.value)}
          className="rounded-md border border-border px-2 py-1 text-sm focus:border-accent focus:outline-none"
        >
          {(fieldOptions?.instrument_types ?? [assetClassRaw]).map((t) => (
            <option key={t} value={t}>
              {INSTRUMENT_TYPE_LABELS[t] ?? t}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2">
        <select
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          className="rounded-md border border-border px-2 py-1 text-sm focus:border-accent focus:outline-none"
        >
          <option value="">—</option>
          {(fieldOptions?.sectors ?? []).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2 tabular text-ink-muted">{holding.trading_currency}</td>
      <td className="px-4 py-2 text-right tabular text-ink-muted">{holding.document_count}</td>
      <td className="px-2 py-2">
        <div className="flex justify-end gap-1.5">
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
            Cancel
          </Button>
        </div>
        {error && <p className="mt-1.5 max-w-[14rem] text-right text-xs text-negative">{error}</p>}
      </td>
    </tr>
  );
}

export default function HoldingsListPage() {
  const [holdings, setHoldings] = useState<Holding[] | null>(null);
  const [fieldOptions, setFieldOptions] = useState<HoldingFieldOptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  function reload() {
    setError(null);
    api
      .listHoldings()
      .then(setHoldings)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load holdings."),
      );
  }

  useEffect(reload, []);
  useEffect(() => {
    api.getHoldingFieldOptions().then(setFieldOptions).catch(() => setFieldOptions(null));
  }, []);

  function handleRowSaved(updated: Holding) {
    setHoldings((prev) => (prev ? prev.map((h) => (h.id === updated.id ? updated : h)) : prev));
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <PageHeader
        title="Holdings"
        subtitle="Every equity being tracked for the Buffett/Munger analysis. Hover a row and click Edit to fix its ticker, type, or sector."
        actions={
          !showForm && <Button onClick={() => setShowForm(true)}>Add holding</Button>
        }
      />

      {showForm && (
        <NewHoldingForm
          onCreated={(holding) => {
            setShowForm(false);
            setHoldings((prev) => (prev ? [...prev, holding] : [holding]));
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {error && <p className="mb-4 text-sm text-negative">{error}</p>}

      {holdings === null && !error && <p className="text-sm text-ink-muted">Loading…</p>}

      {holdings !== null && holdings.length === 0 && (
        <EmptyState>No holdings yet. Add the first one above.</EmptyState>
      )}

      {holdings !== null && holdings.length > 0 && (
        <Card className="overflow-hidden !p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-border-subtle text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="px-4 py-3 font-medium">Ticker</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Sector</th>
                <th className="px-4 py-3 font-medium">Currency</th>
                <th className="px-4 py-3 text-right font-medium">Documents</th>
                <th className="px-2 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {groupHoldings(holdings).map((row) =>
                row.kind === "whisky-group" ? (
                  <WhiskyGroupRow key="whisky-group" holdings={row.holdings} />
                ) : (
                  <HoldingRow
                    key={row.holding.id}
                    holding={row.holding}
                    fieldOptions={fieldOptions}
                    onSaved={handleRowSaved}
                  />
                ),
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
