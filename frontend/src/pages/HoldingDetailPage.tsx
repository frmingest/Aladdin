import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import type {
  CompanyResearch,
  DeletionResult,
  DocumentSummary,
  Holding,
  HoldingMetrics,
} from "../lib/types";
import {
  FACT_LABELS,
  FUND_TYPES,
  MARKET_METRICS,
  METRIC_LABELS,
  METRIC_ORDER,
  MONEY_METRICS,
  PERCENT_METRICS,
} from "../lib/types";
import {
  formatBytes,
  formatDate,
  formatDecimal,
  formatMoney,
  formatMultiple,
  formatPercent,
} from "../lib/format";
import { Button, Card, CollapsibleSection, EmptyState, PageHeader, StatusBadge } from "../components/ui";
import { AnalysisPanel } from "../components/AnalysisPanel";
import { FundFactsPanel } from "../components/FundFactsPanel";
import { MarketMultiplesCard } from "../components/MarketMultiplesCard";
import { DocumentFlagsNote } from "../components/DocumentFlagsNote";
import { ResearchPanel } from "../components/ResearchPanel";
import { SourcesPanel } from "../components/SourcesPanel";
import { ValuationPanel } from "../components/ValuationPanel";
import WatchButton from "../components/WatchButton";
import JournalPanel from "../components/JournalPanel";

