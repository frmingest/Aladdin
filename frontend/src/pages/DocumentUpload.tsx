import { useEffect, useState } from "react";
import { ApiError, listDocuments, listHoldings, uploadDocument } from "../services/api";
import { DOCUMENT_TYPES, type DocumentSummary } from "../types/document";
import type { Holding } from "../types/portfolio";

export default function DocumentUpload() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [holdingId, setHoldingId] = useState("");
  const [documentType, setDocumentType] = useState<string>(DOCUMENT_TYPES[0]);
  const [reportingPeriod, setReportingPeriod] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);

  useEffect(() => {
    listHoldings()
      .then((h) => {
        setHoldings(h);
        if (h.length > 0) setHoldingId((current) => current || h[0].id);
      })
      .catch(() => undefined);
  }, []);

  const refreshDocuments = (forHoldingId: string) => {
    if (!forHoldingId) {
      setDocuments([]);
      return;
    }
    listDocuments(forHoldingId)
      .then(setDocuments)
      .catch(() => undefined);
  };

  useEffect(() => refreshDocuments(holdingId), [holdingId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !holdingId) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      await uploadDocument({ file, holdingId, documentType, reportingPeriod: reportingPeriod || undefined });
      refreshDocuments(holdingId);
      setFile(null);
    } catch (err) {
      setErrorMessage(
        err instanceof ApiError
          ? typeof err.detail === "string"
            ? err.detail
            : "Upload failed."
          : "Upload failed — could not reach the backend.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (holdings.length === 0) {
    return (
      <p className="text-slate-500 text-sm">
        No holdings yet — upload a portfolio snapshot first so there's something to attach a
        report to.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-3">Upload holding document (PDF/PPTX/XLSX)</h2>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Holding</label>
            <select
              value={holdingId}
              onChange={(e) => setHoldingId(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm"
            >
              {holdings.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.ticker} — {h.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Document type</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm"
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Reporting period</label>
            <input
              type="text"
              placeholder="FY2025"
              value={reportingPeriod}
              onChange={(e) => setReportingPeriod(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 w-28 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">File</label>
            <input
              type="file"
              accept=".pdf,.pptx,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
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
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Documents for this holding</h2>
        {documents.length === 0 ? (
          <p className="text-slate-500 text-sm">No documents uploaded for this holding yet.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className="py-1 pr-4">File</th>
                <th className="py-1 pr-4">Type</th>
                <th className="py-1 pr-4">Period</th>
                <th className="py-1 pr-4">Status</th>
                <th className="py-1 pr-4">Pages</th>
                <th className="py-1 pr-4">Facts</th>
                <th className="py-1 pr-4">Quality flags</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id} className="border-b border-slate-900">
                  <td className="py-1 pr-4">{d.original_filename}</td>
                  <td className="py-1 pr-4">{d.type}</td>
                  <td className="py-1 pr-4">{d.reporting_period ?? "—"}</td>
                  <td className="py-1 pr-4">{d.status}</td>
                  <td className="py-1 pr-4">{d.page_count}</td>
                  <td className="py-1 pr-4">{d.fact_count}</td>
                  <td className="py-1 pr-4 text-amber-400">{d.quality_flags.join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
