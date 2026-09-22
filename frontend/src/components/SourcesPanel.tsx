import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { formatDate } from "../lib/format";
import type { EdgarImport, HoldingAnnouncements, SourceEligibility } from "../lib/types";
import { Button, Card, EmptyState } from "./ui";
import { ResearchPanel } from "./ResearchPanel";

/** Primary-source data for one holding (backend/app/api/sources.py):
 * SEC EDGAR annual financials (stored as financial facts, so metrics,
 * valuation and analysis use them) and Oslo Børs Newsweb announcements.
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
      <EdgarCard holdingId={holdingId} hint={eligibility.sec_edgar_reason} onImported={onFinancialsChanged} />
    </div>
  );
}