function MetricsPanel({ holdingId }: { holdingId: string }) {
  const [periods, setPeriods] = useState<string[] | null>(null);
  const [period, setPeriod] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<HoldingMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped after the share count is edited, to reload the multiples.
  const [reload, setReload] = useState(0);

  useEffect(() => {
    api
      .listHoldingPeriods(holdingId)
      .then((list) => {
        setPeriods(list);
        if (list.length > 0) setPeriod(list[list.length - 1]);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load periods."),
      );
  }, [holdingId]);

  useEffect(() => {
    if (!period) return;
    setMetrics(null);
    api
      .getHoldingMetrics(holdingId, period)
      .then(setMetrics)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load metrics."),
      );
  }, [holdingId, period, reload]);

  if (error) return <p className="text-sm text-negative">{error}</p>;

  if (periods === null) return <p className="text-sm text-ink-muted">Loading…</p>;

  if (periods.length === 0) {
    return (
      <EmptyState>
        No extracted facts yet. Upload a filing below (the ESEF annual report .xhtml is the
        most reliable source) to see deterministic ratios here.
      </EmptyState>
    );
  }

  // "not meaningful" (e.g. net debt / EBITDA when EBITDA is negative) is a
  // result, not a gap — shown with the computed ratios as "n/m" + reason.
  const isNotMeaningful = (k: string) =>
    metrics?.skipped[k]?.startsWith("not meaningful") ?? false;
  const filingKeys = METRIC_ORDER.filter((k) => !MARKET_METRICS.has(k));
  const computedKeys = filingKeys.filter(
    (k) => metrics?.computed[k] !== undefined || isNotMeaningful(k),
  );
  const skippedKeys = filingKeys.filter(
    (k) => metrics?.skipped[k] !== undefined && !isNotMeaningful(k),
  );

  function renderValue(key: string, value: string) {
    if (PERCENT_METRICS.has(key)) return formatPercent(value);
    if (MONEY_METRICS.has(key)) return formatMoney(value, metrics?.currency ?? null);
    return formatMultiple(value);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-muted">Period</span>
        <select
          value={period ?? ""}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-md border border-border px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
        >
          {periods.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {metrics?.currency && (
          <span className="text-sm text-ink-muted">
            Figures in <span className="font-medium text-ink">{metrics.currency}</span> (the
            filing&apos;s reporting currency)
          </span>
        )}
        {metrics?.prior_period && (
          <span className="text-sm text-ink-muted">
            · returns averaged with {metrics.prior_period}
          </span>
        )}
      </div>

      {metrics && metrics.warnings.length > 0 && (
        <div className="mb-4 rounded-md border border-negative/30 bg-negative/5 px-4 py-3">
          <p className="mb-1 text-sm font-semibold text-ink">Check before relying on these figures</p>
          <ul className="list-disc space-y-1 pl-5 text-xs text-ink-muted">
            {metrics.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {!metrics ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <h3 className="mb-3 text-sm font-semibold text-ink">Computed</h3>
              {computedKeys.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  Nothing computable from this period&apos;s extracted facts yet.
                </p>
              ) : (
                <dl className="divide-y divide-border-subtle">
                  {computedKeys.map((key) => (
                    <div key={key} className="py-2 text-sm">
                      <div className="flex justify-between gap-4">
                        <dt className="text-ink-muted">{METRIC_LABELS[key]}</dt>
                        <dd className="tabular font-medium text-ink">
                          {metrics.computed[key] !== undefined
                            ? renderValue(key, metrics.computed[key])
                            : "n/m"}
                        </dd>
                      </div>
                      {metrics.computed[key] === undefined && (
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {metrics.skipped[key].replace(/^not meaningful: /, "")}
                        </p>
                      )}
                      {metrics.notes[key] && (
                        <p className="mt-0.5 text-xs text-ink-muted">{metrics.notes[key]}</p>
                      )}
                    </div>
                  ))}
                </dl>
              )}
            </Card>
            <Card>
              <h3 className="mb-3 text-sm font-semibold text-ink">Not available</h3>
              <dl className="divide-y divide-border-subtle">
                {skippedKeys.map((key) => (
                  <div key={key} className="py-2 text-sm">
                    <dt className="text-ink">{METRIC_LABELS[key]}</dt>
                    <dd className="mt-0.5 text-xs text-ink-muted">{metrics.skipped[key]}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </div>
          <MarketMultiplesCard
            holdingId={holdingId}
            metrics={metrics}
            onChanged={() => setReload((r) => r + 1)}
          />
          <FactSourcesTable metrics={metrics} />
        </>
      )}
    </div>
  );
}

/** Every extracted input behind the ratios, with the file, page and XBRL
 * tag it came from — so any number above can be checked against the
 * filing by hand. */
function FactSourcesTable({ metrics }: { metrics: HoldingMetrics }) {
  const [open, setOpen] = useState(false);
  if (metrics.fact_details.length === 0) return null;
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-sm text-accent hover:text-accent-hover"
      >
        {open ? "Hide" : "Show"} the {metrics.fact_details.length} extracted figures behind these
        ratios
      </button>
      {open && (
        <Card className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="py-2 font-medium">Figure</th>
                <th className="py-2 text-right font-medium">Value</th>
                <th className="py-2 pl-4 font-medium">Source</th>
                <th className="py-2 font-medium">File / page</th>
              </tr>
            </thead>
            <tbody>
              {metrics.fact_details.map((f) => (
                <tr key={f.metric} className="border-t border-border-subtle align-top">
                  <td className="py-2 text-ink">{FACT_LABELS[f.metric] ?? f.metric}</td>
                  <td className="py-2 text-right tabular text-ink">
                    {f.metric === "shares_outstanding"
                      ? formatDecimal(f.value, 0)
                      : f.metric === "eps_basic"
                        ? `${f.currency ?? ""} ${formatDecimal(f.value, 2)}`
                        : formatMoney(f.value, f.currency)}
                  </td>
                  <td className="break-all py-2 pl-4 text-xs text-ink-muted">
                    {f.source ?? "—"}
                    {f.confidence < 1 && (
                      <span className="ml-1 whitespace-nowrap text-ink">
                        ({f.source?.startsWith("proxy") ? "proxy" : "derived"})
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-xs text-ink-muted">
                    {f.original_filename}
                    {f.source_page ? ` · p${f.source_page}` : ""}
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

function DocumentsPanel({
  holdingId,
  onUploaded,
  isFund = false,
}: {
  holdingId: string;
  onUploaded: () => void;
  isFund?: boolean;
}) {
  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [documentType, setDocumentType] = useState(isFund ? "fund_factsheet" : "annual_report");
  const [reportingPeriod, setReportingPeriod] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function describe(result: DeletionResult): string {
    const failed = result.storage_files_failed.length;
    return (
      `Deleted ${result.documents} document(s), ${result.facts} extracted figure(s)` +
      (result.analysis_runs ? `, ${result.analysis_runs} analysis run(s)` : "") +
      ` and ${result.storage_files_deleted} stored file(s).` +
      (failed ? ` ${failed} stored file(s) could not be removed: ${result.storage_files_failed.join(", ")}` : "")
    );
  }

  async function handleDeleteDocument(doc: DocumentSummary) {
    if (
      !window.confirm(
        `Delete "${doc.original_filename}"? Its ${doc.fact_count} extracted figure(s), page text and the ` +
          `stored file are removed. You can upload it again afterwards. This cannot be undone.`,
      )
    )
      return;
    setError(null);
    setNote(null);
    setDeletingId(doc.id);
    try {
      setNote(describe(await api.deleteDocument(doc.id)));
      reload();
      onUploaded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete the document.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDeleteAll() {
    if (
      !window.confirm(
        "Delete ALL documents and data for this holding — every uploaded file, SEC EDGAR import, " +
          "extracted figure, analysis run, your notes, price history and company research? " +
          "The holding itself and its portfolio positions are kept. This cannot be undone.",
      )
    )
      return;
    setError(null);
    setNote(null);
    setDeletingId("all");
    try {
      setNote(describe(await api.deleteHoldingData(holdingId)));
      reload();
      onUploaded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete this holding's data.");
    } finally {
      setDeletingId(null);
    }
  }

  function reload() {
    api
      .listDocuments(holdingId)
      .then(setDocuments)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load documents."),
      );
  }

  useEffect(reload, [holdingId]);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      await api.uploadDocument({
        file,
        holdingId,
        documentType,
        reportingPeriod: reportingPeriod || undefined,
      });
      reload();
      onUploaded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-ink">Filings</h3>

      <div className="mb-4 flex flex-wrap items-end gap-3 border-b border-border-subtle pb-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">Type</span>
          <select
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            className="rounded-md border border-border px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
          >
            {isFund ? (
              <>
                <option value="fund_factsheet">Fact sheet</option>
                <option value="fund_kid">KID / KIID</option>
                <option value="fund_report">Fund annual / semi-annual report</option>
                <option value="fund_commentary">Monthly report / manager commentary</option>
                <option value="prospectus">Prospectus</option>
                <option value="other">Other</option>
              </>
            ) : (
              <>
                <option value="annual_report">Annual report</option>
                <option value="quarterly_report">Quarterly report</option>
                <option value="presentation">Presentation</option>
                <option value="prospectus">Prospectus</option>
                <option value="transcript">Transcript</option>
                <option value="other">Other</option>
              </>
            )}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">Period (optional)</span>
          <input
            value={reportingPeriod}
            onChange={(e) => setReportingPeriod(e.target.value)}
            placeholder="FY2025"
            className="w-28 rounded-md border border-border px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
          />
        </label>
        <label>
          <span className="sr-only">Choose file</span>
          <input
            type="file"
            accept=".pdf,.pptx,.xlsx,.csv,.xhtml,.html,.htm"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
            className="text-sm text-ink-muted file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-medium file:text-onfill hover:file:bg-accent-hover disabled:opacity-50"
          />
        </label>
        {uploading && <span className="text-sm text-ink-muted">Uploading…</span>}
        {isFund ? (
          <p className="basis-full text-xs text-ink-muted">
            Fund documents are read as text only: passages become cited excerpts, and the figures you type
            under Fund facts cite them. A holdings list (CSV/Excel) is imported under Fund facts.
          </p>
        ) : (
          <p className="basis-full text-xs text-ink-muted">
            Best source for figures: the ESEF annual report (.xhtml, up to 250 MB — embedded images are
            dropped on upload) — every number is tagged. CSV/Excel downloads from the company&apos;s IR page
            also work; only full-year columns become figures.
          </p>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-negative">{error}</p>}
      {note && <p className="mb-3 text-sm text-ink-muted">{note}</p>}

      {documents === null && <p className="text-sm text-ink-muted">Loading…</p>}

      {documents !== null && documents.length === 0 && (
        <p className="text-sm text-ink-muted">No filings uploaded yet.</p>
      )}

      {documents !== null && documents.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
              <th className="py-2 font-medium">File</th>
              <th className="py-2 font-medium">Type</th>
              <th className="py-2 font-medium">Period</th>
              <th className="py-2 font-medium">Uploaded</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 text-right font-medium">Facts</th>
              <th className="py-2 text-right font-medium">Size</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {documents.map((d) => (
              <tr key={d.id} className="border-t border-border-subtle">
                <td className="py-2 text-ink">
                  {d.original_filename}
                  <DocumentFlagsNote document={d} />
                </td>
                <td className="py-2 text-ink-muted">{d.type.replace(/_/g, " ")}</td>
                <td className="py-2 tabular text-ink-muted">{d.reporting_period ?? "—"}</td>
                <td className="py-2 tabular text-ink-muted">{formatDate(d.uploaded_at)}</td>
                <td className="py-2">
                  <StatusBadge status={d.status} />
                </td>
                <td className="py-2 text-right tabular text-ink-muted">{d.fact_count}</td>
                <td className="py-2 text-right tabular text-ink-muted">
                  {formatBytes(d.size_bytes)}
                </td>
                <td className="py-2 pl-3 text-right">
                  <button
                    type="button"
                    disabled={deletingId !== null}
                    onClick={() => void handleDeleteDocument(d)}
                    className="text-xs text-negative hover:underline disabled:opacity-50"
                  >
                    {deletingId === d.id ? "Deleting…" : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-4 flex items-center justify-between gap-4 border-t border-border-subtle pt-4">
        <p className="text-xs text-ink-muted">
          Deleting a document also removes its extracted figures and stored file. Re-upload it
          to extract it again with the latest rules.
        </p>
        <Button variant="danger" disabled={deletingId !== null} onClick={() => void handleDeleteAll()}>
          {deletingId === "all" ? "Deleting…" : "Delete all documents & data"}
        </Button>
      </div>
    </Card>
  );
}

function CompanyResearchSection({ holdingId, ticker }: { holdingId: string; ticker: string }) {
  const [snapshot, setSnapshot] = useState<CompanyResearch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    api
      .getCompanyResearch(holdingId)
      .then(setSnapshot)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load company research."),
      );
  }, [holdingId]);

  async function handleRefresh() {
    setError(null);
    setRefreshing(true);
    try {
      setSnapshot(await api.refreshCompanyResearch(holdingId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <ResearchPanel
      title={`${ticker} — company research`}
      snapshot={snapshot}
      error={error}
      refreshing={refreshing}
      onRefresh={handleRefresh}
      emptyHint="Needs a real GOOGLE_AI_STUDIO_API_KEY set on the backend."
    />
  );
}

export default function HoldingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [holding, setHolding] = useState<Holding | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metricsKey, setMetricsKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    api
      .getHolding(id)
      .then(setHolding)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load this holding."),
      );
  }, [id]);

  async function handleDelete() {
    if (!id || !holding) return;
    if (
      !window.confirm(
        `Delete ${holding.ticker} and everything attached to it — documents and stored files, ` +
          `extracted figures, analyses, notes, prices and research? Refused while it is still in a ` +
          `portfolio snapshot. This cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      await api.deleteHolding(id, true);
      navigate("/holdings");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete this holding.");
    }
  }

  if (!id) return null;

  if (error && !holding) {
    return (
      <div className="mx-auto max-w-5xl px-8 py-8">
        <p className="text-sm text-negative">{error}</p>
        <Link to="/holdings" className="mt-4 inline-block text-sm text-accent hover:text-accent-hover">
          ← Back to holdings
        </Link>
      </div>
    );
  }

  if (!holding) {
    return (
      <div className="mx-auto max-w-5xl px-8 py-8">
        <p className="text-sm text-ink-muted">Loading…</p>
      </div>
    );
  }

  // Sprint 8: an equity ETF / fund is analysed as a fund — Fund facts
  // replace the company metrics, valuation (DCF) and company research.
  const isFund = FUND_TYPES.has(holding.asset_class_raw);

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <Link to="/holdings" className="mb-4 inline-block text-sm text-ink-muted hover:text-ink">
        ← Holdings
      </Link>
      <PageHeader
        title={`${holding.name} (${holding.ticker})`}
        subtitle={[holding.sector, holding.trading_currency, holding.institution]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <div className="flex shrink-0 items-start gap-2">
            <WatchButton holdingId={id} />
            <Button variant="danger" onClick={handleDelete}>
              Delete holding
            </Button>
          </div>
        }
      />

      {holding.sector && (
        <Link
          to={`/sectors/${encodeURIComponent(holding.sector)}`}
          className="mb-6 inline-block text-sm text-accent hover:text-accent-hover"
        >
          {holding.sector} sector research →
        </Link>
      )}

      {error && <p className="mb-4 text-sm text-negative">{error}</p>}

      <div className="mb-8">
        <h2 className="section-title">
          Buffett/Munger analysis
        </h2>
        {/* Keyed on metricsKey so readiness re-checks after an upload or
            EDGAR import adds financial history. */}
        <AnalysisPanel key={metricsKey} holdingId={id} />
      </div>

      {isFund ? (
        <div className="mb-8">
          <h2 className="section-title">
            Fund facts
          </h2>
          <FundFactsPanel key={metricsKey} holdingId={id} />
        </div>
      ) : (
        <div className="mb-8">
          <h2 className="section-title">
            Deterministic metrics
          </h2>
          <MetricsPanel key={metricsKey} holdingId={id} />
        </div>
      )}

      <div className="mb-8">
        <h2 className="section-title">
          Documents
        </h2>
        <DocumentsPanel holdingId={id} isFund={isFund} onUploaded={() => setMetricsKey((k) => k + 1)} />
      </div>

      {!isFund && (
        <>
          <div className="mb-8">
            <h2 className="section-title">
              Valuation
            </h2>
            <ValuationPanel holdingId={id} ticker={holding.ticker} />
          </div>

          <div className="mb-8">
            <h2 className="section-title">
              Research
            </h2>
            <CompanyResearchSection holdingId={id} ticker={holding.ticker} />
          </div>
        </>
      )}

      <div className="mb-8">
        <CollapsibleSection title="Decision journal" hint="Why you bought or sold, and how it turned out">
          <JournalPanel holding={holding} />
        </CollapsibleSection>
      </div>

      <CollapsibleSection title="Primary sources" hint="SEC EDGAR filings · Oslo Børs announcements">
        <SourcesPanel holdingId={id} onFinancialsChanged={() => setMetricsKey((k) => k + 1)} />
      </CollapsibleSection>
    </div>
  );
}
