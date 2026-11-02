import { describe, expect, it } from "vitest";
import { formatNok } from "../lib/format";
import { portfolioValueText, rankedCounts, totalReturnText } from "../lib/headlines";
import { boardHeadline } from "./boardHeadlines";
import { BOARDS } from "./townHallRoom";
import type { MarginOfSafetyBoard, PortfolioOverview, PortfolioPerformance } from "../lib/types";

const overview = { total_value_nok: "2500000.00" } as PortfolioOverview;
const perf = (r: string | null) => ({ total_return_pct: r }) as PortfolioPerformance;
const board = (zones: string[]) => ({ rows: zones.map((zone) => ({ zone })) }) as unknown as MarginOfSafetyBoard;

describe("boardHeadline", () => {
  it("shows the Dashboard's own portfolio value on the Big Board", () => {
    expect(boardHeadline("dashboard", { overview })).toBe(`Portfolio value: ${portfolioValueText(overview)}`);
    expect(boardHeadline("dashboard", { overview })).toContain(formatNok("2500000.00"));
  });

  it("shows the Performance page's total return, with its dash when unknown", () => {
    expect(boardHeadline("purse", { performance: perf("8.5") })).toBe(`Total return: ${totalReturnText(perf("8.5"))}`);
    expect(boardHeadline("purse", { performance: perf(null) })).toBe("Total return: —");
  });

  it("says how many companies the board could rank, and how many it could not", () => {
    const b = board(["below_bear", "unavailable", "above_bull"]);
    expect(rankedCounts(b)).toEqual({ ranked: 2, unavailable: 1 });
    expect(boardHeadline("storm", { board: b })).toBe("2 ranked, 1 not ranked yet");
    expect(boardHeadline("storm", { board: board(["below_bear"]) })).toBe("1 ranked");
  });

  it("counts holdings, singular and plural", () => {
    expect(boardHeadline("roll", { holdingCount: 1 })).toBe("1 holding");
    expect(boardHeadline("roll", { holdingCount: 8 })).toBe("8 holdings");
    expect(boardHeadline("roll", { holdingCount: 0 })).toBe("0 holdings");
  });

  it("says nothing extra while a number is unknown, and for boards without a shared function yet", () => {
    for (const b of BOARDS) expect(boardHeadline(b.id, {})).toBeNull();
    expect(boardHeadline("weather", { overview, performance: perf("1"), holdingCount: 3 })).toBeNull();
    expect(boardHeadline("reasons", { overview, holdingCount: 3 })).toBeNull();
  });

  it("never uses buy, sell, red or green wording", () => {
    const all = [
      boardHeadline("dashboard", { overview }),
      boardHeadline("purse", { performance: perf("-3.2") }),
      boardHeadline("storm", { board: board(["above_bull", "unavailable"]) }),
      boardHeadline("roll", { holdingCount: 5 }),
    ].join(" ");
    expect(all).not.toMatch(/\b(buy|sell|red|green)\b/i);
  });
});
