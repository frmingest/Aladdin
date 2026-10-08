import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { formatDate } from "../lib/format";
import { isValidLei, normalizeLei } from "../lib/lei";
import type {
  EdgarImport,
  EsefImport,
  HoldingAnnouncements,
  NewswebAnnualReport,
  NewswebAnnualReports,
  SourceEligibility,
} from "../lib/types";
import { Button, Card, EmptyState } from "./ui";
import { TagReviewBanner } from "./TagReviewBanner";
import { ResearchPanel } from "./ResearchPanel";

/** Primary-source data for one holding (backend/app/api/sources.py):
 * SEC EDGAR annual financials and earlier ESEF annual reports from
 * filings.xbrl.org (both stored as financial facts, so metrics, valuation
 * and analysis use them) and Oslo Børs Newsweb announcements.
 * All issuer text is rendered as plain text (CLAUDE.md Rule 5). */

function errorText(err: unknown): string {
  return err instanceof ApiError || err instanceof Error ? err.message : "request failed";
}

function EdgarCard({ holdingId, hint, onImported }: { holdingId: string; hint: string | null; onImported: () => void }) {
  const [data, setData] = useState<EdgarImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getEdgarImport(holdingId).then(setData).catch((e) => setError(errorText(e)));
  }, [holdingId]);

  async function runImport() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.importFromEdgar(holdingId);
      setData(result);
      onImported();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">SEC EDGAR financials</h3>
          <p className="mt-0.5 text-xs text-ink-faint">
            Annual 10-K / 20-F figures as filed with the SEC. Free, no key.
          </p>
        </div>
        <Button variant="secondary" onClick={runImport} disabled={busy}>
          {busy ? "Importing…" : data?.imported ? "Re-import" : "Import from SEC EDGAR"}
        </Button>
      </div>

      {error && <p className="mb-3 text-sm text-negative">{error}</p>}
      {data === null && !error && <p className="text-sm text-ink-muted">Loading…</p>}

      {data && !data.imported && !error && (
        <EmptyState>
          Nothing imported yet.
          {hint && <span className="mt-1 block text-xs">{hint}</span>}
        </EmptyState>
      )}

      {data?.imported && (
        <div className="space-y-3 text-sm">
          <p className="text-ink">
            <span className="font-medium">{data.entity_name}</span>{" "}
            <span className="text-ink-faint">CIK {data.cik}</span>
            {data.retrieved_at && (
              <span className="text-ink-faint"> · imported {formatDate(data.retrieved_at)}</span>
            )}
            {data.was_duplicate && <span className="text-ink-faint"> · already up to date</span>}
          </p>
          <p className="text-ink-muted">
            {data.facts_imported} facts across {data.periods_imported.length} years (
            {data.periods_imported.join(", ") || "none"})
          </p>
          {data.periods_skipped_manual.length > 0 && (
            <p className="text-xs text-caution">
              Skipped {data.periods_skipped_manual.join(", ")} — you already have figures from an uploaded document
              for these years.
            </p>
          )}
          {data.warnings.map((w) => (
            <p key={w} className="text-xs text-caution">
              {w}
            </p>
          ))}
          {data.filings.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-faint">Source filings</p>
              <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {data.filings.map((f) => (
                  <li key={f.accession_number}>
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:text-accent-hover"
                    >
                      {f.form} · {f.filed}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function EsefHistoryCard({ holdingId, onImported }: { holdingId: string; onImported: () => void }) {
  const [data, setData] = useState<EsefImport | null>(null);
  const [lei, setLei] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .getEsefImport(holdingId)
      .then((d) => {
        setData(d);
        setLei(d.lei ?? d.suggested_lei ?? "");
      })
      .catch((e) => setError(errorText(e)));
  }, [holdingId]);

  const cleanLei = normalizeLei(lei);
  const leiInvalid = cleanLei !== "" && !isValidLei(cleanLei);

  async function runImport() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.importFromEsefIndex(holdingId, cleanLei || null);
      setData(result);
      onImported();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">Earlier annual reports (ESEF index)</h3>
          <p className="mt-0.5 text-xs text-ink-faint">
            Tagged figures from the company&apos;s earlier ESEF annual reports on filings.xbrl.org, by LEI. Free,
            no key. The index runs about a year behind, so upload the latest report yourself.
          </p>
        </div>
        <Button variant="secondary" onClick={runImport} disabled={busy || leiInvalid}>
          {busy ? "Importing…" : data?.imported ? "Re-import" : "Import history"}
        </Button>
      </div>

      <label className="mb-3 block text-xs text-ink-muted">
        LEI
        <input
          value={lei}
          onChange={(e) => setLei(e.target.value)}
          placeholder="20 characters — found in the uploaded .xhtml, or search.gleif.org"
          spellCheck={false}
          className="mt-1 w-full rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-sm text-ink"
        />
        {leiInvalid && <span className="mt-1 block text-negative">Not a valid LEI (20 letters and digits; check for a typo).</span>}
        {!leiInvalid && data?.suggested_lei && cleanLei === data.suggested_lei && data.suggested_lei_source && (
          <span className="mt-1 block text-ink-faint">From {data.suggested_lei_source}</span>
        )}
      </label>

      {error && <p className="mb-3 text-sm text-negative">{error}</p>}
      {data === null && !error && <p className="text-sm text-ink-muted">Loading…</p>}

      {data && !data.imported && !error && (
        <EmptyState>
          Nothing imported yet.
          {!data.suggested_lei && (
            <span className="mt-1 block text-xs">
              Upload the company&apos;s ESEF annual report (.xhtml) and its LEI is filled in here.
            </span>
          )}
        </EmptyState>
      )}

      {data?.imported && (
        <div className="space-y-3 text-sm">
          <p className="text-ink-muted">
            {data.facts_imported} figures across {data.periods_imported.length} years (
            {data.periods_imported.join(", ") || "none"})
            {data.imported_at && <span className="text-ink-faint"> · imported {formatDate(data.imported_at)}</span>}
          </p>
          {data.latest_period_in_index && (
            <p className="text-xs text-ink-faint">Newest filing in the index: {data.latest_period_in_index}</p>
          )}
          {data.periods_skipped_existing.length > 0 && (
            <p className="text-xs text-caution">
              Skipped {data.periods_skipped_existing.join(", ")} — figures for these years are already on file from
              an upload or SEC EDGAR.
            </p>
          )}
          {data.warnings.map((w) => (
            <p key={w} className="text-xs text-caution">
              {w}
            </p>
          ))}
          {data.filings.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-faint">Source filings</p>
              <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {data.filings.map((f) => (
                  <li key={f.fxo_id}>
                    <a
                      href={f.viewer_url || f.report_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:text-accent-hover"
                    >
                      {f.period_end}
                    </a>
                    <span className="text-ink-faint">
                      {" "}
                      → {f.years_used.length > 0 ? f.years_used.join(", ") : "not used"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/** Shared shape for the annual and interim Newsweb-fetch cards below — same
 * flow, same response shape (NewswebAnnualReports), different endpoint,
 * copy and framing (annual = structured facts; interim = text evidence
 * only, see NewswebInterimReportCard). */
type NewswebReportKind = "annual" | "interim";
type TaggedNewswebReport = NewswebAnnualReport & { kind: NewswebReportKind };

/** Merges the two report lists newest-first by published date. Reports
 * with no date (shouldn't normally happen) sort last. */
function mergeNewswebReports(annual: NewswebAnnualReport[], interim: NewswebAnnualReport[]): TaggedNewswebReport[] {
  const tagged: TaggedNewswebReport[] = [
    ...annual.map((r) => ({ ...r, kind: "annual" as const })),
    ...interim.map((r) => ({ ...r, kind: "interim" as const })),
  ];
  tagged.sort((a, b) => {
    const ta = a.published_at ? Date.parse(a.published_at) : 0;
    const tb = b.published_at ? Date.parse(b.published_at) : 0;
    return tb - ta;
  });
  return tagged;
}

type NewswebRunSummary = {
  newlyImported: number;
  alreadyOnFile: string[];
  noAttachment: string[];
  failed: string[];
};

const EMPTY_RUN: NewswebRunSummary = { newlyImported: 0, alreadyOnFile: [], noAttachment: [], failed: [] };

/** One button that fetches everything Newsweb has for a holding — every
 * ESEF annual report (feeds metrics/DCF/ratios) and every half-year/interim
 * report (almost always a plain PDF, captured as citable text evidence
 * only — no financial facts, per CLAUDE.md Rule 1). Faiz's ask 2026-09-27:
 * having two separate buttons/cards for "the same thing, Newsweb reports"
 * was confusing — one holding's data getting the annual-only button
 * fetched looked like "the half-year fetch is broken" when really the
 * half-year button just hadn't been found/clicked yet. Both report kinds
 * are still fetched through their own backend endpoints (different
 * category id, different document_type, different PDF-fallback rule) —
 * this card only unifies the two calls behind one button and one merged
 * list, tagging each report with a small ANNUAL/HALF-YEAR badge. */
export function NewswebAllReportsCard({ holdingId, onImported }: { holdingId: string; onImported: () => void }) {
  const [annual, setAnnual] = useState<NewswebAnnualReports | null>(null);
  const [interim, setInterim] = useState<NewswebAnnualReports | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastRun, setLastRun] = useState<NewswebRunSummary | null>(null);

  useEffect(() => {
    setAnnual(null);
    setInterim(null);
    setLastRun(null);
    setLoadError(null);
    Promise.allSettled([api.getNewswebAnnualReports(holdingId), api.getNewswebInterimReports(holdingId)]).then(
      ([a, i]) => {
        if (a.status === "fulfilled") setAnnual(a.value);
        if (i.status === "fulfilled") setInterim(i.value);
        // Only surface a load error if both calls failed — one holding
        // being ineligible for one report kind is normal, not an error.
        if (a.status === "rejected" && i.status === "rejected") setLoadError(errorText(a.reason));
      },
    );
  }, [holdingId]);

  async function runImport() {
    setBusy(true);
    setLoadError(null);
    const [a, i] = await Promise.allSettled([
      api.importNewswebAnnualReports(holdingId),
      api.importNewswebInterimReports(holdingId),
    ]);
    const run: NewswebRunSummary = { ...EMPTY_RUN, alreadyOnFile: [], noAttachment: [], failed: [] };
    if (a.status === "fulfilled") {
      setAnnual(a.value);
      run.newlyImported += a.value.newly_imported_this_run;
      run.alreadyOnFile.push(...a.value.already_on_file_this_run);
      run.noAttachment.push(...a.value.no_esef_file_this_run);
      run.failed.push(...a.value.failed_this_run);
    } else {
      run.failed.push(`Annual reports: ${errorText(a.reason)}`);
    }
    if (i.status === "fulfilled") {
      setInterim(i.value);
      run.newlyImported += i.value.newly_imported_this_run;
      run.alreadyOnFile.push(...i.value.already_on_file_this_run);
      run.noAttachment.push(...i.value.no_esef_file_this_run);
      run.failed.push(...i.value.failed_this_run);
    } else {
      run.failed.push(`Half-year reports: ${errorText(i.reason)}`);
    }
    setLastRun(run);
    setBusy(false);
    if (run.newlyImported > 0) onImported();
  }

  const loaded = annual !== null || interim !== null || loadError !== null;
  const reports = mergeNewswebReports(annual?.reports ?? [], interim?.reports ?? []);
  const historyYear = (annual ?? interim)?.history_since.slice(0, 4) ?? null;

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">Reports from Newsweb</h3>
          <p className="mt-0.5 text-xs text-ink-faint">
            Fetches every annual report and every quarterly or half-year report (Q1, Q2, Q3 and full-year results) the company has published on Oslo Børs Newsweb, back to{" "}
            {historyYear ?? "2022"}, instead of you downloading and re-uploading them one by one. Annual ESEF reports
            feed the metrics, DCF and ratios; quarterly and half-year reports are almost always plain PDFs, so they&apos;re
            captured as citable evidence text only — they do <strong>not</strong> add any new numbers (CLAUDE.md
            Rule 1). Already-fetched reports aren&apos;t re-downloaded. Free, no key.
          </p>
        </div>
        <Button variant="secondary" onClick={runImport} disabled={busy}>
          {busy ? "Fetching…" : reports.length > 0 ? "Check for more reports" : "Fetch all reports"}
        </Button>
      </div>

      {loadError && <p className="mb-3 text-sm text-negative">{loadError}</p>}
      {!loaded && !loadError && <p className="text-sm text-ink-muted">Loading…</p>}
      {loaded && reports.length === 0 && !loadError && <EmptyState>Nothing fetched yet.</EmptyState>}

      <TagReviewBanner holdingId={holdingId} refreshKey={lastRun} />

      {lastRun && (
        <p className="mb-3 text-xs text-ink-faint">
          This run: {lastRun.newlyImported} new
          {lastRun.alreadyOnFile.length > 0 && `, ${lastRun.alreadyOnFile.length} already on file`}
          {lastRun.noAttachment.length > 0 &&
            ` · ${lastRun.noAttachment.length} with no attachment usable on Newsweb: ${lastRun.noAttachment.join(", ")}`}
        </p>
      )}
      {lastRun?.failed.map((w) => (
        <p key={w} className="mb-1 text-xs text-caution">
          {w}
        </p>
      ))}

      {reports.length > 0 && (
        <ul className="space-y-3 text-sm">
          {reports.map((report) => (
            <li
              key={`${report.kind}-${report.message_id}`}
              className="border-t border-border-subtle pt-3 first:border-0 first:pt-0"
            >
              <p className="text-ink">
                <span
                  className={`mr-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    report.kind === "annual" ? "bg-accent/15 text-accent" : "bg-ink-faint/15 text-ink-muted"
                  }`}
                >
                  {report.kind === "annual" ? "Annual" : "Quarterly / half-year"}
                </span>
                {report.message_url ? (
                  <a
                    href={report.message_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-accent hover:text-accent-hover"
                  >
                    {report.title}
                  </a>
                ) : (
                  <span className="font-medium">{report.title}</span>
                )}
                {report.published_at && (
                  <span className="text-ink-faint"> · published {formatDate(report.published_at)}</span>
                )}
              </p>
              <p className="text-ink-muted">
                {report.facts_imported > 0 ? (
                  <>
                    {report.facts_imported} facts across {report.periods_imported.length} periods (
                    {report.periods_imported.join(", ") || "none"})
                  </>
                ) : (
                  <>Text evidence only — no financial facts</>
                )}{" "}
                from &quot;{report.attachment_name}&quot;
                {report.was_duplicate && <span className="text-ink-faint"> · already up to date</span>}
              </p>
              {report.warnings.map((w) => (
                <p key={w} className="text-xs text-caution">
                  {w}
                </p>
              ))}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function NewswebCard({ holdingId }: { holdingId: string }) {
  const [snapshot, setSnapshot] = useState<HoldingAnnouncements | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    api.getAnnouncements(holdingId).then(setSnapshot).catch((e) => setError(errorText(e)));
  }, [holdingId]);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      setSnapshot(await api.refreshAnnouncements(holdingId));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <ResearchPanel
      title="Oslo Børs announcements (Newsweb)"
      snapshot={snapshot}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
      emptyHint="Regulated announcements from the last 12 months."
    />
  );
}

export function SourcesPanel({ holdingId, onFinancialsChanged }: { holdingId: string; onFinancialsChanged: () => void }) {
  const [eligibility, setEligibility] = useState<SourceEligibility | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getSourceEligibility(holdingId).then(setEligibility).catch((e) => setError(errorText(e)));
  }, [holdingId]);

  if (error) return <p className="text-sm text-negative">{error}</p>;
  if (eligibility === null) return <p className="text-sm text-ink-muted">Loading…</p>;

  return (
    <div className="space-y-4">
      {eligibility.newsweb && <NewswebCard holdingId={holdingId} />}
      {/* The combined Newsweb reports fetch (annual + half-year, one
          button) is shown at the top of the holding page (HoldingDetailPage)
          instead of here, so it's easy to find right after opening a
          position — not repeated in this panel (2026-09-26, unified
          2026-09-27 after Faiz found two separate buttons confusing). */}
      {eligibility.esef_index && <EsefHistoryCard holdingId={holdingId} onImported={onFinancialsChanged} />}
      <EdgarCard holdingId={holdingId} hint={eligibility.sec_edgar_reason} onImported={onFinancialsChanged} />
    </div>
  );
}
