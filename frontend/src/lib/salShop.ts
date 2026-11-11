/**
 * Sal's shop: the shelves of Oslo companies you pick a stall from instead of typing a ticker (2026-11-11).
 *
 * Pure and tested. The list comes from the backend catalogue (GET /catalogue, stocked by the PC worker from
 * Yahoo); this file only groups, filters, searches and words it. Nothing here ranks companies by merit: the
 * order is size, which is a fact about the company, and "size in fog" stays fog (unknown is never rounded).
 * Sal's lines follow the game voice: short, playful, no advice (a test forbids buy/sell/invest wording).
 */
import type { CatalogueItem, CatalogueSizeBand, WatchlistRow } from "./types";

export const ALL = "all";
export const OTHER = "other";

export interface ShelfInfo {
  key: string;
  /** The game name, big on the chip. */
  title: string;
  /** The real sector, small underneath, so the joke never hides the meaning. */
  real: string;
}

/** Shelf order is fixed so the shop is learnable: it is not a ranking. */
const SHELF_TABLE: ShelfInfo[] = [
  { key: "Energy", title: "Oil & Power", real: "Energy" },
  { key: "Financials", title: "Banks & Coin", real: "Financials" },
  { key: "Industrials", title: "Ships & Workshops", real: "Industrials" },
  { key: "Consumer Staples", title: "Food & Fish", real: "Consumer staples" },
  { key: "Materials", title: "Metals & Earth", real: "Materials" },
  { key: "Information Technology", title: "Gadgets & Code", real: "Technology" },
  { key: "Consumer Discretionary", title: "Shops & Wheels", real: "Consumer discretionary" },
  { key: "Health Care", title: "Healers", real: "Health care" },
  { key: "Communication Services", title: "Wires & Waves", real: "Communication" },
  { key: "Utilities", title: "Water & Wind", real: "Utilities" },
  { key: "Real Estate", title: "Land & Roofs", real: "Real estate" },
  { key: OTHER, title: "Odds & Ends", real: "Not sorted yet" },
];

const ALL_SHELF: ShelfInfo = { key: ALL, title: "Everything", real: "All shelves" };

export const SIZE_LABEL: Record<CatalogueSizeBand, string> = {
  giant: "Giants",
  big: "Big",
  small: "Small",
  tiny: "Tiny",
  unknown: "Size in fog",
};

/** Filter chips: every band except fog (fog shows under "Any size"). */
export const SIZE_FILTERS: CatalogueSizeBand[] = ["giant", "big", "small", "tiny"];

/** What the bands mean, in plain words (market value in NOK). Mirrors backend/app/domain/ticker_catalogue.py. */
export const SIZE_HINT: Record<CatalogueSizeBand, string> = {
  giant: "Worth over 50 bn NOK",
  big: "Worth 10 to 50 bn NOK",
  small: "Worth 1 to 10 bn NOK",
  tiny: "Worth under 1 bn NOK",
  unknown: "No size on file yet",
};

/** Coins stacked on a card: the size, drawn. Fog gets none. */
export function coinCount(band: CatalogueSizeBand): number {
  return { giant: 4, big: 3, small: 2, tiny: 1, unknown: 0 }[band];
}

export function shelfOf(item: CatalogueItem): string {
  return SHELF_TABLE.some((s) => s.key === item.sector) ? (item.sector as string) : OTHER;
}

export function shelfInfo(key: string): ShelfInfo {
  return SHELF_TABLE.find((s) => s.key === key) ?? ALL_SHELF;
}

export interface ShelfCount extends ShelfInfo {
  count: number;
}

/** "Everything" first, then each shelf that has at least one company, in the fixed order. */
export function shelfCounts(items: CatalogueItem[]): ShelfCount[] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(shelfOf(item), (counts.get(shelfOf(item)) ?? 0) + 1);
  return [{ ...ALL_SHELF, count: items.length }, ...SHELF_TABLE.filter((s) => (counts.get(s.key) ?? 0) > 0).map((s) => ({ ...s, count: counts.get(s.key) ?? 0 }))];
}

/** Lower-case, no accents, and the Norwegian letters folded (ø and æ do not decompose on their own). */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9. ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface ShopFilter {
  shelf: string;
  /** null = any size. */
  band: CatalogueSizeBand | null;
  query: string;
}

/** Every word typed must appear in the name or the ticker. Prefix matches float up; otherwise the size order stays. */
export function filterCatalogue(items: CatalogueItem[], f: ShopFilter): CatalogueItem[] {
  const words = fold(f.query).split(" ").filter(Boolean);
  const scored: { item: CatalogueItem; rank: number; at: number }[] = [];
  items.forEach((item, at) => {
    if (f.shelf !== ALL && shelfOf(item) !== f.shelf) return;
    if (f.band !== null && item.size_band !== f.band) return;
    let rank = 3;
    if (words.length > 0) {
      const name = fold(item.name);
      const ticker = fold(item.ticker);
      const root = ticker.replace(/\.ol$/, "");
      if (!words.every((w) => name.includes(w) || ticker.includes(w))) return;
      const first = words[0];
      rank = root === first || ticker === first ? 0 : root.startsWith(first) ? 1 : name.startsWith(first) ? 2 : 3;
    }
    scored.push({ item, rank, at });
  });
  if (words.length > 0) scored.sort((a, b) => a.rank - b.rank || a.at - b.at);
  return scored.map((s) => s.item);
}

