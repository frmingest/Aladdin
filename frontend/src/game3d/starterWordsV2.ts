/**
 * The starter level's words, version 2 (2026-11-27, #530). V1 (`starterWordsV1.ts`) was merged in PR #529 and its wording
 * shown to Faiz, so this is a new file, not an edit (CLAUDE.md rule 3). V1 stays as it was.
 *
 * What changed from V1, nothing else: the Book of Wisdom's Storms page names its grown-up word as "Mr. Market" (Graham's
 * name for the moody price, the idea Buffett quotes), not "bear market". "Bear market" named the size of a fall, which is
 * market-timing talk; "Mr. Market" names the lesson itself: the price swings, the business does not (Faiz, 2026-11-27).
 *
 * Every other string is V1's, taken from it, not copied. The grown-up line is not on any card face or in the 35-word cap
 * (only the Book shows it), so V1's `allStarterStrings`, `plainStrings` and `screensOfBeats` hold for V2 unchanged.
 */
import { STARTER_WORDS as V1 } from "./starterWordsV1";
import type { BookPage } from "./starterWordsV1";

export { SPEAKERS, allStarterStrings, plainStrings, screensOfBeats } from "./starterWordsV1";
export type { BookPage, Line, SpeakerId } from "./starterWordsV1";

export const STARTER_WORDS_VERSION = "v2";

export const STARTER_WORDS = {
  ...V1,
  book: {
    ...V1.book,
    pages: {
      ...V1.book.pages,
      storms: { ...V1.book.pages.storms, grownUp: "Grown-ups call the moody price Mr. Market." },
    } as Record<"walls" | "moat" | "room" | "storms" | "why", BookPage>,
  },
} as const;

/** Every string the Book can show, grown-up lines included (for the count-pattern and voice tests). */
export function bookStrings(): string[] {
  const b = STARTER_WORDS.book;
  const pages = Object.values(b.pages).flatMap((p) => [p.title, ...(p.lines ?? []), p.fact, p.grownUp, p.real].filter((s): s is string => !!s));
  return [b.title, b.prompt, b.close, ...b.cover, b.locked, b.learned, b.blocked, b.held, b.earnLater, b.questLead, b.questOpen, ...Object.values(b.pages).map((p) => b.newPage(p.title)), ...pages];
}
