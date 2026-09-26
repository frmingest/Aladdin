/**
 * Thin fetch wrapper for the backend API (see backend/app/api/*.py).
 *
 * URL strategy matches the two ways this app runs (see vite.config.ts and
 * frontend/Dockerfile):
 * - Local dev, VITE_API_BASE_URL unset: requests go to "/api/*", which
 *   vite.config.ts's dev-server proxy rewrites to http://localhost:8000/*.
 * - Production (frontend built and served as static files behind nginx —
 *   see Dockerfile/nginx.conf): there's no server-side proxy, so
 *   VITE_API_BASE_URL (baked in at build time) must point straight at the
 *   deployed backend origin, and requests go directly there with no
 *   "/api" prefix — the backend's own routers aren't mounted under one.
 */

import type {
  Account,
  AnalysisQueue,
  AnalysisReadiness,
  AnalysisRun,
  AccountUpdateInput,
  CompanyResearch,
  DeletionResult,
  DocumentSummary,
  EdgarImport,
  NewswebAnnualReports,
  EsefImport,
  FundDimension,
  FundExposureRowInput,
  FundFacts,
  FundProfileInput,
  FundReturn,
  Holding,
  HoldingAnnouncements,
  HoldingCreateInput,
  HoldingFieldOptions,
  HoldingMetrics,
  ShareCount,
  HoldingNote,
  HoldingThesis,
  HoldingUpdateInput,
  HoldingValuation,
  HoldingsImportResult,
  Journal,
  JournalEntry,
  JournalEntryInput,
  JournalEntryUpdate,
  MacroIndicators,
  MacroRefreshResult,
  MacroResearch,
  MetalHoldingRow,
  MetalPriceHistory,
  CoinSeries,
  PreciousMetalHoldingCreateInput,
  PreciousMetalHoldingUpdateInput,
  PreciousMetalsOverview,
  MarginOfSafetyBoard,
  PortfolioImportResponse,
  PortfolioOverview,
  PortfolioPerformance,
  PortfolioRisk,
  PortfolioSnapshot,
  PortfolioSnapshotSummary,
  PortfolioWipeResult,
  SectorResearch,
  SnapshotDeleteResult,
  SourceEligibility,
  SystemStatus,
  DemoModeState,
  ThesisMonitor,
  TripwireCreateInput,
  TripwireUpdateInput,
  Tripwire,
  MetricDef,
  Watchlist,
  WatchlistCreateInput,
  WatchlistRow,
  WatchlistUpdateInput,
  QueuedRun,
  QueueReadyHoldingsResult,
} from "./types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;

