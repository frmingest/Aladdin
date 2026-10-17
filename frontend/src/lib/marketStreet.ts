import { hash32 } from "./marketArt";
import { shopFront, type ShopTone } from "./marketplace";
import { formatPct100, formatPrice } from "./format";
import type { WatchlistRow } from "./types";
import type { ObjectArtId } from "./stitchArt";

/**
 * Market Street (game mode, 2026-10-17): the watchlist as a street of stalls on a painted landscape.
 * Pure choices, no drawing and no maths on money:
 *  - which district a store stands in (a plain read of its stored status);
 *  - the flag it flies (a shape and a word per tone: colour is never the only signal);
 *  - which prop breaks the rhythm after every few stalls (decoration, never data);
 *  - the one-sentence name a screen reader hears.
 * Pictures carry no fact. The tone lives in the flag shape, the printed word and the plate edge.
 */

export type DistrictId = "range" | "near" | "above" | "fog";

export const DISTRICT_LABEL: Record<DistrictId, string> = {
  range: "In range",
  near: "Near your price",
  above: "Further off",
  fog: "The fog lane",
};

/** Unpriced stores (no price named, no price on file, different coin) stand in the fog lane: visible, tappable, never flattered. */
export function districtOf(row: WatchlistRow): DistrictId {
  switch (row.status) {
    case "buy_zone":
      return "range";
    case "near":
      return "near";
    case "above":
      return "above";
    default:
      return "fog";
  }
}

export interface DistrictRow {
  row: WatchlistRow;
  /** Place on the whole street (1-based), the same numeral the Plain view shows. */
  place: number;
}

export interface District {
  id: DistrictId;
  label: string;
  rows: DistrictRow[];
}

/** Splits an already street-ordered list into its districts, in street order; empty districts are left out. */
export function streetDistricts(ordered: WatchlistRow[]): District[] {
  const order: DistrictId[] = ["range", "near", "above", "fog"];
  return order
    .map((id) => ({
      id,
      label: DISTRICT_LABEL[id],
      rows: ordered.flatMap((row, i) => (districtOf(row) === id ? [{ row, place: i + 1 }] : [])),
    }))
    .filter((d) => d.rows.length > 0);
}

export type FlagShape = "swallowtail" | "pointed" | "blunt" | "ring";

/** A shape and a short word per tone. Shapes: swallowtail with a tick, pointed with a bar, blunt with an up chevron, a bare dashed ring. */
export const TONE_FLAG: Record<ShopTone, { shape: FlagShape; word: string }> = {
  gold: { shape: "swallowtail", word: "In range" },
  amber: { shape: "pointed", word: "Near" },
  plain: { shape: "blunt", word: "Above" },
  mist: { shape: "ring", word: "No price" },
};

/** The signed gap to the price you named, as the Plain view prints it ("+4%", "3%"), or null when there is none. */
export function gapLabel(row: WatchlistRow): string | null {
  if (row.distance_to_buy_pct === null) return null;
  const d = Number(row.distance_to_buy_pct);
  if (!Number.isFinite(d)) return null;
  return `${d > 0 ? "+" : ""}${formatPct100(String(d), 0)}`;
}

/** What a screen reader hears for a stall: the whole fact in one sentence. The picture is silent. */
export function stallLabel(row: WatchlistRow): string {
  const front = shopFront(row);
  const gap = gapLabel(row);
  const price = row.price ? `Price ${formatPrice(row.price, row.price_currency)}.` : "No price on file.";
  const yours = row.buy_below_price ? ` Your price ${formatPrice(row.buy_below_price, row.buy_below_currency)}.` : "";
  return [
    `${row.name}, ${row.ticker}.`,
    `${front.tag}${gap ? `, ${gap} versus yours` : ""}.`,
    `${price}${yours}`,
    row.owned ? " In your fortress." : "",
    " Step inside.",
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Props that break the rhythm of the street, in the order they appear. */
export const STREET_DECOR = ["market-lamp", "market-tree", "market-crates", "market-bench", "market-handcart", "market-fence"] as const satisfies readonly ObjectArtId[];

/** A prop stands after every this many stalls inside a district. */
export const BLOCK = 5;

/** The prop for the n-th gap (0-based), cycling. */
export function decorId(n: number): (typeof STREET_DECOR)[number] {
  return STREET_DECOR[((n % STREET_DECOR.length) + STREET_DECOR.length) % STREET_DECOR.length]!;
}

/** Where props go in a list of `count` stalls: the stall index each prop comes before (BLOCK, 2*BLOCK, ...). */
export function decorSlots(count: number): number[] {
  const out: number[] = [];
  for (let i = BLOCK; i < count; i += BLOCK) out.push(i);
  return out;
}

/** A small stable offset in px (-5 to 5) so a row of stalls does not stand like soldiers. Decoration, from the id. */
export function jitterPx(holdingId: string): number {
  return (hash32(`jitter:${holdingId}`) % 11) - 5;
}
