import { describe, expect, it } from "vitest";
import { PRICE_WORDS } from "./pricePostWordsV1";

const words = (s: string) => s.trim().split(/\s+/).length;

describe("price post words v1", () => {
  it("keeps every label to four words or fewer", () => {
    const all = [PRICE_WORDS.title, ...Object.values(PRICE_WORDS.gauge), ...Object.values(PRICE_WORDS.scroll), ...Object.values(PRICE_WORDS.banner)];
    for (const w of all) expect(words(w)).toBeLessThanOrEqual(4);
  });
  it("has a label for every look, fog included", () => {
    expect(Object.keys(PRICE_WORDS.gauge).sort()).toEqual(["bargain", "discount", "fog", "full_price", "overpriced"]);
    expect(Object.keys(PRICE_WORDS.scroll).sort()).toEqual(["broken", "cracked", "fog", "whole"]);
    expect(Object.keys(PRICE_WORDS.banner).sort()).toEqual(["breach_risk", "exposed", "fog", "sheltered"]);
  });
});
