import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Holding, JournalEntry } from "../lib/types";
import { JournalEntryCard, JournalEntryForm } from "./Journal";
import { Button, Card, EmptyState } from "./ui";

/** The holding page's slice of the decision journal (feature F6). */
export default function JournalPanel({ holding }: { holding: Holding }) {
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    api
      .getJournal(holding.id)
      .then((j) => setEntries(j.entries))
      .catch(() => setEntries([]));
  }, [holding.id]);
  useEffect(load, [load]);

  return (
    <div className="space-y-3">
      {adding ? (
        <Card>
          <JournalEntryForm
            fixedHolding={holding}
            onSaved={() => {
              setAdding(false);
              load();
            }}
            onCancel={() => setAdding(false)}
          />
        </Card>
      ) : (
        <Button variant="secondary" onClick={() => setAdding(true)}>
          Record a decision
        </Button>
      )}
      {entries && entries.length === 0 && !adding && (
        <EmptyState>No decisions recorded for {holding.name} yet.</EmptyState>
      )}
      {entries?.map((e) => <JournalEntryCard key={e.id} entry={e} onChanged={load} showCompany={false} />)}
    </div>
  );
}
