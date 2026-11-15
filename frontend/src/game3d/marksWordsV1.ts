/**
 * The marks' words (Morning Round step 2, #412). Game voice: short, plain, no verdict. Used by the Plain view only; the
 * marks in the world carry no text. No buy or sell words, no numbers, nothing that says "quiet" (that is step 3's, and
 * only when every source has been read).
 */
export const MARK_WORDS = {
  /** The label of the Plain row. */
  row: "Marks",
  raven: "Raven: new report",
  smoke: "Smoke: a wire fired",
  bell: "Bell: due a look",
  /** A source that did not report, or a holding that was never read: fog in words. */
  unread: "Not reported",
  /** Plain-view line for the watch post. */
  notice: "Notice: night changes pinned",
  /** Plain-view line for a lit stall. */
  lamp: "Lamp: in your range",
} as const;
