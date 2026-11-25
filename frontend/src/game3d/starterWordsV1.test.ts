import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { areaLine, areaName } from "./areaWordsV2";
import { areaLine as areaLineV1 } from "./areaWordsV1";
import { STARTER_WORDS, allStarterStrings, bookStrings, plainStrings, screensOfBeats } from "./starterWordsV1";

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const sentences = (s: string) => s.split(/(?<=[.!?…])\s+/).filter(Boolean);

/** Banned in every starter string (spec section 3, beat 6): the storm must never teach hold, sell or "ride it out". */
const BANNED = /\b(stay|run|ride|ride out|weather it|hold|keep it|sell|sold|buy|bought|pay|cost|costs|trade)\b/i;
/** Grown-up words live only in the Book and the Plain view, never on a card face. */
const GROWN_UP = /net debt|ebitda|bear case|bull case|base case|margin of safety|valuation|dividend|p\/e/i;

describe("starter words v1 (#493): game voice", () => {
  it("every sentence is under 12 words", () => {
    for (const s of allStarterStrings()) for (const sentence of sentences(s)) expect(words(sentence), sentence).toBeLessThan(12);
  });

  it("no buy, sell, hold or pay wording anywhere", () => {
    for (const s of allStarterStrings()) expect(s, s).not.toMatch(BANNED);
  });

  it("no grown-up word on any card face, plate or label", () => {
    for (const s of allStarterStrings()) expect(s, s).not.toMatch(GROWN_UP);
  });

  it("at most 35 words on screen in any beat", () => {
    for (const { beat, strings } of screensOfBeats()) {
      const n = strings.reduce((a, s) => a + words(s), 0);
      expect(n, beat).toBeLessThanOrEqual(35);
    }
  });

  it("'practice' is only the noun: no 'practise' anywhere", () => {
    for (const s of allStarterStrings()) expect(s).not.toMatch(/practis/i);
  });

  it("the company card names Pip's Lemonade, never a real brand, and says it is practice", () => {
    expect(STARTER_WORDS.counter.company.name).toBe("Pip's Lemonade");
    expect(STARTER_WORDS.counter.title).toMatch(/practice/);
    expect(STARTER_WORDS.tag).toMatch(/made-up/);
  });
});

describe("starter words v1, build step 2 (#494): checks and the Book", () => {
  it("no Book string counts anything (no '3 of 5', no '2/5')", () => {
    for (const s of bookStrings()) expect(s, s).not.toMatch(/\d+\s*of\s*\d+|\d+\s*\/\s*\d+/i);
  });

  it("Book and Plain view lines also fit in one breath and carry no buy or sell wording", () => {
    for (const s of [...bookStrings(), ...plainStrings()]) {
      for (const sentence of sentences(s)) expect(words(sentence), sentence).toBeLessThan(12);
      expect(s, s).not.toMatch(BANNED);
    }
  });

  it("grown-up words appear only in a Book page's grown-up line (or the Plain view), never on a card face", () => {
    const grownUpLines = Object.values(STARTER_WORDS.book.pages).flatMap((p) => (p.grownUp ? [p.grownUp] : []));
    expect(grownUpLines.some((l) => GROWN_UP.test(l))).toBe(true);
    const outside = bookStrings().filter((s) => !grownUpLines.includes(s));
    for (const s of outside) expect(s, s).not.toMatch(GROWN_UP);
  });

  it("no choice label gives the answer away: no 'strong', 'weak', 'right' or 'best' on a choice", () => {
    for (const b of ["walls", "moat"] as const) {
      for (const label of Object.values(STARTER_WORDS.checks[b].choices)) expect(label).not.toMatch(/strong|weak|right|best|good|bad/i);
    }
  });

  it("each check names a hint for every wrong choice and none for the right one", () => {
    expect(Object.keys(STARTER_WORDS.checks.walls.hints).sort()).toEqual(["rotted", "timber"]);
    expect(Object.keys(STARTER_WORDS.checks.moat.hints).sort()).toEqual(["cheap", "sign"]);
  });

  it("the fact cards and the Plain view say Pip's real practice numbers", () => {
    expect(STARTER_WORDS.facts).toEqual([["Year 1: 6", "coins left over"], ["Year 2: 8"], ["Year 3: 10"], ["Owes: 5 coins"]]);
    expect(STARTER_WORDS.plain.walls).toMatch(/^Granite\./);
    expect(STARTER_WORDS.plain.moat).toMatch(/^Narrow\./);
  });

  it("only the pages this build unlocks are written; the rest are titles only", () => {
    const p = STARTER_WORDS.book.pages;
    expect(p.walls.lines?.length).toBeGreaterThan(0);
    expect(p.moat.lines?.length).toBeGreaterThan(0);
    for (const id of ["room", "storms", "why"] as const) expect(p[id].lines).toBeUndefined();
  });
});

describe("area words v2 (#493)", () => {
  it("names the practice yard and keeps every v1 plate as it was", () => {
    expect(areaLine({ id: "practice" })).toBe("Practice yard");
    expect(areaName({ id: "practice" })).toBe("Practice yard");
    for (const id of ["courtyard", "townhall", "records", "weather", "mint", "quarter"] as const) expect(areaLine({ id })).toBe(areaLineV1({ id }));
  });
});

describe("the practice never talks to the server (#493)", () => {
  it("no starter or practice file imports the API client", () => {
    const dir = resolve(__dirname);
    const files = readdirSync(dir).filter((f) => /^(starter|practice|Starter|Practice)/.test(f) && /\.tsx?$/.test(f) && !/\.test\./.test(f));
    expect(files.length).toBeGreaterThanOrEqual(7);
    for (const f of files) {
      const src = readFileSync(resolve(dir, f), "utf8");
      expect(src, f).not.toMatch(/lib\/api|fetch\(|XMLHttpRequest/);
    }
  });
});
