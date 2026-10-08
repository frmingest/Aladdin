import { useEffect, useMemo, useState } from "react";
import { glossaryEntries } from "../lib/glossary";
import { METRIC_LABELS } from "../lib/types";
import { api } from "../lib/api";
import { codexPlates, loadSeen, saveSeen, seenAfter } from "../lib/codex";
import { useGameMode } from "../lib/gameMode";
import { useCachedQuery } from "../lib/queryCache";
import type { GameState } from "../lib/types";
import { Card, PageHeader } from "../components/ui";

/** One page for the plain-language terms behind the "i" tooltips (UX noise
 * audit, Wave 3). The text is the tooltips' own strings, so the two never
 * disagree; the page only lets you find a term without hunting for its icon. */
/** Game mode only (G36): the terms that already appear on your own realm, as plates. */
function Codex() {
  const stateQ = useCachedQuery<GameState>("game-state", () => api.getGameState());
  const [seen, setSeen] = useState(() => loadSeen());
  const plates = useMemo(() => codexPlates(stateQ.data, seen), [stateQ.data, seen]);
  useEffect(() => {
    if (!stateQ.data) return;
    const next = seenAfter(plates, seen);
    if (next.size !== seen.size) {
      saveSeen(next);
      setSeen(next);
    }
  }, [stateQ.data, plates, seen]);
  const open = plates.filter((p) => p.unlocked);
  return (
    <Card>
      <h2 className="section-title">Codex</h2>
      <p className="text-sm text-ink-muted">
        {open.length} of {plates.length} terms appear on your realm. A plate is a reading aid: unlocking one earns nothing, and
        it is remembered on this browser only.
      </p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2" aria-label="Codex plates">
        {plates.map((p) => (
          <li key={p.id} className={`rounded-md border p-3 ${p.unlocked ? "border-border" : "border-dashed border-border-subtle"}`}>
            <p className={`text-sm font-semibold ${p.unlocked ? "text-ink" : "text-ink-faint"}`}>{p.title}</p>
            <p className="mt-1 text-xs text-ink-muted">{p.unlocked ? p.text : `Appears ${p.hint}.`}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function GlossaryPage() {
  const { gameMode } = useGameMode();
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
      {gameMode && (
        <div className="mb-6">
          <Codex />
        </div>
      )}
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
