import { useEffect, useRef, useState } from "react";

// The three portfolio "sources" the dashboard's Composition view can
// aggregate/split by (Faiz's framing: Nordnet securities, coin collection,
// whisky collection) — a thin label layer over app.domain.asset_class.
// COMMODITY = coin collection (Phase 8, ADR 0011 — physical gold/silver);
// COLLECTIBLE = whisky collection (same ADR); everything else (EQUITY, ETF,
// FUND, CASH, BOND, OTHER) is grouped as "Securities" since that's what a
// Nordnet export or a canonical-schema brokerage upload produces.
export const SECURITIES = "Securities";
export const COIN_COLLECTION = "Coin collection";
export const WHISKY_COLLECTION = "Whisky collection";

export type CollectionKey = typeof SECURITIES | typeof COIN_COLLECTION | typeof WHISKY_COLLECTION;

export const ALL_COLLECTIONS: CollectionKey[] = [SECURITIES, COIN_COLLECTION, WHISKY_COLLECTION];

/** Maps a holding's raw `asset_class` (app.domain.asset_class.AssetClass) to
 * which of the three collections it belongs to for this filter/grouping. */
export function collectionForAssetClass(assetClass: string): CollectionKey {
  if (assetClass === "COMMODITY") return COIN_COLLECTION;
  if (assetClass === "COLLECTIBLE") return WHISKY_COLLECTION;
  return SECURITIES;
}

/**
 * Dashboard-wide collection filter — include/exclude Securities, Coin
 * collection, and Whisky collection from the views below (Faiz's ask: these
 * are three genuinely different kinds of holding — a live-priced brokerage
 * account, a handful of manually-entered coins, and an at-cost whisky
 * collection — and mixing them into one "by holding" chart buried the real
 * securities under dozens of individual bottles/coins).
 *
 * Same convention as AccountFilter: `selected: []` means "all three
 * included" rather than requiring every checkbox to be explicitly ticked.
 * Unlike the account filter, this doesn't require a live re-fetch — every
 * section that supports it filters/re-aggregates the valuation data it
 * already has, so it applies instantly.
 */
export default function CollectionFilter({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (keys: string[]) => void;
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

  function toggle(key: CollectionKey) {
    const current = allSelected ? ALL_COLLECTIONS : selected;
    if (current.includes(key)) {
      const next = current.filter((k) => k !== key);
      // Excluding the last remaining collection would leave nothing to show
      // and silently fall back to "all" (empty array) — ignore instead so
      // there's always at least one collection selected.
      if (next.length === 0) return;
      onChange(next);
    } else {
      const next = [...current, key];
      onChange(next.length === ALL_COLLECTIONS.length ? [] : next);
    }
  }

  const summary = allSelected
    ? "All collections"
    : selected.length === 1
      ? selected[0]
      : `${selected.length} collections selected`;

  return (
    <div className="relative" ref={rootRef}>
      <label className="label-terminal">Collections</label>
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
        <div className="absolute z-20 mt-1 min-w-[220px] rounded-md border border-primary bg-secondary p-1 shadow-lg">
          <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-tertiary cursor-pointer text-sm">
            <input type="checkbox" checked={allSelected} onChange={() => onChange([])} />
            <span className="text-primary">All collections</span>
          </label>
          <div className="my-1 border-t border-secondary" />
          {ALL_COLLECTIONS.map((key) => (
            <label
              key={key}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-tertiary cursor-pointer text-sm"
            >
              <input
                type="checkbox"
                checked={allSelected || selected.includes(key)}
                onChange={() => toggle(key)}
              />
              <span className="text-primary truncate">{key}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