function apiUrl(path: string): string {
  return BASE_URL ? `${BASE_URL}${path}` : `/api${path}`;
}

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    const message =
      typeof detail === "string"
        ? detail
        : detail && typeof detail === "object" && "detail" in detail
          ? String((detail as { detail: unknown }).detail)
          : `request failed with status ${status}`;
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit & { query?: Record<string, string | boolean | undefined> },
): Promise<T> {
  const { query, ...rest } = init ?? {};
  let url = apiUrl(path);
  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params.set(key, String(value));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const response = await fetch(url, {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(rest.body && !(rest.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...rest.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    throw new ApiError(response.status, body);
  }
  return body as T;
}

export const api = {
  listHoldings: () => request<Holding[]>("/holdings"),
  getHolding: (id: string) => request<Holding>(`/holdings/${id}`),
  createHolding: (input: HoldingCreateInput) =>
    request<Holding>("/holdings", { method: "POST", body: JSON.stringify(input) }),
  updateHolding: (id: string, input: HoldingUpdateInput) =>
    request<Holding>(`/holdings/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteHolding: (id: string, cascade = false) =>
    request<void>(`/holdings/${id}`, {
      method: "DELETE",
      query: { confirm: true, cascade: cascade || undefined },
    }),
  /** Every document, fact, analysis, note, price and research item for one
   * holding — the holding itself stays. */
  deleteHoldingData: (id: string) =>
    request<DeletionResult>(`/holdings/${id}/documents`, {
      method: "DELETE",
      query: { confirm: true },
    }),
  /** Clean slate: every holding and document. Backend refuses (409) while
   * portfolio snapshots exist — call wipeAllPortfolioData first. */
  wipeAllHoldings: () =>
    request<DeletionResult>("/holdings/all", { method: "DELETE", query: { confirm: true } }),
  /** Sector / Instrument Type dropdown options for the manual-edit UI —
   * see backend/app/api/holdings.py's `GET /holdings/field-options`. */
  getHoldingFieldOptions: () => request<HoldingFieldOptions>("/holdings/field-options"),

  listHoldingPeriods: (holdingId: string) =>
    request<string[]>(`/holdings/${holdingId}/periods`),
  getHoldingMetrics: (holdingId: string, period: string) =>
    request<HoldingMetrics>(`/holdings/${holdingId}/metrics`, { query: { period } }),
  /** Enter the current share count yourself; it wins over Yahoo / SEC. */
  setShareCount: (
    holdingId: string,
    body: { shares: string; as_of: string; reference?: string; note?: string },
  ) =>
    request<ShareCount>(`/holdings/${holdingId}/share-count`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  /** Removes the share counts you entered (Yahoo / SEC take over again). */
  clearShareCount: (holdingId: string) =>
    request<{ removed: number }>(`/holdings/${holdingId}/share-count`, {
      method: "DELETE",
      query: { confirm: true },
    }),

  deleteDocument: (id: string) =>
    request<DeletionResult>(`/documents/${id}`, { method: "DELETE", query: { confirm: true } }),
  listDocuments: (holdingId: string) =>
    request<DocumentSummary[]>("/documents", { query: { holding_id: holdingId } }),
  uploadDocument: (params: {
    file: File;
    holdingId: string;
    documentType: string;
    reportingPeriod?: string;
  }) => {
    const form = new FormData();
    form.set("file", params.file);
    form.set("holding_id", params.holdingId);
    form.set("document_type", params.documentType);
    if (params.reportingPeriod) form.set("reporting_period", params.reportingPeriod);
    return request<{ document: DocumentSummary; was_duplicate_file: boolean }>(
      "/documents/upload",
      { method: "POST", body: form },
    );
  },

  listAccounts: () => request<Account[]>("/accounts"),
  /** PATCH /accounts/{id} — currently only used to give an account a
   * human-readable name (Faiz's request, 2026-09-21: CSV import
   * auto-names an account "Account <number>" when no name is given at
   * upload time; this is how it gets renamed afterward). */
  updateAccount: (id: string, input: AccountUpdateInput) =>
    request<Account>(`/accounts/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteAccount: (id: string) =>
    request<void>(`/accounts/${id}`, { method: "DELETE", query: { confirm: true } }),

  listSnapshots: (accountId?: string) =>
    request<PortfolioSnapshotSummary[]>("/portfolio/snapshots", {
      query: accountId ? { account_id: accountId } : undefined,
    }),
  /** Full detail for one snapshot, including every position (quantity,
   * cost basis / GAV, last price, market value) — see
   * backend/app/api/portfolio.py's GET /portfolio/snapshots/{id}. Used by
   * the Portfolio page's expandable snapshot rows. */
  getSnapshot: (id: string) => request<PortfolioSnapshot>(`/portfolio/snapshots/${id}`),
  deleteSnapshot: (id: string) =>
    request<SnapshotDeleteResult>(`/portfolio/snapshots/${id}`, {
      method: "DELETE",
      query: { confirm: true },
    }),
  /** Wipes every account, snapshot, and position — Holdings and Documents
   * are out of scope (see backend/app/api/portfolio.py's
   * delete_all_portfolio_data). Added 2026-09-21. */
  deleteAllPortfolioData: () =>
    request<PortfolioWipeResult>("/portfolio/all", { method: "DELETE", query: { confirm: true } }),

  /** Imports one broker-export CSV (see backend/app/api/portfolio.py's
   * POST /portfolio/import-csv). `accountNumber` is optional — the real
   * Nordnet-style exports embed it in the filename
   * ("...kontono._12345678_..."), so it's only needed as an override. */
  importPortfolioCsv: (params: { file: File; accountNumber?: string; accountName?: string }) => {
    const form = new FormData();
    form.set("file", params.file);
    if (params.accountNumber) form.set("account_number", params.accountNumber);
    if (params.accountName) form.set("account_name", params.accountName);
    return request<PortfolioImportResponse>("/portfolio/import-csv", {
      method: "POST",
      body: form,
    });
  },

  // Live research (Sprint 2) — see backend/app/api/research.py. GET serves
  // cache-or-refresh-if-stale; the /refresh POSTs force a real provider
  // call regardless of freshness ("I want this now", no scheduler exists).
  getMacroResearch: () => request<MacroResearch>("/research/macro"),
  getMacroIndicators: () => request<MacroIndicators>("/macro/indicators"),
  refreshMacroIndicators: () =>
    request<MacroRefreshResult>("/macro/indicators/refresh", { method: "POST" }),
  refreshMacroResearch: () =>
    request<MacroResearch>("/research/macro/refresh", { method: "POST" }),

  getSectorResearch: (sector: string) =>
    request<SectorResearch>(`/research/sectors/${encodeURIComponent(sector)}`),
  refreshSectorResearch: (sector: string) =>
    request<SectorResearch>(`/research/sectors/${encodeURIComponent(sector)}/refresh`, {
      method: "POST",
    }),

  getCompanyResearch: (holdingId: string) =>
    request<CompanyResearch>(`/research/holdings/${holdingId}`),
  refreshCompanyResearch: (holdingId: string) =>
    request<CompanyResearch>(`/research/holdings/${holdingId}/refresh`, { method: "POST" }),

  // Valuation (Sprint 3) — see backend/app/api/valuation.py. Same
  // GET-serves-fresh-or-refreshes / POST-.../refresh-forces-it shape as
  // the research endpoints above.
  getHoldingValuation: (holdingId: string) =>
    request<HoldingValuation>(`/valuation/holdings/${holdingId}`),
  refreshHoldingValuation: (holdingId: string) =>
    request<HoldingValuation>(`/valuation/holdings/${holdingId}/refresh`, { method: "POST" }),

  /** Sprint 5 dashboard — database-only roll-up (no market data, no LLM). */
  getPortfolioOverview: () => request<PortfolioOverview>("/portfolio/overview"),

  // Watchlist (F7) — backend/app/api/watchlist.py. GET values each entry
  // like the margin-of-safety board (cached prices); never calls an LLM.
  getWatchlist: () => request<Watchlist>("/watchlist"),
  getWatchlistEntry: (holdingId: string) => request<WatchlistRow | null>(`/watchlist/holdings/${holdingId}`),
  addToWatchlist: (input: WatchlistCreateInput) =>
    request<WatchlistRow>("/watchlist", { method: "POST", body: JSON.stringify(input) }),
  updateWatchlistEntry: (id: string, input: WatchlistUpdateInput) =>
    request<WatchlistRow>(`/watchlist/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  removeFromWatchlist: (id: string) =>
    request<void>(`/watchlist/${id}`, { method: "DELETE", query: { confirm: true } }),

  // Decision journal (F6) — backend/app/api/journal.py. Database-only.
  getJournal: (holdingId?: string) =>
    request<Journal>("/journal", { query: holdingId ? { holding_id: holdingId } : undefined }),
  createJournalEntry: (input: JournalEntryInput) =>
    request<JournalEntry>("/journal", { method: "POST", body: JSON.stringify(input) }),
  updateJournalEntry: (id: string, input: JournalEntryUpdate) =>
    request<JournalEntry>(`/journal/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteJournalEntry: (id: string) =>
    request<void>(`/journal/${id}`, { method: "DELETE", query: { confirm: true } }),

  /** F4 — configuration, data freshness and failures. Never calls a provider. */
  getSystemStatus: () => request<SystemStatus>("/system/status"),

  /** Demo mode (2026-09-26) — backend/app/api/settings.py. Turning it on
   * makes every page show a fixed set of fabricated data; real portfolio
   * data, documents and research are never read while it is on. */
  getDemoMode: () => request<DemoModeState>("/settings/demo-mode"),
  setDemoMode: (enabled: boolean) =>
    request<DemoModeState>("/settings/demo-mode", {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    }),

  /** F3 — every owned equity ranked by margin of safety. */
  getMarginOfSafetyBoard: () => request<MarginOfSafetyBoard>("/valuation/board"),

  // Primary sources (2026-09-22) — see backend/app/api/sources.py.
  getSourceEligibility: (holdingId: string) =>
    request<SourceEligibility>(`/sources/holdings/${holdingId}`),
  getEdgarImport: (holdingId: string) =>
    request<EdgarImport>(`/sources/holdings/${holdingId}/sec-edgar`),
  importFromEdgar: (holdingId: string) =>
    request<EdgarImport>(`/sources/holdings/${holdingId}/sec-edgar/import`, { method: "POST" }),
  getEsefImport: (holdingId: string) =>
    request<EsefImport>(`/sources/holdings/${holdingId}/esef-index`),
  importFromEsefIndex: (holdingId: string, lei: string | null) =>
    request<EsefImport>(`/sources/holdings/${holdingId}/esef-index/import`, {
      method: "POST",
      body: JSON.stringify({ lei: lei || null }),
    }),
  getAnnouncements: (holdingId: string) =>
    request<HoldingAnnouncements>(`/sources/holdings/${holdingId}/announcements`),
  refreshAnnouncements: (holdingId: string) =>
    request<HoldingAnnouncements>(`/sources/holdings/${holdingId}/announcements/refresh`, {
      method: "POST",
    }),
  getNewswebAnnualReports: (holdingId: string) =>
    request<NewswebAnnualReports>(`/sources/holdings/${holdingId}/newsweb-annual-report`),
  importNewswebAnnualReports: (holdingId: string) =>
    request<NewswebAnnualReports>(`/sources/holdings/${holdingId}/newsweb-annual-report/import`, {
      method: "POST",
    }),
  getNewswebInterimReports: (holdingId: string) =>
    request<NewswebAnnualReports>(`/sources/holdings/${holdingId}/newsweb-interim-report`),
  importNewswebInterimReports: (holdingId: string) =>
    request<NewswebAnnualReports>(`/sources/holdings/${holdingId}/newsweb-interim-report/import`, {
      method: "POST",
    }),

  // Analysis (Sprint 4 + F2) — see backend/app/api/analysis.py. GET returns
  // the latest stored run (404 before the first one); POST .../run always
  // spends real LLM quota; readiness never does.
  getLatestAnalysis: (holdingId: string) =>
    request<AnalysisRun>(`/analysis/holdings/${holdingId}`),
  runAnalysis: (holdingId: string) =>
    request<AnalysisRun>(`/analysis/holdings/${holdingId}/run`, { method: "POST" }),
  // Sprint 5B: "Run on my PC" only queues; the local worker runs it.
  queueAnalysis: (holdingId: string) =>
    request<QueuedRun>(`/analysis/holdings/${holdingId}/queue`, { method: "POST" }),
  getAnalysisQueue: () => request<AnalysisQueue>("/analysis/queue"),
  queueReadyHoldings: () =>
    request<QueueReadyHoldingsResult>("/analysis/queue/ready-holdings", { method: "POST" }),
  cancelAnalysisRun: (runId: string) =>
    request<QueuedRun>(`/analysis/runs/${runId}/cancel`, { method: "POST" }),
  getAnalysisReadiness: (holdingId: string) =>
    request<AnalysisReadiness>(`/analysis/holdings/${holdingId}/readiness`),
  // Sprint 8: fund / ETF facts — see backend/app/api/funds.py. Figures are
  // typed in (each citing an uploaded document) or imported from a holdings
  // file; never read out of a PDF by an LLM.
  getFundFacts: (holdingId: string) => request<FundFacts>(`/funds/${holdingId}`),
  saveFundProfile: (holdingId: string, input: FundProfileInput) =>
    request<FundFacts>(`/funds/${holdingId}/profile`, { method: "PUT", body: JSON.stringify(input) }),
  saveFundReturns: (holdingId: string, rows: FundReturn[]) =>
    request<FundFacts>(`/funds/${holdingId}/returns`, { method: "PUT", body: JSON.stringify(rows) }),
  saveFundExposures: (
    holdingId: string,
    dimension: FundDimension,
    input: { as_of_date: string; source_document_id: string; rows: FundExposureRowInput[] },
  ) =>
    request<FundFacts>(`/funds/${holdingId}/exposures/${dimension}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  setFundHoldingLink: (holdingId: string, exposureId: string, linkedHoldingId: string | null) =>
    request<FundFacts>(`/funds/${holdingId}/exposures/${exposureId}/link`, {
      method: "PATCH",
      body: JSON.stringify({ linked_holding_id: linkedHoldingId }),
    }),
  importFundHoldings: (holdingId: string, file: File, asOfDate?: string) => {
    const form = new FormData();
    form.set("file", file);
    if (asOfDate) form.set("as_of_date", asOfDate);
    return request<HoldingsImportResult>(`/funds/${holdingId}/holdings/import`, { method: "POST", body: form });
  },
  getAnalysisNotes: (holdingId: string) =>
    request<HoldingNote>(`/analysis/holdings/${holdingId}/notes`),
  saveAnalysisNotes: (holdingId: string, content: string) =>
    request<HoldingNote>(`/analysis/holdings/${holdingId}/notes`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),

  // Thesis tracking (Sprint 11) — backend/app/api/thesis.py. Everything
  // here is database-only: no LLM call, no live market-data provider.
  getThesisMetrics: () => request<MetricDef[]>("/thesis/metrics"),
  getHoldingThesis: (holdingId: string) => request<HoldingThesis>(`/thesis/holdings/${holdingId}`),
  createTripwire: (holdingId: string, input: TripwireCreateInput) =>
    request<Tripwire>(`/thesis/holdings/${holdingId}/tripwires`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateTripwire: (tripwireId: string, input: TripwireUpdateInput) =>
    request<Tripwire>(`/thesis/tripwires/${tripwireId}`, { method: "PATCH", body: JSON.stringify(input) }),
  acknowledgeTripwire: (tripwireId: string) =>
    request<Tripwire>(`/thesis/tripwires/${tripwireId}/acknowledge`, { method: "POST" }),
  deleteTripwire: (tripwireId: string) =>
    request<void>(`/thesis/tripwires/${tripwireId}`, { method: "DELETE", query: { confirm: true } }),
  getThesisMonitor: () => request<ThesisMonitor>("/thesis/monitor"),

  // Portfolio risk (Sprint 12) — backend/app/api/risk.py. Correlation,
  // correlated-cluster flags, stress scenarios and macro regime.
  getPortfolioRisk: () => request<PortfolioRisk>("/risk/portfolio"),
  refreshPortfolioRisk: () => request<PortfolioRisk>("/risk/portfolio/refresh", { method: "POST" }),

  // Portfolio performance (Sprint 13) — backend/app/api/performance.py.
  // Daily value history + benchmark comparison, reindexed from today's
  // positions (see the service module's docstring for the method).
  getPortfolioPerformance: (opts?: { lookbackDays?: number; benchmark?: string }) =>
    request<PortfolioPerformance>("/performance/portfolio", {
      query: { lookback_days: opts?.lookbackDays?.toString(), benchmark: opts?.benchmark },
    }),
  refreshPortfolioPerformance: (opts?: { lookbackDays?: number; benchmark?: string }) =>
    request<PortfolioPerformance>("/performance/portfolio/refresh", {
      method: "POST",
      query: { lookback_days: opts?.lookbackDays?.toString(), benchmark: opts?.benchmark },
    }),

  // Precious metals (2026-09-26) -- backend/app/api/precious_metals.py.
  // Physical 1oz gold/silver coins, valued at gold-api.com spot in NOK.
  getCoinSeries: () => request<CoinSeries[]>("/precious-metals/coin-series"),
  getPreciousMetalsOverview: () => request<PreciousMetalsOverview>("/precious-metals/overview"),
  refreshPreciousMetalsOverview: () =>
    request<PreciousMetalsOverview>("/precious-metals/overview/refresh", { method: "POST" }),
  getMetalPriceHistory: (metal: "gold" | "silver", days?: number) =>
    request<MetalPriceHistory>(`/precious-metals/price-history/${metal}`, { query: { days: days?.toString() } }),
  addMetalHolding: (input: PreciousMetalHoldingCreateInput) =>
    request<MetalHoldingRow>("/precious-metals", { method: "POST", body: JSON.stringify(input) }),
  updateMetalHolding: (id: string, input: PreciousMetalHoldingUpdateInput) =>
    request<MetalHoldingRow>(`/precious-metals/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  removeMetalHolding: (id: string) =>
    request<void>(`/precious-metals/${id}`, { method: "DELETE" }),
};
