import { formatDate } from "../lib/format";
import type { ResearchItem, ResearchSnapshotBase } from "../lib/types";
import { RESEARCH_SOURCE_TYPE_LABELS } from "../lib/types";
import { Button, Card, EmptyState } from "./ui";

/** Shared by the Macro page, the Sector page, and HoldingDetailPage's
 * company-research panel (Sprint 2 — see backend/app/api/research.py).
 * Every item shown here is Gemini-grounded search output: CLAUDE.md Rule 5
 * treats LLM output/evidence as data to display, never as instructions, so
 * this renders titles/summaries as plain text (React escapes by default —
 * no dangerouslySetInnerHTML) and always keeps the source link attached. */

function ResearchItemCard({ item }: { item: ResearchItem }) {
  const dateLabel = item.published_at ? formatDate(item.published_at) : null;
  return (
    <li className="border-t border-border-subtle py-3 first:border-t-0 first:pt-0">
      <div className="mb-1 flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink">{item.title}</p>
        <span className="shrink-0 rounded-full bg-border-subtle px-2 py-0.5 text-xs font-medium text-ink-muted">
          {RESEARCH_SOURCE_TYPE_LABELS[item.source_type] ?? item.source_type}
        </span>
      </div>
      <p className="text-sm text-ink-muted">{item.summary}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-faint">
        <a
          href={item.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:text-accent-hover"
        >
          {item.source_name}
        </a>
        {dateLabel && <span>· {dateLabel}</span>}
      </div>
    </li>
  );
}

export function ResearchPanel({
  title,
  snapshot,
  error,
  refreshing,
  onRefresh,
  emptyHint,
}: {
  title: string;
  snapshot: ResearchSnapshotBase | null;
  error: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  emptyHint?: string;
}) {
  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {snapshot?.as_of && (
            <p className="mt-0.5 text-xs text-ink-faint">As of {formatDate(snapshot.as_of)}</p>
          )}
        </div>
        <Button variant="secondary" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {error && <p className="mb-3 text-sm text-negative">{error}</p>}

      {!error && snapshot === null && <p className="text-sm text-ink-muted">Loading…</p>}

      {!error && snapshot !== null && !snapshot.available && (
        <EmptyState>
          {snapshot.reason ?? "No research available yet."}
          {emptyHint && <span className="mt-1 block text-xs">{emptyHint}</span>}
        </EmptyState>
      )}

      {!error && snapshot !== null && snapshot.available && snapshot.items.length === 0 && (
        <EmptyState>The last run completed but returned no citable items.</EmptyState>
      )}

      {!error && snapshot !== null && snapshot.available && snapshot.items.length > 0 && (
        <ul>
          {snapshot.items.map((item, i) => (
            <ResearchItemCard key={`${item.source_url}-${i}`} item={item} />
          ))}
        </ul>
      )}

      {!error && snapshot !== null && snapshot.reason && snapshot.available && (
        <p className="mt-3 text-xs text-caution">{snapshot.reason}</p>
      )}
    </Card>
  );
}
