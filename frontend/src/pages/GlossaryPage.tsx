import { useEffect, useMemo, useState } from "react";
import { glossaryEntries } from "../lib/glossary";
import { METRIC_LABELS } from "../lib/types";
import { PageHeader } from "../components/ui";

/** One page for the plain-language terms behind the "i" tooltips (UX noise
 * audit, Wave 3). The text is the tooltips' own strings, so the two never
 * disagree; the page only lets you find a term without hunting for its icon. */
export default function GlossaryPage() {
  const [query, setQuery] = useState("");
  const all = useMemo(() => glossaryEntries(METRIC_LABELS), []);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? all.filter((e) => e.title.toLowerCase().includes(q) || e.text.toLowerCase().includes(q)) : all;
  }, [all, query]);
  useEffect(() => {
    document.title = "Glossary · Aladdin";
  }, []);
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-8">
      <PageHeader title="Glossary" subtitle="What the terms in the app mean, in plain words." />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Find a term…"
        aria-label="Find a term"
        className="mb-6 w-full rounded-md border border-border bg-raised px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
      />
      {shown.length === 0 ? (
        <p className="text-sm text-ink-muted">No term matches.</p>
      ) : (
        <dl className="space-y-5">
          {shown.map((e) => (
            <div key={e.id}>
              <dt className="text-sm font-semibold text-ink">{e.title}</dt>
              <dd className="mt-1 text-sm text-ink-muted">{e.text}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
