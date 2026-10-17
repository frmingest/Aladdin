import { hash32 } from "./marketArt";
import { analysisAgeDays, MARKET_RULES, shopFront, type ShopTone } from "./marketplace";
import { formatPct100, formatPrice } from "./format";
import type { WatchlistRow } from "./types";
import type { ObjectArtId } from "./stitchArt";

/**
 * Market Street (game mode, 2026-10-17): the watchlist as a street of stalls on a painted landscape.
 * Pure choices, no drawing and no maths on money:
 *  - which district a store stands in (a plain read of its stored status);
 *  - the flag it flies (a shape and a word per tone: colour is never the only signal);
 *  - where each stall stands along the lane, and which fixed prop fills an empty plot (decoration, never data);
 *  - the one-sentence name a screen reader hears.
 * Pictures carry no fact. The tone lives in the flag shape, the printed word and the plate edge.
 */

export type DistrictId = "range" | "near" | "above" | "fog";

export const DISTRICT_LABEL: Record<DistrictId, string> = {
  range: "In range",
  near: "Near",
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

/** The money line the stall's tooltip carries (off the plate face): "USD 930.00 · yours USD 850.00". Display formatting only. */
export function priceLine(row: WatchlistRow): string {
  const price = row.price ? formatPrice(row.price, row.price_currency) : "No price";
  const yours = row.buy_below_price ? formatPrice(row.buy_below_price, row.buy_below_currency) : "not named";
  return `${price} · yours ${yours}`;
}

/** What a screen reader hears for a stall: the whole fact in one sentence. The picture is silent. */
export function stallLabel(row: WatchlistRow, now: number = Date.now()): string {
  const front = shopFront(row);
  const gap = gapLabel(row);
  const price = row.price ? `Price ${formatPrice(row.price, row.price_currency)}.` : "No price on file.";
  const yours = row.buy_below_price ? ` Your price ${formatPrice(row.buy_below_price, row.buy_below_currency)}.` : "";
  return [
    `${row.name}, ${row.ticker}.`,
    `${front.tag}${gap ? `, ${gap} versus yours` : ""}.`,
    `${price}${yours}`,
    row.owned ? " In your fortress." : "",
    topMarkText(row, now),
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The four fixed filler props, one per district index (cycled). Decoration only: never a stall-like picture. */
export const FILLER_PROPS = ["market-crates", "market-bench", "market-handcart", "market-tree"] as const satisfies readonly ObjectArtId[];
export type PropId = (typeof FILLER_PROPS)[number];

/** The filler for the n-th district (0-based), cycling. */
export function fillerFor(districtIndex: number): PropId {
  return FILLER_PROPS[((districtIndex % FILLER_PROPS.length) + FILLER_PROPS.length) % FILLER_PROPS.length]!;
}

/** Plots per side of the lane (1 to 3). A small street stays narrow; a long one widens on wider screens: 2 on tablets, 3 on desktops. */
export const SMALL_STREET = 6;

export type Slot = { kind: "stall"; row: WatchlistRow; place: number } | { kind: "prop"; id: PropId } | { kind: "ground" };

export interface LaneRow {
  districtId: DistrictId;
  label: string;
  /** Stalls in the whole district (the signpost prints it). */
  count: number;
  /** District index among the districts that exist (0-based), for the signpost and the filler cycle. */
  districtIndex: number;
  /** First row of its district: the cross-street, the sign and the lamps sit above it. */
  first: boolean;
  /** Length perSide, index 0 = the plot next to the lane. */
  left: Slot[];
  right: Slot[];
}

export interface LanePlan {
  perSide: 1 | 2 | 3;
  rows: LaneRow[];
}

/**
 * Lays the districts out along a lane with plots on both sides. Pure and deterministic.
 *  - Fill order inside a district: left-inner, right-inner, left-outer, right-outer, then the next row
 *    (the sides swap when the district starts on the right), so place numbers rise in this order.
 *  - A district starts a new row, on the side opposite the previous district's last stall.
 *  - In the last row of a district an empty inner plot gets the district's filler prop; an empty outer plot stays ground.
 * The stalls keep their `place` from the street order; nothing here reorders them.
 */
export type LaneWidth = "wide" | "medium" | "narrow";

export function lanePlots(districts: District[], width: LaneWidth): LanePlan {
  const total = districts.reduce((n, d) => n + d.rows.length, 0);
  const perSide: 1 | 2 | 3 = total <= SMALL_STREET ? 1 : width === "wide" ? 3 : width === "medium" ? 2 : 1;
  const cap = perSide * 2;
  const rows: LaneRow[] = [];
  let nextFirst: "left" | "right" = "left";
  districts.forEach((d, districtIndex) => {
    let lastSide: "left" | "right" = nextFirst;
    for (let start = 0; start < d.rows.length; start += cap) {
      const chunk = d.rows.slice(start, start + cap);
      const left: Slot[] = Array.from({ length: perSide }, () => ({ kind: "ground" }) as Slot);
      const right: Slot[] = Array.from({ length: perSide }, () => ({ kind: "ground" }) as Slot);
      const sides = nextFirst === "left" ? [left, right] : [right, left];
      const names = nextFirst === "left" ? (["left", "right"] as const) : (["right", "left"] as const);
      chunk.forEach((r, i) => {
        // order: first-side inner, other inner, first-side outer, other outer
        const sideIdx = i % 2;
        const depth = Math.floor(i / 2);
        sides[sideIdx]![depth] = { kind: "stall", row: r.row, place: r.place };
        lastSide = names[sideIdx]!;
      });
      if (start + cap >= d.rows.length) {
        const prop: Slot = { kind: "prop", id: fillerFor(districtIndex) };
        let placed = false;
        for (const side of sides) {
          if (side[0]!.kind === "ground" && !placed) {
            side[0] = prop;
            placed = true;
          }
        }
      }
      rows.push({ districtId: d.id, label: d.label, count: d.rows.length, districtIndex, first: start === 0, left, right });
    }
    // The next district starts on the side opposite this district's last stall.
    nextFirst = lastSide === "left" ? "right" : "left";
  });
  return { perSide, rows };
}

/** A small stable offset in px (-5 to 5) so a row of stalls does not stand like soldiers. Decoration, from the id. */
export function jitterPx(holdingId: string): number {
  return (hash32(`jitter:${holdingId}`) % 11) - 5;
}

/** Which stall's card is open: at most one. Press a stall to open it, press it again, press Escape or open another to close. */
export type OpenAction = { type: "toggle"; id: string } | { type: "close" };
export function openReducer(open: string | null, action: OpenAction): string | null {
  if (action.type === "close") return null;
  return open === action.id ? null : action.id;
}

/**
 * The analyst's top mark on a stall: the stored rating "Strong Buy" (and only that), shown as a seal with the printed
 * words "Top mark" / "Old mark". The street never prints the verdict word itself. Pure; no money maths.
 *  - null: not a Strong Buy (nothing is drawn, nothing is faked).
 *  - "old": no date, or older than the stale cut-off: dashed seal, "Old mark", no frame, no motion. Beats the fog (truth over flattery).
 *  - "fogged": unpriced stall: static seal under the mist, no frame, no motion.
 *  - "ageing": 91-180 days: seal and frame, still.
 *  - "fresh": up to 90 days: seal and frame; may animate (see animatedMarks).
 */
export type TopMark = "fresh" | "ageing" | "old" | "fogged";

export function topMark(row: WatchlistRow, now: number = Date.now()): TopMark | null {
  if (row.verdict_rating !== "Strong Buy") return null;
  const age = analysisAgeDays(null, row.analyzed_at, now);
  if (age === null || age > MARKET_RULES.analysisStaleDays) return "old";
  if (districtOf(row) === "fog") return "fogged";
  return age > MARKET_RULES.analysisFreshDays ? "ageing" : "fresh";
}

/** The printed word on the seal's ribbon. */
export const TOP_MARK_WORD: Record<TopMark, string> = { fresh: "Top mark", ageing: "Top mark", fogged: "Top mark", old: "Old mark" };

/** At most this many stalls animate on a visit: the first fresh marks in street order. */
export const MARK_ANIMATION_CAP = 3;
/** Gap between entrances when several enter view together. */
export const MARK_STAGGER_MS = 400;

/** Row ids of the stalls that may play the entrance: the first MARK_ANIMATION_CAP fresh marks, in street order. */
export function animatedMarks(ordered: WatchlistRow[], now: number = Date.now()): Set<string> {
  const out = new Set<string>();
  for (const row of ordered) {
    if (out.size >= MARK_ANIMATION_CAP) break;
    if (topMark(row, now) === "fresh") out.add(row.id);
  }
  return out;
}

/** Entrance delays for stalls that enter view in the same moment: by place, MARK_STAGGER_MS apart. */
export function staggerDelays(places: number[]): Map<number, number> {
  return new Map([...places].sort((a, b) => a - b).map((p, i) => [p, i * MARK_STAGGER_MS]));
}

/** The seal's tooltip: the analyst's word and its age, or a plain admission that the date is unknown. */
export function topMarkTitle(row: WatchlistRow, now: number = Date.now()): string | null {
  if (topMark(row, now) === null) return null;
  const age = analysisAgeDays(null, row.analyzed_at, now);
  if (age === null) return "The analyst's top word. Date unknown.";
  const ago = age === 1 ? "1 day ago" : `${age} days ago`;
  return age > MARKET_RULES.analysisStaleDays ? `The analyst's top word, ${ago}. Old: re-read first.` : `The analyst's top word, ${ago}.`;
}

/** What a screen reader hears for the mark (appended to the stall's sentence); empty when there is none. */
export function topMarkText(row: WatchlistRow, now: number = Date.now()): string {
  if (topMark(row, now) === null) return "";
  const age = analysisAgeDays(null, row.analyzed_at, now);
  if (age === null) return "Analyst's top mark, date unknown.";
  const old = age > MARKET_RULES.analysisStaleDays ? ": old" : "";
  return `Analyst's top mark, ${age === 1 ? "1 day" : `${age} days`} old${old}.`;
}
