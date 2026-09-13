import { useEffect, useState } from "react";
import { ApiError, listSnapshots, uploadPortfolio } from "../services/api";
import type { PortfolioSnapshotDetail, PortfolioSnapshotSummary, RowError } from "../types/portfolio";

export default function PortfolioUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [reportingCurrency, setReportingCurrency] = useState("NOK");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PortfolioSnapshotDetail | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [rowErrors, setRowErrors] = useState<RowError[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<PortfolioSnapshotSummary[]>([]);

  const refreshSnapshots = () => {
    listSnapshots()
      .then(setSnapshots)
      .catch(() => undefined);
  };

  useEffect(refreshSnapshots, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setSubmitting(true);
    setResult(null);
    setWarnings([]);
    setRowErrors(null);
    setErrorMessage(null);

    try {
      const response = await uploadPortfolio(file, reportingCurrency);
      setResult(response.snapshot);
      setWarnings(response.warnings);
      refreshSnapshots();
    } catch (err) {
      if (err instanceof ApiError && err.detail && typeof err.detail === "object" && "row_errors" in (err.detail as object)) {
        const detail = err.detail as { message: string; row_errors: RowError[] };
        setErrorMessage(detail.message);
        setRowErrors(detail.row_errors);
      } else if (err instanceof ApiError) {
        setErrorMessage(typeof err.detail === "string" ? err.detail : "Upload failed.");
      } else {
        setErrorMessage("Upload failed — could not reach the backend.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-3">Upload portfolio (CSV/XLSX)</h2>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Portfolio file</label>
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Reporting currency</label>
            <input
              type="text"
              value={reportingCurrency}
              onChange={(e) => setReportingCurrency(e.target.value.toUpperCase())}
              maxLength={3}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 w-20 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={!file || submitting}
            className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed rounded px-4 py-1.5 text-sm font-medium"
          >
            {submitting ? "Uploading…" : "Upload"}
          </button>
        </form>

        {errorMessage && <p className="text-red-400 text-sm mt-3">{errorMessage}</p>}
        {rowErrors && (
          <ul className="text-red-400 text-sm mt-2 list-disc list-inside">
            {rowErrors.map((e, i) => (
              <li key={i}>
                Row {e.row}: {e.message}
              </li>
            ))}
          </ul>
        )}
        {warnings.length > 0 && (
          <ul className="text-amber-400 text-sm mt-2 list-disc list-inside">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}

        {result && (
          <div className="mt-4 overflow-x-auto">
            <p className="text-sm text-slate-400 mb-2">
              Snapshot {result.id.slice(0, 8)} — {result.status} — {result.positions.length} position(s)
            </p>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-800">
                  <th className="py-1 pr-4">Ticker</th>
                  <th className="py-1 pr-4">Name</th>
                  <th className="py-1 pr-4">Asset class</th>
                  <th className="py-1 pr-4">Weight %</th>
                  <th className="py-1 pr-4">Quantity</th>
                  <th className="py-1 pr-4">Cost basis</th>
                  <th className="py-1 pr-4">Sector</th>
                </tr>
              </thead>
              <tbody>
                {result.positions.map((p) => (
                  <tr key={p.holding_id} className="border-b border-slate-900">
                    <td className="py-1 pr-4">{p.ticker}</td>
                    <td className="py-1 pr-4">{p.name}</td>
                    <td className="py-1 pr-4">{p.asset_class}</td>
                    <td className="py-1 pr-4">{p.weight_pct ?? "—"}</td>
                    <td className="py-1 pr-4">{p.quantity ?? "—"}</td>
                    <td className="py-1 pr-4">
                      {p.cost_basis ?? "—"} {p.cost_basis_currency ?? ""}
                    </td>
                    <td className="py-1 pr-4">{p.sector ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Past snapshots</h2>
        {snapshots.length === 0 ? (
          <p className="text-slate-500 text-sm">No snapshots uploaded yet.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className="py-1 pr-4">Uploaded</th>
                <th className="py-1 pr-4">Currency</th>
                <th className="py-1 pr-4">Status</th>
                <th className="py-1 pr-4">Positions</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s) => (
                <tr key={s.id} className="border-b border-slate-900">
                  <td className="py-1 pr-4">{new Date(s.uploaded_at).toLocaleString()}</td>
                  <td className="py-1 pr-4">{s.reporting_currency}</td>
                  <td className="py-1 pr-4">{s.status}</td>
                  <td className="py-1 pr-4">{s.position_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
