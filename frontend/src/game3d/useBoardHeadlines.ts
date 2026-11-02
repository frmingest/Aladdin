import { api } from "../lib/api";
import { useCachedQuery } from "../lib/queryCache";
import type { Holding, MarginOfSafetyBoard, PortfolioOverview, PortfolioPerformance } from "../lib/types";
import type { HeadlineData } from "./boardHeadlines";

/**
 * Reads the four numbers the Town Hall boards show. Same calls and same cache keys as the flat pages
 * (`overview`, `board`, `performance:365`), so walking in from the Dashboard costs no extra request and a
 * number on a board is the number on the page. A failed read leaves that board's number out (the board keeps
 * its words), it never shows a stale guess.
 */
export function useBoardHeadlines(): HeadlineData {
  const overview = useCachedQuery<PortfolioOverview>("overview", () => api.getPortfolioOverview());
  const board = useCachedQuery<MarginOfSafetyBoard>("board", () => api.getMarginOfSafetyBoard());
  const performance = useCachedQuery<PortfolioPerformance>("performance:365", () => api.getPortfolioPerformance({ lookbackDays: 365 }));
  const holdings = useCachedQuery<Holding[]>("holdings", () => api.listHoldings());
  return {
    overview: overview.data ?? undefined,
    board: board.data ?? undefined,
    performance: performance.data ?? undefined,
    holdingCount: holdings.data?.length,
  };
}
