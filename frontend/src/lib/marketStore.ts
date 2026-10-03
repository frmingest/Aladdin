import { api, ApiError } from "./api";
import type { AnalysisRun, Holding, HoldingMetrics, HoldingThesis, HoldingValuation, WatchlistRow } from "./types";

/** Everything the Marketplace reads about one company, as stored (game mode, G9). Shared by the store page
 * and the Hype Booth (G12). Read requests only; each one that fails is listed in `problems` and its gates
 * become unknown. */

export interface StoreData {
  holding: Holding | null;
  row: WatchlistRow | null;
  valuation: HoldingValuation | null;
  analysis: AnalysisRun | null;
  thesis: HoldingThesis | null;
  metrics: HoldingMetrics | null;
  problems: string[];
}

export const errText = (e: unknown, what: string): string =>
  `${what}: ${e instanceof ApiError ? e.message : "could not be loaded."}`;

export async function loadStore(id: string): Promise<StoreData> {
  const [h, w, v, a, t, p] = await Promise.allSettled([
    api.getHolding(id),
    api.getWatchlistEntry(id),
    api.getHoldingValuation(id),
    api.getLatestAnalysis(id),
    api.getHoldingThesis(id),
    api.listHoldingPeriods(id),
  ]);
  const problems: string[] = [];
  const take = <T,>(r: PromiseSettledResult<T>, what: string, quiet404 = false): T | null => {
    if (r.status === "fulfilled") return r.value;
    if (!(quiet404 && r.reason instanceof ApiError && r.reason.status === 404)) problems.push(errText(r.reason, what));
    return null;
  };
  const holding = take(h, "Company");
  const row = take(w, "Watchlist entry");
  const valuation = take(v, "Valuation");
  const analysis = take(a, "Analysis", true);
  const thesis = take(t, "Thesis monitor");
  const periods = take(p, "Filing periods") ?? [];
  let metrics: HoldingMetrics | null = null;
  if (periods.length > 0) {
    try {
      metrics = await api.getHoldingMetrics(id, periods[periods.length - 1]);
    } catch (e) {
      problems.push(errText(e, "Ratios"));
    }
  }
  return { holding, row, valuation, analysis, thesis, metrics, problems };
}
