import { useEffect, useRef, useState } from "react";
import type { Account } from "../types/portfolio";

/**
 * Dashboard-wide account filter (§26 accounts feature). Replaces the old
 * per-section "pick one account or leave it on the latest snapshot" pattern
 * with a single multi-select: no selection (or every account checked) means
 * "all accounts", and checking one or more accounts scopes every section on
 * the dashboard that can honor it. `selected: []` is the canonical "all
 * accounts" state — callers should treat an empty array that way rather than
 * requiring every account to be explicitly checked.
 */
export default function AccountFilter({
  accounts,
  selected,
  onChange,
}: {
  accounts: Account[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const allSelected = selected.length === 0;

  function toggleAccount(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  const summary = allSelected
    ? "All accounts"
    : selected.length === 1
      ? accounts.find((a) => a.id === selected[0])?.name ?? "1 account"
      : `${selected.length} accounts selected`;

  return (
    <div className="relative" ref={rootRef}>
      <label className="label-terminal">Accounts</label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="input-terminal min-w-[220px] flex items-center justify-between gap-2 text-left"
      >
        <span className="truncate">{summary}</span>
        <span className="text-tertiary text-xs">▾</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 min-w-[240px] max-h-72 overflow-y-auto rounded-md border border-primary bg-secondary p-1 shadow-lg">
          <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-tertiary cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => onChange([])}
            />
            <span className="text-primary">All accounts</span>
          </label>
          {accounts.length > 0 && <div className="my-1 border-t border-secondary" />}
          {accounts.map((a) => (
            <label
              key={a.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-tertiary cursor-pointer text-sm"
            >
              <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggleAccount(a.id)} />
              <span className="text-primary truncate">{a.name}</span>
              <span className="text-tertiary text-xs ml-auto font-mono">{a.account_number}</span>
            </label>
          ))}
          {accounts.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-tertiary">No accounts set up yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
