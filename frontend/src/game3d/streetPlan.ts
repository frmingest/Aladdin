/**
 * Market Street in 3D (sprint S14, steps M1 and M2). Pure data and maths, no three.js and no React.
 *
 * One stall per watchlist company, in the same street order as the flat Marketplace page (in range first,
 * then nearest to the price you named, then by name). The stalls stand on a few fixed plots on the
 * south-east ground, between the gate road and the old marketplace corner. More companies than plots are
 * not drawn: the panel lists them ("the N stalls with no stand here").
 *
 * Nothing here is a fact the 3D world makes up. A stall's tone and its words come from `shopFront`, the same
 * function the flat page uses, and the stall model is picked from the company id alone (stable, no data).
 * Colour never carries the meaning alone: the pennant's SHAPE says it too (two flags, one long flag,
 * one short flag, none). No red and no green anywhere.
 */
import { orderStreet, shopFront } from "../lib/marketplace";
import type { ShopTone } from "../lib/marketplace";
import { TONE_FLAG, gapLabel } from "../lib/marketStreet";
import type { FlagShape } from "../lib/marketStreet";
import type { WatchlistRow } from "../lib/types";
import { yawToward } from "./npcs";

/** The fixed plots, in the order stalls are given out. Each clears every prop, person, tower and corner piece (test). */
export const STREET_PLOTS: readonly { x: number; z: number }[] = [
  { x: 16.9, z: 41.7 },
  { x: 21.1, z: 39.7 },
  { x: 25.2, z: 37.3 },
  { x: 28.9, z: 34.5 },
  { x: 19.5, z: 33.8 },
  { x: 22.9, z: 31.6 },
  { x: 32.9, z: 30.7 },
];

/** The most stalls that can stand. */
export const MAX_STALLS = STREET_PLOTS.length;

/** Half the footprint of a stall you walk round (an awning stall is about 2.5 wide when drawn). */
export const STALL_SOLID = { hx: 1.3, hz: 1.1 } as const;

export type StallModel = "stall_awning_blue" | "stall_awning_teal";
export const STALL_MODELS: readonly StallModel[] = ["stall_awning_blue", "stall_awning_teal"];

/** Which pennant shape a tone gets. Shape, not colour, is what tells tones apart. */
export type PennantShape = "double" | "long" | "short" | "none";
export const PENNANT_SHAPE: Record<ShopTone, PennantShape> = {
  gold: "double",
  amber: "long",
  plain: "short",
  mist: "none",
};

/** Pennant colours (never red or green). */
export const PENNANT_COLOUR: Record<ShopTone, string> = {
  gold: "#e6b93a",
  amber: "#e08a2c",
  plain: "#eee4d3",
  mist: "#9aa0b3",
};

export interface Stall {
  holdingId: string;
  name: string;
  ticker: string;
  x: number;
  z: number;
  yaw: number;
  model: StallModel;
  tone: ShopTone;
  pennant: PennantShape;
  /** The printed words, straight from the flat page's price tag ("In your price range", ...). */
  tag: string;
  /** The flat Marketplace's own flag shape and short word for this tone (`TONE_FLAG`), so both pages say the same thing. */
  flag: FlagShape;
  word: string;
  /** The signed gap to your price as the flat page prints it ("+4%"), or null. */
  gap: string | null;
  /** No price named or no price on file: the stall still stands, with a bare pole. */
  unpriced: boolean;
}

export interface Street {
  stalls: Stall[];
  /** Companies with no plot: listed in the panel, not drawn. */
  overflow: Stall[];
}

/** A small stable hash of an id, so the same company always gets the same stall model. */
export function stableIndex(id: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % mod;
}

function toStall(row: WatchlistRow, plot: { x: number; z: number }): Stall {
  const front = shopFront(row);
  return {
    holdingId: row.holding_id,
    name: row.name,
    ticker: row.ticker,
    x: plot.x,
    z: plot.z,
    // Fronts face the middle of the courtyard, like the people do.
    yaw: yawToward(plot, { x: 0, z: 0 }),
    model: STALL_MODELS[stableIndex(row.holding_id, STALL_MODELS.length)],
    tone: front.tone,
    pennant: PENNANT_SHAPE[front.tone],
    tag: front.tag,
    flag: TONE_FLAG[front.tone].shape,
    word: TONE_FLAG[front.tone].word,
    gap: gapLabel(row),
    unpriced: front.tone === "mist",
  };
}

/** The street for a watchlist: ordered like the flat page, one stall per company, as many as there are plots. */
export function buildStreet(rows: readonly WatchlistRow[] | null | undefined): Street {
  const ordered = orderStreet([...(rows ?? [])]);
  const stalls = ordered.slice(0, MAX_STALLS).map((r, i) => toStall(r, STREET_PLOTS[i]));
  // Overflow keeps the street order; it has no plot, so it sits at the origin and is never drawn.
  const overflow = ordered.slice(MAX_STALLS).map((r) => toStall(r, { x: 0, z: 0 }));
  return { stalls, overflow };
}

/** Words for the little prompt and the overflow line. Short and playful. */
export const STREET_EMPTY = "No stalls yet. Add a company to your watchlist.";
export const streetOverflowLine = (n: number): string => `${n} more ${n === 1 ? "stall has" : "stalls have"} no stand here. Open the Marketplace to see them.`;

/** What the little plate under a stall says: the company name (cut to fit) and the flat page's short word plus the signed gap. */
export const PLATE_NAME_CHARS = 18;
export function plateWords(stall: Pick<Stall, "name" | "word" | "gap">): { name: string; line: string } {
  const n = stall.name.trim();
  const name = n.length <= PLATE_NAME_CHARS ? n : n.slice(0, PLATE_NAME_CHARS - 1).trimEnd() + "…";
  return { name, line: stall.gap ? `${stall.word} · ${stall.gap}` : stall.word };
}
