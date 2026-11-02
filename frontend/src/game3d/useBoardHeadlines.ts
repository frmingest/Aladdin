import { api } from "../lib/api";
import { useCachedQuery } from "../lib/queryCache";
import type { Holding, MacroIndicators, MarginOfSafetyBoard, PortfolioOverview, PortfolioPerformance, PreciousMetalsOverview, ThesisMonitor } from "../lib/types";
import type { HeadlineData } from "./boardHeadlines";

/**
 * Reads the numbers the Town Hall boards show. Same calls and same cache keys as the flat pages
 * (`overview`, `board`, `performance:365`), so walking in from the Dashboard costs no extra request and a
 * number on a board is the number on the page. A failed read leaves that board's number out (the board keeps
 * its words), it never shows a stale guess.
 */
export function useBoardHeadlines(): HeadlineData {
  const overview = useCachedQuery<PortfolioOverview>("overview", () => api.getPortfolioOverview());
  const board = useCachedQuery<MarginOfSafetyBoard>("board", () => api.getMarginOfSafetyBoard());
  const performance = useCachedQuery<PortfolioPerformance>("performance:365", () => api.getPortfolioPerformance({ lookbackDays: 365 }));
  const holdings = useCachedQuery<Holding[]>("holdings", () => api.listHoldings());
  const macro = useCachedQuery<MacroIndicators>("macro-indicators", () => api.getMacroIndicators());
  const thesis = useCachedQuery<ThesisMonitor>("thesis-monitor", () => api.getThesisMonitor());
  const metals = useCachedQuery<PreciousMetalsOverview>("precious-metals-overview", () => api.getPreciousMetalsOverview());
  return {
    macro: macro.data ?? undefined,
    thesis: thesis.data ?? undefined,
    metals: metals.data ?? undefined,
    overview: overview.data ?? undefined,
    board: board.data ?? undefined,
    performance: performance.data ?? undefined,
    holdingCount: holdings.data?.length,
  };
}
