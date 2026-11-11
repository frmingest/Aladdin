import { useMemo, useState } from "react";
import {
  ALL,
  DUSTY_LINE,
  NO_MATCH_LINE,
  ON_STREET_LABEL,
  OPEN_STALL_LABEL,
  SEARCH_PLACEHOLDER,
  SHOW_MORE_LABEL,
  SIZE_FILTERS,
  SIZE_HINT,
  SIZE_LABEL,
  TYPE_INSTEAD_LABEL,
  coinCount,
  countLine,
  filterCatalogue,
  formatCap,
  isDusty,
  shelfCounts,
  shelfInfo,
  shelfOf,
  stockedLine,
} from "../../lib/salShop";
import type { Catalogue, CatalogueItem, CatalogueSizeBand } from "../../lib/types";
import "./shop.css";

/**
 * Sal's shelves: pick an Oslo company from categories instead of typing its ticker (2026-11-11).
 * Shared by the flat Marketplace pop-up and /game3d (both render SalesRepDialog). Visual verb + scene:
 * *Browse* the shelves of a market stall under a striped awning. One real fact is drawn on every card: its
 * size, as a stack of coins, always with the word beside it (coins and colour are never the only signal;
 * a size Yahoo did not give is drawn as empty coins and the words "size in fog").
 * Tapping a card opens the stall at once: selecting acts, there is no second "confirm" step.
 * The only write is the watchlist add the parent already makes. Nothing is bought or sold.
 */

const PAGE = 48;

function Awning() {
  const stripes = Array.from({ length: 14 }, (_, i) => i);
  return (
    <svg className="shop-awning" viewBox="0 0 560 34" preserveAspectRatio="none" aria-hidden focusable="false">
      {stripes.map((i) => (
        <path key={i} d={`M${i * 40} 0h40v20a20 13 0 0 1 -40 0z`} fill={i % 2 === 0 ? "#1f6f78" : "#efe3c2"} />
      ))}
      <rect x="0" y="0" width="560" height="4" fill="#0f3d43" />
    </svg>
  );
}

function Coins({ band }: { band: CatalogueSizeBand }) {
  const filled = coinCount(band);
  return (
    <svg className="shop-coins" viewBox="0 0 64 14" aria-hidden focusable="false">
      {[0, 1, 2, 3].map((i) =>
        i < filled ? (
          <g key={i}>
            <circle cx={7 + i * 16} cy="7" r="6" fill="#f2d16b" stroke="#8a6a1c" strokeWidth="1.2" />
            <circle cx={7 + i * 16} cy="7" r="3" fill="none" stroke="#b8922a" strokeWidth="1" />
          </g>
        ) : (
          <circle key={i} cx={7 + i * 16} cy="7" r="5.5" fill="none" stroke="#6b5328" strokeWidth="1" strokeDasharray="2 2" />
        ),
      )}
    </svg>
  );
}