/** Tickers that already have a stall, upper case. */
export function takenTickers(rows: Pick<WatchlistRow, "ticker">[]): Set<string> {
  return new Set(rows.map((r) => r.ticker.toUpperCase()));
}

/** What the stall needs, from a picked shelf item. The sector rides along so the Map and sector pages know it. */
export function stallInput(item: CatalogueItem): { ticker: string; name: string; currency: string; sector: string | null } {
  return { ticker: item.ticker.toUpperCase(), name: item.name, currency: item.currency.toUpperCase(), sector: item.sector };
}

/** "712 bn", "8.4 bn", "420 m"; null is fog. Non-NOK values carry their currency so nothing is misread. */
export function formatCap(cap: string | null, currency: string): string {
  if (cap === null) return "size in fog";
  const n = Number(cap);
  if (!Number.isFinite(n) || n <= 0) return "size in fog";
  const unit = (v: number, suffix: string) => `${v >= 100 ? Math.round(v) : Math.round(v * 10) / 10} ${suffix}`;
  const body = n >= 1e12 ? unit(n / 1e12, "tn") : n >= 1e9 ? unit(n / 1e9, "bn") : n >= 1e6 ? unit(n / 1e6, "m") : String(Math.round(n));
  return currency.toUpperCase() === "NOK" ? body : `${currency.toUpperCase()} ${body}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Sal's words for the shop. Short, playful, and never about what to do with money.

const pick = <T>(list: T[], seed: number): T => list[Math.abs(seed) % list.length];

export const SHOP_INTRO_LINES = [
  "Fresh stock off the Oslo boat! Pick a shelf, tap a stall, I'll do the hammering!",
  "No typing today! Every Oslo company is on a shelf. Tap one and it's yours to watch.",
  "Step right up! Shelves are stocked. Pick one and I'll nail up the sign!",
];
export const shopIntroLine = (seed: number): string => pick(SHOP_INTRO_LINES, seed);

export const SHELVES_EMPTY_LINE = "The shelves are still bare! Your PC stocks them in the background. Type a ticker for now.";
export const STOCKING_LINE = "Stocking the shelves…";
export const SHELVES_ERROR_LINE = "Can't reach the shelves right now. Type a ticker for now.";
export const NO_MATCH_LINE = "Nothing on this shelf matches. Try another word, size or shelf.";
export const ON_STREET_LABEL = "On your street";
export const OPEN_STALL_LABEL = "Open the stall";
export const TYPE_INSTEAD_LABEL = "Not on the shelves? Type a ticker";
export const BACK_TO_SHELVES_LABEL = "Back to the shelves";
export const SHOW_MORE_LABEL = "Show more";
export const SEARCH_PLACEHOLDER = "Search a name or ticker";

const DAY = 86_400_000;

/** When the shelves were last stocked, in plain words. null when unknown. */
export function stockedLine(asOf: string | null, now: number = Date.now()): string | null {
  if (!asOf) return null;
  const t = Date.parse(asOf);
  if (!Number.isFinite(t)) return null;
  const days = Math.floor((now - t) / DAY);
  if (days <= 0) return "Stocked today";
  if (days === 1) return "Stocked yesterday";
  return `Stocked ${days} days ago`;
}

/** A shelf this old is probably dusty: say so, kindly. */
export const DUSTY_AFTER_DAYS = 21;
export const DUSTY_LINE = "A bit dusty. Your PC restocks the shelves when it can.";

export function isDusty(asOf: string | null, now: number = Date.now()): boolean {
  if (!asOf) return false;
  const t = Date.parse(asOf);
  return Number.isFinite(t) && now - t > DUSTY_AFTER_DAYS * DAY;
}

export function countLine(shown: number, total: number): string {
  return shown === total ? `${total} ${total === 1 ? "stall" : "stalls"}` : `${shown} of ${total} stalls`;
}

/** Everything the shop says in words, for the wording test. */
export function allShopLines(): string[] {
  return [
    ...SHOP_INTRO_LINES,
    SHELVES_EMPTY_LINE,
    SHELVES_ERROR_LINE,
    STOCKING_LINE,
    NO_MATCH_LINE,
    ON_STREET_LABEL,
    OPEN_STALL_LABEL,
    TYPE_INSTEAD_LABEL,
    BACK_TO_SHELVES_LABEL,
    SHOW_MORE_LABEL,
    DUSTY_LINE,
    ...Object.values(SIZE_LABEL),
    ...Object.values(SIZE_HINT),
    ...SHELF_TABLE.flatMap((s) => [s.title, s.real]),
    stockedLine(new Date().toISOString()) ?? "",
    countLine(3, 9),
  ];
}
