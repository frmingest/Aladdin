import { describe, expect, it } from "vitest";
import {
  CANDLES,
  ORDER_MAX_LENGTH,
  WINTER_STORAGE_KEY,
  cleanOrder,
  coverageLine,
  daysWord,
  loadOrder,
  saveOrder,
  sceneState,
  signedNok,
  signedPercent,
} from "./winter";
import type { WinterPoint } from "./types";

const point = (change: string, days: number): WinterPoint => ({
  day: "2025-01-01",
  value_nok: "1000",
  change_nok: "0",
  change,
  days_under_water: days,
});
// peak, then down to -20% in ten steps
const fall = Array.from({ length: 11 }, (_, i) => point(String(-0.02 * i), i));

function memory(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => void (data[k] = v),
    removeItem: (k: string) => void delete data[k],
  };
}

describe("the winter order", () => {
  it("is one trimmed line of at most 200 characters", () => {
    expect(cleanOrder("  If it falls,\n\n I will   check my notes ")).toBe("If it falls, I will check my notes");
    expect(cleanOrder("x".repeat(500))).toHaveLength(ORDER_MAX_LENGTH);
  });

  it("is saved, read back, and removed when emptied", () => {
    const store = memory();
    expect(saveOrder(store, " check the thesis ")).toBe("check the thesis");
    expect(store.data[WINTER_STORAGE_KEY]).toBe("check the thesis");
    expect(loadOrder(store)).toBe("check the thesis");
    expect(saveOrder(store, "   ")).toBe("");
    expect(WINTER_STORAGE_KEY in store.data).toBe(false);
  });

  it("survives missing or throwing storage", () => {
    expect(loadOrder(null)).toBe("");
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadOrder(broken)).toBe("");
    expect(saveOrder(broken, "still here")).toBe("still here");
  });
});

describe("sceneState", () => {
  it("has no scene without a replay", () => {
    expect(sceneState([], 0)).toBeNull();
  });

  it("starts at the peak with every candle lit and no frost", () => {
    const s = sceneState(fall, 0)!;
    expect(s).toMatchObject({ progress: 0, candlesLit: CANDLES, frost: 0, icicles: 0, atBottom: false });
  });

  it("snuffs the candles out one by one and ends with none at the bottom", () => {
    const lit = fall.map((_, i) => sceneState(fall, i)!.candlesLit);
    expect(lit[0]).toBe(5);
    expect(lit[9]).toBe(1); // one candle is still alight until the very bottom
    expect(lit[10]).toBe(0);
    for (let i = 1; i < lit.length; i++) expect(lit[i]).toBeLessThanOrEqual(lit[i - 1]);
    expect(new Set(lit).size).toBe(CANDLES + 1);
  });

  it("deepens the frost to the worst day of the window and hangs up to three icicle copies", () => {
    expect(sceneState(fall, 5)!.frost).toBeCloseTo(0.5);
    expect(sceneState(fall, 1)!.icicles).toBe(1);
    expect(sceneState(fall, 5)!.icicles).toBe(2);
    const bottom = sceneState(fall, 10)!;
    expect(bottom.frost).toBe(1);
    expect(bottom.icicles).toBe(3);
    expect(bottom.atBottom).toBe(true);
  });

  it("clamps a position outside the replay", () => {
    expect(sceneState(fall, -4)!.progress).toBe(0);
    expect(sceneState(fall, 99)!.atBottom).toBe(true);
  });
});

describe("words and numbers", () => {
  it("keeps the sign of a loss and prints a zero without one", () => {
    expect(signedPercent("-0.1234")).toBe("−12.3%");
    expect(signedPercent("0")).toBe("0.0%");
    expect(signedPercent("-0.00001")).toBe("0.0%");
    expect(signedNok("-85000.4")).toBe("−85 000 kr");
    expect(signedNok("0.2")).toBe("0 kr");
    expect(signedPercent("oops")).toBe("oops");
  });

  it("always prints coverage with its 'of' and days with the right number", () => {
    expect(
      coverageLine({ coverage: { covered_count: 5, total_count: 8, covered_value_nok: "1", covered_value_share: null, holdings: [] } }),
    ).toBe("5 of 8 holdings had stored prices");
    expect(daysWord(1)).toBe("1 day");
    expect(daysWord(0)).toBe("0 days");
    expect(daysWord(23)).toBe("23 days");
  });
});
