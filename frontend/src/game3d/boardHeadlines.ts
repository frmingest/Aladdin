/**
 * The headline numbers on the Town Hall boards (3D sprint S18, PR 3 and PR 4). Pure functions, no three.js, no React.
 *
 * A board shows a number only when the flat page it stands for shows the same number from the same function
 * (`lib/headlines.ts`). While a number is still being read, or the read failed, the board says nothing extra:
 * no placeholder digits, no guess. Every board now has a number (S18 PR 4); Watchlist and Sectors stay words only (see the write-up).
 */
import { metalsValueText, policyRateText, portfolioValueText, rankedCounts, thesisSummaryText, totalReturnText } from "../lib/headlines";
import type { MacroIndicators, MarginOfSafetyBoard, PortfolioOverview, PortfolioPerformance, PreciousMetalsOverview, ThesisMonitor } from "../lib/types";
import type { BoardId } from "./townHallRoom";

export interface HeadlineData {
  overview?: PortfolioOverview;
  performance?: PortfolioPerformance;
  board?: MarginOfSafetyBoard;
  holdingCount?: number;
  macro?: MacroIndicators;
  thesis?: ThesisMonitor;
  metals?: PreciousMetalsOverview;
}

/** One short line of words and one number, or null when that number is not known yet. */
export function boardHeadline(id: BoardId, data: HeadlineData): string | null {
  switch (id) {
    case "dashboard":
      return data.overview ? `Portfolio value: ${portfolioValueText(data.overview)}` : null;
    case "purse":
      return data.performance ? `Total return: ${totalReturnText(data.performance)}` : null;
    case "storm": {
      if (!data.board) return null;
      const { ranked, unavailable } = rankedCounts(data.board);
      return unavailable > 0 ? `${ranked} ranked, ${unavailable} not ranked yet` : `${ranked} ranked`;
    }
    case "roll":
      return data.holdingCount === undefined ? null : `${data.holdingCount} ${data.holdingCount === 1 ? "holding" : "holdings"}`;
    case "weather": {
      const rate = data.macro ? policyRateText(data.macro) : null;
      return rate === null ? null : `Norway policy rate: ${rate}`;
    }
    case "reasons": {
      // Two pages, two numbers, each printed by its own page's function; a number still unknown is left out, not guessed.
      const lines = [
        data.thesis ? `Reasons: ${thesisSummaryText(data.thesis.rows)}` : null,
        data.metals ? `Metals: ${metalsValueText(data.metals)}` : null,
      ].filter((l): l is string => l !== null);
      return lines.length > 0 ? lines.join("\n") : null;
    }
    default:
      return null;
  }
}
