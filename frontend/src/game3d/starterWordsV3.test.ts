import { describe, expect, it } from "vitest";
import { STARTER_WORDS as V2 } from "./starterWordsV2";
import { STARTER_WORDS, STARTER_WORDS_VERSION, allStarterStrings, bookStrings, plainStrings, screensOfBeats } from "./starterWordsV3";

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const sentences = (s: string) => s.split(/(?<=[.!?…])\s+/).filter(Boolean);
/** The V1 test's banned words: no buy, sell, hold, pay or trade wording (any ending), and no "ride it out". */
const BANNED_RE = /\b(stay|run|ride|ride out|weather it|keep it|cost|costs)\b|\b(hold|sell|sold|buy|bought|pay|paid|trade)\w*/i;
const BANNED = { test: (s: string) => BANNED_RE.test(s.replace(/\bpays its debt\b/gi, "")) };
/** Grown-up words live only in a Book page's grown-up line and the Plain view, never on a card face. */
const GROWN_UP = /net debt|ebitda|bear case|bull case|base case|margin of safety|valuation|dividend|p\/e|mr\.? market|bear market/i;

describe("starter words v3 (#496): game voice over every string, the new ones included", () => {
  it("is version v3, and the helpers read V3's own words (the new strings are in them)", () => {
    expect(STARTER_WORDS_VERSION).toBe("v3");
    const all = allStarterStrings();
    for (const s of [STARTER_WORDS.storm2.result, STARTER_WORDS.why.rows.wrong, STARTER_WORDS.end.again, STARTER_WORDS.book.pages.why.fact!]) expect(all).toContain(s);
    expect(plainStrings()).toContain(STARTER_WORDS.plain.storm2);
    expect(screensOfBeats().map((s) => s.beat)).toEqual(expect.arrayContaining(["storm2-card", "why-row-1", "why-row-2", "end-1"]));
  });

  it("every sentence is under 12 words (cards, plates, labels, Book and Plain view)", () => {
    for (const s of [...allStarterStrings(), ...bookStrings(), ...plainStrings()]) for (const sentence of sentences(s)) expect(words(sentence), sentence).toBeLessThan(12);
  });

  it("no buy, sell, hold or pay wording anywhere", () => {
    for (const s of [...allStarterStrings(), ...bookStrings(), ...plainStrings()]) expect(BANNED.test(s), s).toBe(false);
  });

  it("no grown-up word on any card face, plate or label", () => {
    for (const s of allStarterStrings()) expect(s, s).not.toMatch(GROWN_UP);
  });

  it("at most 35 words on screen in any beat, 6b, 7 and 8 included", () => {
    for (const { beat, strings } of screensOfBeats()) {
      const n = strings.reduce((a, s) => a + words(s), 0);
      expect(n, beat).toBeLessThanOrEqual(35);
    }
  });

  it("no Book string counts anything", () => {
    for (const s of bookStrings()) expect(s, s).not.toMatch(/\d+\s*of\s*\d+|\d+\s*\/\s*\d+/i);
  });

  it("no chip gives a right answer away: there is none, and none says strong, weak, right or best", () => {
    for (const label of [...Object.values(STARTER_WORDS.why.chips), ...Object.values(STARTER_WORDS.why.wrongChips)]) expect(label).not.toMatch(/strong|weak|right|best|good|bad/i);
  });
});

describe("starter words v3 (#496): what it adds, and V2 left as it was", () => {
  it("keeps every V2 string: only new keys, and the why page written", () => {
    const { goal, plain, book, ...rest } = STARTER_WORDS;
    for (const [k, v] of Object.entries(V2)) if (!["goal", "plain", "book"].includes(k)) expect((rest as Record<string, unknown>)[k], k).toEqual(v);
    expect({ ...goal, end: undefined }).toEqual({ ...V2.goal, end: undefined });
    for (const [k, v] of Object.entries(V2.plain)) if (k !== "rows") expect((plain as Record<string, unknown>)[k], k).toEqual(v);
    for (const id of ["walls", "moat", "room", "storms"] as const) expect(book.pages[id]).toEqual(V2.book.pages[id]);
    expect(V2.book.pages.why.lines).toBeUndefined();
    expect(book.pages.why.lines?.length).toBeGreaterThan(0);
    expect(book.pages.why.grownUp).toBeUndefined();
  });

  it("the second storm says Pip's exact numbers: borrowed 10, owes 15, still 10 a year, price 4.9", () => {
    expect(STARTER_WORDS.storm2.fridge).toBe("The fridge broke. Pip's borrowed 10 coins.");
    expect(STARTER_WORDS.factsSecond).toEqual([["Year 1: 6", "coins left over"], ["Year 2: 8"], ["Year 3: 10"], ["Owes: 15 coins"]]);
    expect(STARTER_WORDS.storm2.hints.price.text).toBe("Owes 15 now. Look again.");
    expect(STARTER_WORDS.storm2.hints.worse.text).toBe("Still 10 coins a year. Look again.");
    expect(STARTER_WORDS.plain.storm2).toBe("Every price fell 30%: 4.9 coins. Borrowed 10, so it owes 15.");
    expect(STARTER_WORDS.plain.walls2).toMatch(/^Brick\. Owes 15\./);
    expect(STARTER_WORDS.plain.owes2).toBe("15 coins. Cash: 0. Interest: 1.5 coins a year.");
    // The new loan comes off the worth: a coin a piece, so the scale and the Plain view say 9 (low 7), never the old 10.
    expect(STARTER_WORDS.scale2).toEqual({ worth: "Worth about 9", low: "low guess 7" });
    expect(STARTER_WORDS.plain.worth2).toBe("Low 7, middle 9, high 11 coins.");
  });

  it("beat 6b keeps beat 6's card: same title, same three choices (the player has to look, not remember)", () => {
    expect(STARTER_WORDS.checks.storm.choices).toEqual(V2.checks.storm.choices);
    expect(STARTER_WORDS.storm2.after.text).toBe("If it owed more, that would be news. It does.");
  });
});
