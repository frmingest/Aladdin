import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import type { Holding, JournalAction, JournalEntry } from "../lib/types";
import { JournalEntryCard, JournalEntryForm } from "../components/Journal";
import { JOURNAL_ACTIONS as ACTIONS } from "../lib/types";
import { Button, Card, EmptyState, PageHeader, StatTile } from "../components/ui";

/** Feature F6 — the decision journal. Write down why you bought or sold
 * and what would prove you wrong, then come back after 6 and 12 months.
 * The outcome numbers are computed from stored prices only. */
export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [reviewsDue, setReviewsDue] = useState(0);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<JournalAction | "all" | "due">("all");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .getJournal()
      .then((j) => {
        setEntries(j.entries);
        setReviewsDue(j.reviews_due);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load the journal."));
  }, []);

  useEffect(() => {
    load();
    api.listHoldings().then(setHoldings).catch(() => setHoldings([]));
  }, [load]);

  const scored = entries?.filter((e) => e.outcome.in_favour !== null) ?? [];
  const inFavour = scored.filter((e) => e.outcome.in_favour).length;
  const shown =
    entries?.filter((e) =>
      filter === "all"
        ? true
        : filter === "due"
          ? e.outcome.review_6m_due || e.outcome.review_12m_due
          : e.action === filter,
    ) ?? [];

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <PageHeader
        title="Decision journal"
        subtitle="Why you acted, what would prove you wrong, and how it turned out."
        actions={!adding && <Button onClick={() => setAdding(true)}>New entry</Button>}
      />

      {error && <p className="mb-4 text-sm text-negative">{error}</p>}

      <div className="space-y-6">
        {adding && (
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-ink">New entry</h2>
            <JournalEntryForm
              holdings={holdings}
              onSaved={() => {
                setAdding(false);
                load();
              }}
              onCancel={() => setAdding(false)}
            />
          </Card>
        )}

        {entries && entries.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <StatTile label="Entries" value={entries.length} />
            <StatTile
              label="Price moved in your favour"
              value={scored.length ? `${inFavour} of ${scored.length}` : "—"}
              hint="Buy/add: price rose. Sell/trim/pass: price fell."
            />
            <StatTile
              label="Reviews due"
              value={reviewsDue}
              tone={reviewsDue ? "text-caution" : "text-ink"}
              hint="At 6 and 12 months after a decision"
            />
          </div>
        )}

        {entries && entries.length > 0 && (
          <div className="flex flex-wrap gap-1.5 text-xs">
            {[{ key: "all", label: "All" }, { key: "due", label: `Review due (${reviewsDue})` }, ...ACTIONS].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key as typeof filter)}
                className={`rounded-full border px-3 py-1 font-medium ${
                  filter === f.key ? "border-accent bg-accent-subtle text-accent" : "border-border text-ink-muted hover:text-ink"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {entries && entries.length === 0 && !adding && (
          <EmptyState>
            No entries yet. Before your next buy or sell, write down why, and what would prove you wrong.
          </EmptyState>
        )}

        {shown.map((entry) => (
          <JournalEntryCard key={entry.id} entry={entry} onChanged={load} />
        ))}
      </div>
    </div>
  );
}
