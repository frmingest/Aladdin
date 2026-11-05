/**
 * The Market Quarter: the words (version 1, 2026-11-04). Game voice: short, plain, for the player's act. The words about a
 * stall ("In range", "No price", the signed gap) come from the flat Marketplace's own helpers, never from here. A change to
 * any wording that could be shown for real is a NEW version file (quarterWordsV2.ts), never an edit of this one.
 */
export const QUARTER_WORDS_VERSION = "v1";

export const QUARTER_WORDS = {
  /** The name plate on arrival. */
  plate: "The Market Quarter",
  /** The plain name, for the page title. */
  title: "Market Quarter",
  /** Over the arch in the courtyard. */
  gateLabel: "Market Quarter",
  gatePrompt: "Press E to stroll into the Market Quarter",
  exitPrompt: "Press E to head back",
  /** On the sign where the lane starts. */
  laneSign: "Closest to your price first.",
  /** Over the quiet stretch at the far end, where stalls with no price stand. */
  fogTitle: "No price yet",
} as const;

/**
 * The line under the arch's name. Null while the watchlist is unread (`counts` null), so a street that failed to load never
 * claims to be empty. With no stalls it says so; otherwise the count and how many are in range, in the flat page's own word.
 */
export function archLine(counts: { total: number; inRange: number } | null): string | null {
  if (counts === null) return null;
  if (counts.total === 0) return "No stalls yet";
  const n = counts.total;
  return `${n} ${n === 1 ? "stall" : "stalls"}, ${counts.inRange} in range`;
}