export default function SalesShop({
  catalogue,
  taken,
  disabled,
  onPick,
  onTypeInstead,
  now,
}: {
  catalogue: Catalogue;
  /** Tickers (upper case) that already have a stall. */
  taken: Set<string>;
  /** Demo mode: look, don't pick. */
  disabled: boolean;
  onPick: (item: CatalogueItem) => void;
  onTypeInstead: () => void;
  /** For tests: the clock used for "stocked N days ago". */
  now?: number;
}) {
  const [shelf, setShelf] = useState(ALL);
  const [band, setBand] = useState<CatalogueSizeBand | null>(null);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const shelves = useMemo(() => shelfCounts(catalogue.items), [catalogue.items]);
  const results = useMemo(() => filterCatalogue(catalogue.items, { shelf, band, query }), [catalogue.items, shelf, band, query]);
  const visible = results.slice(0, limit);
  const clock = now ?? Date.now();
  const stocked = stockedLine(catalogue.as_of, clock);
  const fine = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: fine)").matches;

  return (
    <div className="shop">
      <Awning />
      <div className="shop-body">
        <div className="shop-controls">
          <label className="sal-label shop-search">
            <span className="sr-only">Search the shelves</span>
            <input
              className="sal-input"
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE);
              }}
              placeholder={SEARCH_PLACEHOLDER}
              autoFocus={fine}
              autoComplete="off"
              spellCheck={false}
              aria-label="Search the shelves"
            />
          </label>
          <div className="shop-sizes" role="group" aria-label="Size">
            <button type="button" className="shop-chip" aria-pressed={band === null} onClick={() => { setBand(null); setLimit(PAGE); }}>
              Any size
            </button>
            {SIZE_FILTERS.map((b) => (
              <button
                key={b}
                type="button"
                className="shop-chip"
                aria-pressed={band === b}
                title={SIZE_HINT[b]}
                onClick={() => {
                  setBand(band === b ? null : b);
                  setLimit(PAGE);
                }}
              >
                {SIZE_LABEL[b]}
              </button>
            ))}
          </div>
        </div>

        <div className="shop-layout">
        <div className="shop-shelves" role="group" aria-label="Shelves">
          {shelves.map((s) => (
            <button
              key={s.key}
              type="button"
              className="shop-shelf"
              aria-pressed={shelf === s.key}
              onClick={() => {
                setShelf(s.key);
                setLimit(PAGE);
              }}
            >
              <span className="shop-shelf-title">
                {s.title} <span className="tabular shop-shelf-count">{s.count}</span>
              </span>
              <span className="shop-shelf-real">{s.real}</span>
            </button>
          ))}
        </div>

        <div className="shop-results">
        <p className="shop-count" role="status" aria-live="polite">
          {countLine(results.length, catalogue.items.length)}
        </p>

        {results.length === 0 ? (
          <p className="shop-empty">{NO_MATCH_LINE}</p>
        ) : (
          <ul className="shop-grid" aria-label="Stalls you can open">
            {visible.map((item) => {
              const onStreet = taken.has(item.ticker.toUpperCase());
              const sizeWord = SIZE_LABEL[item.size_band];
              return (
                <li key={item.ticker}>
                  <button
                    type="button"
                    className="shop-card"
                    data-band={item.size_band}
                    data-taken={onStreet ? "true" : undefined}
                    disabled={onStreet || disabled}
                    onClick={() => onPick(item)}
                    aria-label={onStreet ? `${item.name}, ${item.ticker}. ${ON_STREET_LABEL}.` : `${OPEN_STALL_LABEL} for ${item.name}, ${item.ticker}. ${sizeWord}.`}
                  >
                    <span className="shop-card-top">
                      <Coins band={item.size_band} />
                      <span className="shop-card-size">{sizeWord}</span>
                    </span>
                    <span className="shop-card-name">{item.name}</span>
                    <span className="shop-card-meta">
                      <span className="tabular">{item.ticker}</span>
                      <span aria-hidden> · </span>
                      <span className="tabular">{formatCap(item.market_cap, item.currency)}</span>
                    </span>
                    {shelf === ALL && <span className="shop-card-shelf">{shelfInfo(shelfOf(item)).title}</span>}
                    <span className="shop-card-act">{onStreet ? `✓ ${ON_STREET_LABEL}` : OPEN_STALL_LABEL}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        </div>
        </div>

        <div className="shop-foot">
          {results.length > visible.length && (
            <button type="button" className="sal-btn-ghost" onClick={() => setLimit((n) => n + PAGE)}>
              {SHOW_MORE_LABEL} ({results.length - visible.length})
            </button>
          )}
          <span className="shop-stocked">
            {stocked}
            {isDusty(catalogue.as_of, clock) && ` · ${DUSTY_LINE}`}
          </span>
          <button type="button" className="sal-link text-xs" onClick={onTypeInstead}>
            {TYPE_INSTEAD_LABEL}
          </button>
        </div>
      </div>
    </div>
  );
}
