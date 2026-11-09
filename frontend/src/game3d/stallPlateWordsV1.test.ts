import { describe, expect, it } from "vitest";
import { gapLabel, TONE_FLAG } from "../lib/marketStreet";
import type { WatchlistRow } from "../lib/types";
import { STALL_PLATE_NAME_CHARS, STALL_PLATE_TONE_WORD, gapInWords, stallPlateWords } from "./stallPlateWordsV1";

describe("stall plate words v1", () => {
  it("says the sign of the gap in words and keeps the number exact", () => {
    expect(gapInWords("+4%")).toBe("4% over");
    expect(gapInWords("-3%")).toBe("3% under");
    expect(gapInWords("−3%")).toBe("3% under");
    expect(gapInWords("0%")).toBe("On the mark");
    expect(gapInWords("30%")).toBe("30% over");
    expect(gapInWords("+1,200%")).toBe("1,200% over");
    expect(gapInWords(null)).toBeNull();
  });

  it("agrees with the flat page's own gap, both ways round", () => {
    const row = (d: string) => ({ distance_to_buy_pct: d }) as unknown as WatchlistRow;
    expect(gapInWords(gapLabel(row("4.2")))).toBe("4% over");
    expect(gapInWords(gapLabel(row("-3.4")))).toBe("3% under");
    expect(gapInWords(gapLabel(row("0")))).toBe("On the mark");
  });

  it("prints the name and a short word with the gap, and cuts a long name", () => {
    expect(stallPlateWords({ name: "Equinor", tone: "amber", gap: "+4%" })).toEqual({ name: "Equinor", line: "Close · 4% over" });
    expect(stallPlateWords({ name: "Equinor", tone: "gold", gap: "-3%" }).line).toBe("In reach · 3% under");
    const long = stallPlateWords({ name: "A very long company name indeed", tone: "plain", gap: "30%" });
    expect(long.name.length).toBeLessThanOrEqual(STALL_PLATE_NAME_CHARS);
    expect(long.name.endsWith("…")).toBe(true);
  });

  it("never gives an unpriced stall a number: unknown stays fog", () => {
    expect(stallPlateWords({ name: "Vend", tone: "mist", gap: null }).line).toBe("No price");
    expect(stallPlateWords({ name: "Vend", tone: "mist", gap: "+4%" }).line).toBe("No price");
  });

  it("has a word for every tone, short enough for the plate, and none of the flat page's methods wording", () => {
    for (const tone of Object.keys(TONE_FLAG) as (keyof typeof TONE_FLAG)[]) {
      expect(STALL_PLATE_TONE_WORD[tone].length).toBeLessThanOrEqual(10);
    }
    expect(Object.values(STALL_PLATE_TONE_WORD)).not.toContain("In range");
  });
});
