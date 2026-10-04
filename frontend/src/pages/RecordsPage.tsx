import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { formatDate } from "../lib/format";
import {
  REVIEW_CLASS,
  REVIEW_LABEL,
  actionLabel,
  daysText,
  filterRecords,
  priceLine,
  verdictLine,
} from "../lib/rituals";
import type { DecisionRecord, Records } from "../lib/types";
import { Card, EmptyState, PageHeader } from "../components/ui";

/** The Hall of Records (game mode G18): the decision journal as a library. Hindsight, not a score:
 * there is no hit rate, no ranking and no "good or bad decision" label. Each record shows what you
 * wrote then, the analyst verdict then and now, the price then and now, and which written reviews
 * are owed. Read-only; to write a review or a new entry, open the Journal. */

function Review({ label, state, text }: { label: string; state: DecisionRecord["review_6m"]; text: string | null }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-2 text-xs">
        <span className="font-semibold text-ink-muted">{label} review</span>
        <span className={`rounded-full px-2 py-0.5 font-semibold ${REVIEW_CLASS[state]}`}>{REVIEW_LABEL[state]}</span>
      </p>
      {text && <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{text}</p>}
    </div>
  );
}

function RecordCard({ r }: { r: DecisionRecord }) {
  return (
    <Card>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-base font-semibold text-ink">
          {actionLabel(r.action)}{" "}
          {r.holding_id ? (
            <Link to={`/holdings/${r.holding_id}`} className="text-accent hover:underline">
              {r.company_name}
            </Link>
          ) : (
            r.company_name
          )}
        </h3>
        <span className="text-xs text-ink-faint">
          {formatDate(r.decided_on)} · {daysText(r.days_since)}
          {r.confidence !== null && ` · confidence ${r.confidence} of 5`}
        </span>
      </div>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-faint">What you wrote then</dt>
          <dd className="mt-1 whitespace-pre-wrap text-ink">{r.thesis}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-faint">What would prove it wrong</dt>
          <dd className="mt-1 whitespace-pre-wrap text-ink">
            {r.invalidation ?? <span className="text-ink-faint">Nothing was written.</span>}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-sm text-ink-muted">{priceLine(r)}</p>
      <p className="text-sm text-ink-muted">{verdictLine(r)}</p>
      <div className="mt-3 grid gap-3 border-t border-border-subtle pt-3 sm:grid-cols-2">
        <Review label="6-month" state={r.review_6m} text={r.review_6m_text} />
        <Review label="12-month" state={r.review_12m} text={r.review_12m_text} />
      </div>
    </Card>
  );
}

export default function RecordsPage() {
  const [records, setRecords] = useState<Records | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyOwed, setOnlyOwed] = useState(false);

  useEffect(() => {
    let live = true;
    api
      .getRecords()
      .then((r) => live && setRecords(r))
      .catch((e: unknown) => live && setError(e instanceof ApiError ? e.message : "Could not load the records."));
    return () => {
      live = false;
    };
  }, []);

  const shown = useMemo(() => (records ? filterRecords(records.records, onlyOwed) : []), [records, onlyOwed]);

  return (
    <div>
      <PageHeader
        title="Hall of Records"
        subtitle="Your decision journal as a library: what you wrote, what the price did, which reviews are owed."
        actions={
          <span className="flex gap-3 text-sm">
            <Link to="/journal" className="text-accent hover:underline">
              Open the Journal
            </Link>
            <Link to="/fortress" className="text-accent hover:underline">
              Back to the Fortress
            </Link>
          </span>
        }
      />
      {error && <EmptyState>{error}</EmptyState>}
      {!error && !records && <p className="text-sm text-ink-muted">Opening the archive…</p>}
      {records && (
        <div className="space-y-4">
          <Card>
            <p className="text-sm text-ink">{records.caption}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-ink-muted">
              {records.demo && (
                <span className="rounded-full bg-caution-subtle px-2.5 py-0.5 text-xs font-semibold text-caution">Demo data</span>
              )}
              <span>
                {records.records.length} {records.records.length === 1 ? "record" : "records"} · {records.reviews_due}{" "}
                {records.reviews_due === 1 ? "review" : "reviews"} owed
              </span>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={onlyOwed} onChange={(e) => setOnlyOwed(e.target.checked)} />
                Only those with a review owed
              </label>
            </div>
          </Card>
          {records.records.length === 0 ? (
            <EmptyState>
              The archive is empty. Decisions you log in the <Link to="/journal" className="text-accent hover:underline">Journal</Link> are
              shelved here.
            </EmptyState>
          ) : shown.length === 0 ? (
            <EmptyState>No record has a review owed.</EmptyState>
          ) : (
            shown.map((r) => <RecordCard key={r.id} r={r} />)
          )}
        </div>
      )}
    </div>
  );
}
