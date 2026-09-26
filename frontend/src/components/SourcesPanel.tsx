import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { formatDate } from "../lib/format";
import { isValidLei, normalizeLei } from "../lib/lei";
import type {
  EdgarImport,
  EsefImport,
  HoldingAnnouncements,
  NewswebAnnualReportImport,
  SourceEligibility,
} from "../lib/types";
import { Button, Card, EmptyState } from "./ui";
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

function NewswebAnnualReportCard({ holdingId, onImported }: { holdingId: string; onImported: () => void }) {
  const [data, setData] = useState<NewswebAnnualReportImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getNewswebAnnualReportImport(holdingId).then(setData).catch((e) => setError(errorText(e)));
  }, [holdingId]);

  async function runImport() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.importNewswebAnnualReport(holdingId);
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
          <h3 className="text-sm font-semibold text-ink">Annual report from Newsweb</h3>
          <p className="mt-0.5 text-xs text-ink-faint">
            Fetches the company&apos;s own ESEF annual report straight from Newsweb (unzipping it if needed) instead
            of you downloading and re-uploading it. Free, no key.
          </p>
        </div>
        <Button variant="secondary" onClick={runImport} disabled={busy}>
          {busy ? "Fetching…" : data?.imported ? "Re-fetch" : "Fetch from Newsweb"}
        </Button>
      </div>

      {error && <p className="mb-3 text-sm text-negative">{error}</p>}
      {data === null && !error && <p className="text-sm text-ink-muted">Loading…</p>}

      {data && !data.imported && !error && (
        <EmptyState>Nothing fetched yet.</EmptyState>
      )}

      {data?.imported && (
        <div className="space-y-3 text-sm">
          <p className="text-ink">
            {data.message_url ? (
              <a
                href={data.message_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent hover:text-accent-hover"
              >
                {data.title}
              </a>
            ) : (
              <span className="font-medium">{data.title}</span>
            )}
            {data.published_at && <span className="text-ink-faint"> · published {formatDate(data.published_at)}</span>}
          </p>
          <p className="text-ink-muted">
            {data.facts_imported} facts across {data.periods_imported.length} years (
            {data.periods_imported.join(", ") || "none"}) from &quot;{data.attachment_name}&quot;
            {data.was_duplicate && <span className="text-ink-faint"> · already up to date</span>}
          </p>
          {data.warnings.map((w) => (
            <p key={w} className="text-xs text-caution">
              {w}
            </p>
          ))}
        </div>
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
      {eligibility.newsweb_annual_report && (
        <NewswebAnnualReportCard holdingId={holdingId} onImported={onFinancialsChanged} />
      )}
      {eligibility.esef_index && <EsefHistoryCard holdingId={holdingId} onImported={onFinancialsChanged} />}
      <EdgarCard holdingId={holdingId} hint={eligibility.sec_edgar_reason} onImported={onFinancialsChanged} />
    </div>
  );
}
