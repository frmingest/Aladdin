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
      <p className="text-tertiary text-sm">
        No holdings yet — upload a portfolio snapshot first so there's something to attach a
        report to.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <section className="terminal-card">
        <h2 className="terminal-card-title mb-3">Upload holding document (PDF/PPTX/XLSX)</h2>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label-terminal">Holding</label>
            <select
              value={holdingId}
              onChange={(e) => setHoldingId(e.target.value)}
              className="input-terminal"
            >
              {holdings.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.ticker} — {h.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-terminal">Document type</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="input-terminal"
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-terminal">Reporting period</label>
            <input
              type="text"
              placeholder="FY2025"
              value={reportingPeriod}
              onChange={(e) => setReportingPeriod(e.target.value)}
              className="input-terminal w-28"
            />
          </div>
          <div>
            <label className="label-terminal">File</label>
            <input
              type="file"
              accept=".pdf,.pptx,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm text-secondary"
            />
          </div>
          <button
            type="submit"
            disabled={!file || submitting}
            className="btn-terminal btn-terminal-primary"
          >
            {submitting ? "Uploading…" : "Upload"}
          </button>
        </form>
        {errorMessage && <p className="text-negative text-sm mt-3">{errorMessage}</p>}
      </section>

      <section className="terminal-card">
        <h2 className="terminal-card-title mb-3">Documents for this holding</h2>
        {documents.length === 0 ? (
          <p className="text-tertiary text-sm">No documents uploaded for this holding yet.</p>
        ) : (
          <div className="terminal-table-wrapper">
            <table className="terminal-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Type</th>
                  <th>Period</th>
                  <th>Status</th>
                  <th className="numeric">Pages</th>
                  <th className="numeric">Facts</th>
                  <th>Quality flags</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => (
                  <tr key={d.id}>
                    <td className="primary">{d.original_filename}</td>
                    <td>{d.type}</td>
                    <td>{d.reporting_period ?? "—"}</td>
                    <td>{d.status}</td>
                    <td className="numeric">{d.page_count}</td>
                    <td className="numeric">{d.fact_count}</td>
                    <td className="text-warning">{d.quality_flags.join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
