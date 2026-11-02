import { describe, expect, it } from "vitest";
import { formatNok } from "../lib/format";
import { metalsValueText, policyRateText, portfolioValueText, rankedCounts, thesisSummaryText, totalReturnText } from "../lib/headlines";
import { boardHeadline } from "./boardHeadlines";
import { BOARDS } from "./townHallRoom";
import type { MacroIndicators, MarginOfSafetyBoard, PortfolioOverview, PortfolioPerformance, PreciousMetalsOverview, ThesisMonitor } from "../lib/types";

const overview = { total_value_nok: "2500000.00" } as PortfolioOverview;
const perf = (r: string | null) => ({ total_return_pct: r }) as PortfolioPerformance;
const macro = (rate: string | null, stale = false) =>
  ({ indicators: [{ key: "no_policy_rate", value: rate, display_unit: "%", stale }] }) as unknown as MacroIndicators;
const thesis = (...statuses: [string, string][]) =>
  ({ rows: statuses.map(([status, status_label]) => ({ status, status_label })) }) as unknown as ThesisMonitor;
const metals = { total_value_nok: "120000.00" } as PreciousMetalsOverview;
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

  it("shows Norway's policy rate on the Wide Weather board, stale kept", () => {
    expect(boardHeadline("weather", { macro: macro("4.25") })).toBe(`Norway policy rate: ${policyRateText(macro("4.25"))}`);
    expect(boardHeadline("weather", { macro: macro("4.25", true) })).toBe("Norway policy rate: 4.25% (stale)");
    expect(boardHeadline("weather", { macro: macro(null) })).toBeNull();
  });

  it("shows the Thesis counts and the metals total on the Reasons board, each only when known", () => {
    const t = thesis(["tripwire_fired", "\u{1F534} Tripwire fired"], ["intact", "\u{1F7E2} Intact"], ["intact", "\u{1F7E2} Intact"]);
    const reasons = `Reasons: ${thesisSummaryText(t.rows)}`;
    const shiny = `Metals: ${metalsValueText(metals)}`;
    expect(boardHeadline("reasons", { thesis: t, metals })).toBe(`${reasons}\n${shiny}`);
    expect(boardHeadline("reasons", { thesis: t })).toBe(reasons);
    expect(boardHeadline("reasons", { metals })).toBe(shiny);
    expect(shiny).toContain(formatNok("120000.00"));
    expect(boardHeadline("reasons", { thesis: thesis() })).toBe("Reasons: Nothing watched yet");
  });

  it("says nothing extra while no number is known yet", () => {
    for (const b of BOARDS) expect(boardHeadline(b.id, {})).toBeNull();
  });

  it("gives every board a number once its data is in", () => {
    const data = { overview, performance: perf("1"), board: board(["below_bear"]), holdingCount: 2, macro: macro("4"), thesis: thesis(["intact", "Intact"]), metals };
    for (const b of BOARDS) expect(boardHeadline(b.id, data), b.id).not.toBeNull();
  });

  it("never uses buy, sell, red or green wording", () => {
    const all = [
      boardHeadline("dashboard", { overview }),
      boardHeadline("purse", { performance: perf("-3.2") }),
      boardHeadline("storm", { board: board(["above_bull", "unavailable"]) }),
      boardHeadline("roll", { holdingCount: 5 }),
      boardHeadline("weather", { macro: macro("4.25", true) }),
      boardHeadline("reasons", { thesis: thesis(["tripwire_fired", "Tripwire fired"], ["review", "Needs review"]), metals }),
    ].join(" ");
    expect(all).not.toMatch(/\b(buy|sell|red|green)\b/i);
  });
});
