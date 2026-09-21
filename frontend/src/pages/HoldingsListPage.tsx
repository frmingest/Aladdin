import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import type { Holding, HoldingCreateInput } from "../lib/types";
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

export default function HoldingsListPage() {
  const [holdings, setHoldings] = useState<Holding[] | null>(null);
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

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <PageHeader
        title="Holdings"
        subtitle="Every equity being tracked for the Buffett/Munger analysis."
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
                <th className="px-4 py-3 font-medium">Sector</th>
                <th className="px-4 py-3 font-medium">Currency</th>
                <th className="px-4 py-3 text-right font-medium">Documents</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => (
                <tr key={h.id} className="border-b border-border-subtle last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      to={`/holdings/${h.id}`}
                      className="font-medium text-accent hover:text-accent-hover"
                    >
                      {h.ticker}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink">{h.name}</td>
                  <td className="px-4 py-3 text-ink-muted">{h.sector ?? "—"}</td>
                  <td className="px-4 py-3 tabular text-ink-muted">{h.trading_currency}</td>
                  <td className="px-4 py-3 text-right tabular text-ink-muted">
                    {h.document_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
