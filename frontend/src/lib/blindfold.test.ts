import { describe, expect, it } from "vitest";
import {
  BLINDFOLD_STORAGE_KEY,
  addResult,
  clearResults,
  formatFigure,
  fractionToValue,
  gaugeTicks,
  moveStake,
  valueFromSceneY,
  loadResults,
  parseStake,
  sceneY,
  seenIds,
  stakeText,
  tally,
  tallyByWidth,
  tallyLine,
  valueToFraction,
  widthLine,
  type BlindfoldResult,
} from "./blindfold";
import type { BlindfoldReveal } from "./types";

const reveal = (id: string, inside: boolean, width: BlindfoldReveal["width_class"] = "medium"): BlindfoldReveal => ({
  puzzle_id: id,
  actual: "1",
  low: "0",
  high: "2",
  inside,
  position: inside ? "inside" : "above",
  width_class: width,
  last_owner_earnings: "1",
  name: "X",
  ticker: "X",
  shown_period: "FY2021",
  answer_period: "FY2022",
  source_file: null,
  note: "",
});

function memoryStore(initial?: string) {
  const data = new Map<string, string>(initial ? [[BLINDFOLD_STORAGE_KEY, initial]] : []);
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

const results = (insideCount: number, total: number): BlindfoldResult[] =>
  Array.from({ length: total }, (_, i) => ({
    puzzle_id: `p${i}`,
    inside: i < insideCount,
    position: i < insideCount ? "inside" : "below",
    width_class: i % 2 === 0 ? "narrow" : "wide",
  }));

describe("the tally is a count that opens at n of 8", () => {
  it("shows no ratio below the gate, only the count", () => {
    const t = tally(results(5, 7), 8);
    expect(t).toEqual({ n: 7, open: false, inside: null });
    expect(tallyLine(t, 8)).toBe("Keep going: 7 answered. Your tally opens at 8.");
    expect(tallyLine(tally(results(0, 1), 8), 8)).toContain("1 answered");
  });

  it("opens at the gate and always prints the count beside the ratio", () => {
    const t = tally(results(5, 8), 8);
    expect(t).toEqual({ n: 8, open: true, inside: 5 });
    expect(tallyLine(t, 8)).toBe("Your stakes caught it 5 of 8 times.");
  });

  it("gates each width group on its own count", () => {
    const by = tallyByWidth(results(8, 16), 8); // 8 narrow, 8 wide, 0 medium
    expect(by.narrow.open && by.wide.open).toBe(true);
    expect(by.medium).toEqual({ n: 0, open: false, inside: null });
    expect(widthLine("medium", by.medium, 8)).toBe("Medium stakes: not enough yet (0 of 8)");
    expect(widthLine("narrow", by.narrow, 8)).toMatch(/^Narrow stakes: caught \d of 8$/);
  });
});

describe("answers kept in this browser", () => {
  it("round-trips, counts a puzzle once and lists what to skip", () => {
    const store = memoryStore();
    let list = loadResults(store);
    list = addResult(store, list, reveal("a", true));
    list = addResult(store, list, reveal("a", false));
    list = addResult(store, list, reveal("b", false));
    expect(seenIds(list)).toEqual(["a", "b"]);
    expect(loadResults(store)).toEqual(list);
    clearResults(store);
    expect(loadResults(store)).toEqual([]);
  });

  it("survives garbage, a missing store and a store that throws", () => {
    expect(loadResults(memoryStore("{not json"))).toEqual([]);
    expect(loadResults(memoryStore('[{"puzzle_id":1}]'))).toEqual([]);
    expect(loadResults(null)).toEqual([]);
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
    expect(loadResults(broken)).toEqual([]);
    expect(addResult(broken, [], reveal("a", true))).toHaveLength(1);
    expect(() => clearResults(broken)).not.toThrow();
  });
});

describe("numbers", () => {
  it("formats money compactly without a currency, and ratios as a percent", () => {
    expect(formatFigure("1234567890", "money")).toBe("1.23 bn");
    expect(formatFigure("-2500000", "money")).toBe("\u22122.5 m");
    expect(formatFigure("4321", "money")).toBe("4,321");
    expect(formatFigure("0.1234", "ratio")).toBe("12.3%");
    expect(formatFigure(null, "money")).toBe("");
  });

  it("parses what people type", () => {
    expect(parseStake("1 234,5")).toBe(12345);
    expect(parseStake("1\u00a0000.5")).toBe(1000.5);
    expect(parseStake("\u2212300")).toBe(-300);
    expect(parseStake("")).toBeNull();
    expect(parseStake("abc")).toBeNull();
    expect(stakeText(1234.5678)).toBe("1234.5678");
  });
});

describe("stake geometry", () => {
  it("maps between fractions and values and keeps the scene inside the gauge", () => {
    expect(fractionToValue(0.25, 100, 200)).toBe(125);
    expect(valueToFraction(150, 100, 200)).toBe(0.5);
    expect(valueToFraction(5, 5, 5)).toBe(0.5);
    expect(sceneY(100, 100, 200, 20, 220)).toBe(220);
    expect(sceneY(200, 100, 200, 20, 220)).toBe(20);
    expect(sceneY(900, 100, 200, 20, 220)).toBe(20); // a stored figure far above stays on the gauge
    expect(sceneY(-900, 100, 200, 20, 220)).toBe(220);
  });

  it("picks round ticks inside the range", () => {
    expect(gaugeTicks(0, 100, 4)).toEqual([0, 50, 100]);
    const ticks = gaugeTicks(-30, 230, 4);
    expect(ticks.every((t) => t >= -30 && t <= 230)).toBe(true);
    expect(ticks.length).toBeGreaterThanOrEqual(3);
    expect(gaugeTicks(5, 5)).toEqual([5]);
  });
});

describe("dragging a stake", () => {
  it("reads a value back from a scene position", () => {
    expect(valueFromSceneY(266, 100, 200, 46, 266)).toBe(100);
    expect(valueFromSceneY(46, 100, 200, 46, 266)).toBe(200);
    expect(valueFromSceneY(0, 100, 200, 46, 266)).toBe(200); // past the top stays on the gauge
  });

  it("keeps stakes on the gauge and apart", () => {
    expect(moveStake("low", -50, 120, 160, 100, 200)).toBe(100);
    expect(moveStake("high", 999, 120, 160, 100, 200)).toBe(200);
    expect(moveStake("low", 159, 120, 160, 100, 200)).toBe(149); // 11% of the gauge below the high stake
    expect(moveStake("high", 121, 120, 160, 100, 200)).toBe(131);
  });
});
