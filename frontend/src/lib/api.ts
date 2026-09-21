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
  CompanyResearch,
  DocumentSummary,
  Holding,
  HoldingCreateInput,
  HoldingFieldOptions,
  HoldingMetrics,
  HoldingUpdateInput,
  HoldingValuation,
  MacroResearch,
  PortfolioImportResponse,
  PortfolioSnapshotSummary,
  PortfolioWipeResult,
  SectorResearch,
  SnapshotDeleteResult,
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
  deleteHolding: (id: string) =>
    request<void>(`/holdings/${id}`, { method: "DELETE", query: { confirm: true } }),
  /** Sector / Instrument Type dropdown options for the manual-edit UI —
   * see backend/app/api/holdings.py's `GET /holdings/field-options`. */
  getHoldingFieldOptions: () => request<HoldingFieldOptions>("/holdings/field-options"),

  listHoldingPeriods: (holdingId: string) =>
    request<string[]>(`/holdings/${holdingId}/periods`),
  getHoldingMetrics: (holdingId: string, period: string) =>
    request<HoldingMetrics>(`/holdings/${holdingId}/metrics`, { query: { period } }),

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
  deleteAccount: (id: string) =>
    request<void>(`/accounts/${id}`, { method: "DELETE", query: { confirm: true } }),

  listSnapshots: (accountId?: string) =>
    request<PortfolioSnapshotSummary[]>("/portfolio/snapshots", {
      query: accountId ? { account_id: accountId } : undefined,
    }),
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
};
