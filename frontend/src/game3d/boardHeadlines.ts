/**
 * The headline numbers on the Town Hall boards (3D sprint S18, PR 3). Pure functions, no three.js, no React.
 *
 * A board shows a number only when the flat page it stands for shows the same number from the same function
 * (`lib/headlines.ts`). While a number is still being read, or the read failed, the board says nothing extra:
 * no placeholder digits, no guess. Boards with no entry here keep their words only; the rest of the pages get
 * numbers when each has a shared function of its own.
 */
import { portfolioValueText, rankedCounts, totalReturnText } from "../lib/headlines";
import type { MarginOfSafetyBoard, PortfolioOverview, PortfolioPerformance } from "../lib/types";
import type { BoardId } from "./townHallRoom";

export interface HeadlineData {
  overview?: PortfolioOverview;
  performance?: PortfolioPerformance;
  board?: MarginOfSafetyBoard;
  holdingCount?: number;
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
    default:
      return null;
  }
}
