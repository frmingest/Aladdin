import { Link } from "react-router-dom";
import { ReviewField } from "../components/Journal";
import { formatDate, formatPct100 } from "../lib/format";
import type { JournalEntry } from "../lib/types";
import { sortedBooks } from "./journalBooks";
import {
  BOOKS_BACK,
  BOOKS_CLOSE,
  BOOKS_EMPTY,
  BOOKS_FAILED,
  BOOKS_NOT_WRITTEN,
  BOOKS_PANEL_TITLE,
  BOOKS_PLAIN,
} from "./journalWordsV1";

/**
 * The old books (S16, PR 2): the decision journal's old entries, read in the world from the writing desk. Read only:
 * no edit and no delete here (those stay on the flat journal page). The one write is the look-back box on an entry whose
 * 6- or 12-month review is due, which is the flat journal's own box and its own save, so nothing new is written to the
 * server. Every number is the server's (the same outcome the flat page prints); this panel only lists, newest first.
 */
export default function JournalBooksPanel({
  entries,
  failed,
  onChanged,
  onBack,
  onClose,
}: {
  entries: readonly JournalEntry[] | null;
  /** The journal could not be read: say so, never show it as empty. */
  failed: boolean;
  /** After a look-back was saved, so the world reads the journal and the Standing again. */
  onChanged: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const books = entries ? sortedBooks(entries) : [];
  return (
    <aside
      aria-label={BOOKS_PANEL_TITLE}
      className="g3d-panel absolute inset-x-3 top-14 z-40 flex max-h-[calc(100%-4.5rem)] flex-col overflow-hidden p-2 text-sm md:inset-x-[20%]"
    >
      <header className="g3d-head">
        <h2>{BOOKS_PANEL_TITLE}</h2>
        <span className="flex items-center gap-2">
          <button type="button" className="g3d-btn" onClick={onBack}>{BOOKS_BACK}</button>
          <Link to="/journal" className="g3d-btn">{BOOKS_PLAIN}</Link>
          <button type="button" className="g3d-x" aria-label={BOOKS_CLOSE} onClick={onClose}>×</button>
        </span>
      </header>
      <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto rounded bg-surface p-2">
        {failed || entries === null ? (
          <p role="status">{BOOKS_FAILED}</p>
        ) : books.length === 0 ? (
          <p>{BOOKS_EMPTY}</p>
        ) : (
          books.map((e) => <Book key={e.id} entry={e} onChanged={onChanged} />)
        )}
      </div>
    </aside>
  );
}

function Book({ entry: e, onChanged }: { entry: JournalEntry; onChanged: () => void }) {
  const o = e.outcome;
  return (
    <article className="rounded border border-border-subtle p-2" aria-label={`${e.company_name}, ${formatDate(e.decided_on)}`}>
      <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-ink-muted">
        <span className="font-semibold uppercase tracking-wide">{e.action}</span>
        <span className="font-medium text-ink">{e.company_name}</span>
        <span>{e.ticker} · {formatDate(e.decided_on)}</span>
        {o.return_pct !== null && (
          <span>since then {formatPct100(o.return_pct)} ({o.days_since} days)</span>
        )}
      </p>
      <p className="mt-1 text-xs font-medium text-ink-muted">Why</p>
      <p className="whitespace-pre-line text-ink">{e.thesis}</p>
      <p className="mt-1 text-xs font-medium text-ink-muted">What would prove me wrong</p>
      <p className="whitespace-pre-line text-ink">{e.invalidation ?? <span className="text-ink-faint">{BOOKS_NOT_WRITTEN}</span>}</p>
      {e.review_6m && (
        <p className="mt-1 text-ink">
          <span className="text-xs font-medium text-ink-muted">6-month review: </span>
          {e.review_6m}
        </p>
      )}
      {e.review_12m && (
        <p className="mt-1 text-ink">
          <span className="text-xs font-medium text-ink-muted">12-month review: </span>
          {e.review_12m}
        </p>
      )}
      {o.review_6m_due && <ReviewField entry={e} which="review_6m" onSaved={onChanged} />}
      {!o.review_6m_due && o.review_12m_due && <ReviewField entry={e} which="review_12m" onSaved={onChanged} />}
    </article>
  );
}
