import { describe, expect, it } from "vitest";
import { PRICE_WORDS } from "./pricePostWordsV2";

const words = (s: string) => s.trim().split(/\s+/).length;

describe("price post words v2", () => {
  it("keeps every label to four words or fewer", () => {
    const all = [PRICE_WORDS.title, ...Object.values(PRICE_WORDS.gauge), ...Object.values(PRICE_WORDS.scroll), ...Object.values(PRICE_WORDS.banner)];
    for (const w of all) expect(words(w)).toBeLessThanOrEqual(4);
  });
  it("has a label for every look, fog included", () => {
    expect(Object.keys(PRICE_WORDS.gauge).sort()).toEqual(["bargain", "discount", "fog", "full_price", "overpriced"]);
    expect(Object.keys(PRICE_WORDS.scroll).sort()).toEqual(["broken", "cracked", "fog", "whole"]);
    expect(Object.keys(PRICE_WORDS.banner).sort()).toEqual(["breach_risk", "exposed", "fog", "sheltered"]);
  });
  it("says why, never the flat page's thesis, and names fog in the scroll", () => {
    expect(Object.values(PRICE_WORDS.scroll).join(" ")).not.toMatch(/thesis/i);
    expect(PRICE_WORDS.scroll.whole).toBe("Why still stands");
    expect(PRICE_WORDS.scroll.fog).toBe("Why not read yet");
  });
});
