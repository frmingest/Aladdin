import type { ShopTone } from "../lib/marketplace";

/**
 * The words on a market stall's plate in 3D (text pass 4e, version 1, 2026-11-09). Game voice: a short word for how
 * the price sits against the one you named, then the gap as "4% over" or "3% under" (the sign said in words, the
 * number exact). The flat Marketplace keeps its own words ("In range", "Near", "Above"); a stall's tone, its flag
 * and the gap all still come from the same price data, so both pages tell the same story. A change to any wording
 * that could be shown for real is a NEW version file, never an edit of this one.
 */
export const STALL_PLATE_WORDS_VERSION = "v1";

export const STALL_PLATE_TONE_WORD: Record<ShopTone, string> = {
  gold: "In reach",
  amber: "Close",
  plain: "Too high",
  mist: "No price",
};

/** Characters that fit across the plate before the name is cut. */
export const STALL_PLATE_NAME_CHARS = 18;

/** The flat page's signed gap ("+4%", "-3%", "0%") said in words, or null when there is no gap. The number is untouched. */
export function gapInWords(gap: string | null): string | null {
  if (!gap) return null;
  const t = gap.trim();
  if (t.startsWith("+")) return `${t.slice(1)} over`;
  if (t.startsWith("-") || t.startsWith("−")) return `${t.slice(1)} under`;
  return /^0(?:\.0+)?%$/.test(t) ? "On the mark" : `${t} over`;
}

/** What the plate says: the company name (cut to fit) and a line "Close · 4% over". Unpriced stays "No price" alone: unknown never gets a number. */
export function stallPlateWords(stall: { name: string; tone: ShopTone; gap: string | null }): { name: string; line: string } {
  const n = stall.name.trim();
  const name = n.length <= STALL_PLATE_NAME_CHARS ? n : n.slice(0, STALL_PLATE_NAME_CHARS - 1).trimEnd() + "…";
  const word = STALL_PLATE_TONE_WORD[stall.tone];
  const gap = stall.tone === "mist" ? null : gapInWords(stall.gap);
  return { name, line: gap ? `${word} · ${gap}` : word };
}
