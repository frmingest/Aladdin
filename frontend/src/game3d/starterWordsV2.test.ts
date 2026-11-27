import { describe, expect, it } from "vitest";
import { STARTER_WORDS as V1, bookStrings as bookStringsV1 } from "./starterWordsV1";
import { STARTER_WORDS, bookStrings } from "./starterWordsV2";

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const sentences = (s: string) => s.split(/(?<=[.!?…])\s+/).filter(Boolean);
/** The same banned words as the V1 test: no buy, sell, hold or trade wording, and no "ride it out". */
const BANNED_RE = /\b(stay|run|ride|ride out|weather it|keep it|cost|costs)\b|\b(hold|sell|sold|buy|bought|pay|paid|trade)\w*/i;

describe("starter words v2 (#530): the Storms page names Mr. Market", () => {
  it("the Storms page's grown-up word is Mr. Market, not bear market", () => {
    expect(STARTER_WORDS.book.pages.storms.grownUp).toBe("Grown-ups call the moody price Mr. Market.");
    expect(bookStrings().join(" ")).not.toMatch(/bear market/i);
  });

  it("nothing else changed: every other string is V1's, and V1 is as it was", () => {
    expect(V1.book.pages.storms.grownUp).toBe("Grown-ups call a fall this big a bear market.");
    const { book, ...rest } = STARTER_WORDS;
    const { book: bookV1, ...restV1 } = V1;
    expect(rest).toEqual(restV1);
    const { pages, ...bookRest } = book;
    const { pages: pagesV1, ...bookRestV1 } = bookV1;
    expect(bookRest).toEqual(bookRestV1);
    for (const id of ["walls", "moat", "room", "why"] as const) expect(pages[id]).toEqual(pagesV1[id]);
    expect({ ...pages.storms, grownUp: undefined }).toEqual({ ...pagesV1.storms, grownUp: undefined });
    // The Book's strings differ by exactly that one line.
    const added = bookStrings().filter((s) => !bookStringsV1().includes(s));
    expect(added).toEqual(["Grown-ups call the moody price Mr. Market."]);
  });

  it("every Book line still fits one breath, counts nothing, and has no buy or sell wording", () => {
    for (const s of bookStrings()) {
      for (const sentence of sentences(s)) expect(words(sentence), sentence).toBeLessThan(12);
      expect(s).not.toMatch(/\d+\s*of\s*\d+|\d+\/\d+/);
      expect(BANNED_RE.test(s.replace(/\bpays its debt\b/gi, "")), s).toBe(false);
    }
  });
});
