import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { Holding } from "../lib/types";

/** Quick jump (Ctrl/⌘+K, or the Search button in the nav): type a page
 * name, a ticker or a company name and press Enter. The app has 16 pages
 * and dozens of holdings; going through the sidebar and then the Holdings
 * table to reach one company was the longest navigation path in the app.
 * Holdings are fetched only the first time the palette opens. */

export type PaletteRoute = { label: string; to: string; group: string };

type Entry = { key: string; label: string; detail: string; to: string };

const MAX_HOLDINGS = 8;

export default function CommandPalette({
  open,
  onClose,
  routes,
}: {
  open: boolean;
  onClose: () => void;
  routes: PaletteRoute[];
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [holdings, setHoldings] = useState<Holding[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    inputRef.current?.focus();
    if (holdings === null) {
      api
        .listHoldings()
        .then(setHoldings)
        .catch(() => setHoldings([]));
    }
    // `holdings` intentionally not a dependency: fetch once per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const entries = useMemo<Entry[]>(() => {
    const q = query.trim().toLowerCase();
    const pages: Entry[] = routes
      .filter((r) => !q || r.label.toLowerCase().includes(q) || r.group.toLowerCase().includes(q))
      .map((r) => ({ key: `p:${r.to}`, label: r.label, detail: r.group, to: r.to }));
    const found: Entry[] = (holdings ?? [])
      .filter((h) => !q || h.name.toLowerCase().includes(q) || h.ticker.toLowerCase().includes(q))
      .slice(0, MAX_HOLDINGS)
      .map((h) => ({ key: `h:${h.id}`, label: h.name, detail: h.ticker, to: `/holdings/${h.id}` }));
    // With a query, a matching holding usually beats a page; without one, pages first.
    return q ? [...found, ...pages] : [...pages, ...found];
  }, [query, routes, holdings]);

  useEffect(() => setActive(0), [query]);

  if (!open) return null;

  const go = (entry: Entry | undefined) => {
    if (!entry) return;
    onClose();
    navigate(entry.to);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, entries.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(entries[active]);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]" onKeyDown={onKeyDown}>
      <button type="button" aria-label="Close search" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Jump to a page or holding"
        className="relative w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface shadow-card"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Jump to a page, ticker or company…"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={entries[active] ? `palette-${entries[active].key}` : undefined}
          className="w-full border-b border-border bg-transparent px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
        />
        <ul id="palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto py-1">
          {entries.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-ink-muted">
              {holdings === null ? "Loading…" : "Nothing matches that."}
            </li>
          )}
          {entries.map((entry, i) => (
            <li
              key={entry.key}
              id={`palette-${entry.key}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(entry)}
              className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm ${
                i === active ? "bg-accent-subtle text-ink" : "text-ink-muted"
              }`}
            >
              <span className="truncate">{entry.label}</span>
              <span className="shrink-0 text-xs text-ink-faint">{entry.detail}</span>
            </li>
          ))}
        </ul>
        <p className="border-t border-border-subtle px-4 py-2 text-[11px] text-ink-faint">
          ↑↓ to move · Enter to open · Esc to close
        </p>
      </div>
    </div>
  );
}
