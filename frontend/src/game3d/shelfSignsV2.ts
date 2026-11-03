/**
 * The tower library's shelf signs and shelf words (version 2, 2026-11-03), from the 3D text review, pass 3.
 * The flat Fortress shares the labels in lib/fortress.ts and keeps its neutral wording; 3D uses these instead.
 * One name per idea (the review's glossary): "why" (not thesis), "wire" (not tripwire), "in fog" (not not surveyed),
 * "low, middle, high case" (not bear, base, bull), "fortress test" (not stress scenario). Signs are 3 words or fewer.
 * Numbers stay exact. Backend-written reasons are passed through as they come (they wait for pass 4).
 */
import type { FortressFreshness, FortressLand, FortressSiegeExposure, FortressThesis } from "../lib/types";

export const SHELF_SIGNS_VERSION = "v2";

/** The sign on each shelf's plaque, and what "Press E to read" names. */
export const SHELF_SIGN = {
  walls: "The Walls",
  moat: "The Moat",
  land: "The Land",
  oath: "The Whys",
  treasury: "The Treasury",
  storm: "The Storm Drill",
  council: "The Council",
} as const;

/** The state chip on a shelf. */
export const SHELF_STATE_WORDS = { known: "", unknown: "In fog", na: "Doesn't apply" } as const;

export const FOG_LINE = {
  walls: "Walls in fog",
  moat: "Moat in fog",
  land: "Price in fog",
  oath: "No why checked yet",
  storm: "Storm not checked yet",
} as const;

export const NA_LINE = {
  walls: "No walls to judge",
  moat: "No moat to judge",
  oath: "No why applies",
} as const;

export const LAND_WORDS: Record<FortressLand, string> = {
  bargain: "Land for sale: below even the low case",
  discount: "On offer: below the middle case",
  full_price: "Fully priced: above the middle case",
  overpriced: "Dear: above the high case",
  fog: FOG_LINE.land,
};

export const WHY_WORDS: Record<FortressThesis, string> = {
  intact: "Your why still stands",
  review: "Something changed: read your why again",
  breached: "A wire rang",
  not_analyzed: FOG_LINE.oath,
  not_applicable: NA_LINE.oath,
};

export const STORM_WORDS: Record<FortressSiegeExposure, string> = {
  sheltered: "Sheltered when the storm hits",
  exposed: "Exposed when the storm hits",
  breach_risk: "Wall could break when the storm hits",
  unsurveyed: FOG_LINE.storm,
};

export const FRESH_WORDS: Record<FortressFreshness, string> = {
  fresh: "Figures are fresh",
  weathered: "Figures are ageing (ivy on the walls)",
  overgrown: "Old figures (overgrown)",
  unsurveyed: "Not checked yet (fog)",
  not_applicable: "No analysis applies",
};

/** Wall inputs in plain words: "Debt vs yearly profit: 1.40 times". Unknown keys fall back to the flat wording. */
const INPUT_LABEL: Record<string, string> = {
  ebitda: "Yearly profit before interest and tax",
  net_debt_to_ebitda: "Debt vs yearly profit",
  interest_coverage: "Times profit covers interest",
};

export function wallInputLine(key: string, value: string, flat: string): string {
  const label = INPUT_LABEL[key];
  const n = Number(value);
  if (!label || !Number.isFinite(n)) return flat;
  if (key.includes("_to_") || key.endsWith("coverage")) return `${label}: ${n.toFixed(2)} times`;
  return flat.replace(/^[^:]*:/, `${label}:`);
}

export const COUNCIL_WORDS = {
  asks: "What do the advisors say?",
  sample: "The advisors do not speak for the sample fortress.",
  failed: "Can't reach the Council right now.",
  waiting: "The Council is still thinking…",
  silent: "No advisor rule is about this holding. Silence is not \"all is well\".",
} as const;

/** One sentence for screen readers and the plaque hover. */
export function describeShelfWords(title: string, state: "known" | "unknown" | "na", first: string): string {
  if (state === "unknown") return `${title}: in fog`;
  if (state === "na") return `${title}: does not apply`;
  return `${title}: ${first}`;
}
