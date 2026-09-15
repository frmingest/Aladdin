/**
 * Thin fetch wrapper for the Phase 1 endpoints. Routes go through /api,
 * which Vite's dev proxy strips before forwarding to the backend (see
 * vite.config.ts) — matches the pattern already established for /health.
 *
 * In production, where frontend and backend can be separate origins (e.g.
 * two Railway services — see docs/decisions/0010), VITE_API_BASE_URL is set
 * at build time to the backend's own origin (no /api suffix — the backend
 * mounts every route unprefixed, same as what the dev proxy forwards to).
 */

import type {
  Account,
  AccountCreate,
  AccountUpdate,
  Holding,
  ManualPositionCreate,
  ManualPositionResponse,
  PortfolioResetResponse,
  PortfolioSnapshotDetail,
  PortfolioSnapshotSummary,
  PortfolioUploadResponse,
} from "../types/portfolio";
import type { DocumentDetail, DocumentSummary, DocumentUploadResponse } from "../types/document";
import type { AnalysisRunDetail, HoldingAnalysisDetail, HoldingAnalysisSummary } from "../types/analysis";
import type { PortfolioValuationOut } from "../types/market_valuation";
import type { PortfolioRiskSnapshotOut } from "../types/portfolio_risk";
import type { InvalidationSignalOut, ThesisCreate, ThesisOut, ThesisUpdate } from "../types/thesis";
import type { ValuationCaseCreate, ValuationCaseOut, ValuationDefaults } from "../types/dcf";
import type { MacroSnapshotOut, ResearchRunOut, SectorResearchOut } from "../types/research";
import type { UsageSummaryOut } from "../types/usage";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";
// Paired with the backend's optional APP_AUTH_TOKEN (see
// backend/app/api/auth.py) — unset in local dev, where auth is disabled.
const API_KEY = import.meta.env.VITE_API_KEY;

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(typeof detail === "string" ? detail : JSON.stringify(detail));
    this.status = status;
    this.detail = detail;
  }
}

function withAuthHeaders(init?: RequestInit): RequestInit | undefined {
  if (!API_KEY) return init;
  return { ...init, headers: { ...init?.headers, "X-API-Key": API_KEY } };
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, withAuthHeaders(init));
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body?.detail ?? body);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function accountIdsQuery(accountIds?: string[]): string {
  if (!accountIds || accountIds.length === 0) return "";
  return "?" + accountIds.map((id) => `account_id=${encodeURIComponent(id)}`).join("&");
}

export function listHoldings(accountIds?: string[]): Promise<Holding[]> {
  return apiFetch(`/portfolio/holdings${accountIdsQuery(accountIds)}`);
}

// Sets a holding's market_ticker (§26 Phase 2) — required before it can be
// priced by "Refresh valuation"; see the "Market data tickers" section of
// the Portfolio tab. Passing null/empty clears it back to unset.
export function updateHoldingMarketTicker(holdingId: string, marketTicker: string | null): Promise<Holding> {
  return apiFetch(`/portfolio/holdings/${holdingId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ market_ticker: marketTicker }),
  });
}

export function listSnapshots(accountId?: string): Promise<PortfolioSnapshotSummary[]> {
  const qs = accountId ? `?account_id=${encodeURIComponent(accountId)}` : "";
  return apiFetch(`/portfolio/snapshots${qs}`);
}

export function uploadPortfolio(
  file: File,
  reportingCurrency?: string,
  accountId?: string,
): Promise<PortfolioUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  if (reportingCurrency) form.append("reporting_currency", reportingCurrency);
  if (accountId) form.append("account_id", accountId);
  return apiFetch("/portfolio/upload", { method: "POST", body: form });
}

// One-off entry of a single holding with no CSV/XLSX upload — e.g. a single
// gold or silver coin purchase (Phase 8, ADR 0011). Set market_ticker to
// "XAU"/"XAG" for live gold/silver pricing; leave it unset for collectibles
// (e.g. whisky bought outside a Whiskybase export), which are valued at
// cost basis instead. See the "Add a holding manually" section of the
// Portfolio tab.
export function addManualHolding(body: ManualPositionCreate): Promise<ManualPositionResponse> {
  return apiFetch("/portfolio/holdings/manual", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// --- Accounts (§26 accounts feature) ----------------------------------------

export function listAccounts(): Promise<Account[]> {
  return apiFetch("/accounts");
}

export function createAccount(body: AccountCreate): Promise<Account> {
  return apiFetch("/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function updateAccount(id: string, body: AccountUpdate): Promise<Account> {
  return apiFetch(`/accounts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function deleteAccount(id: string): Promise<void> {
  return apiFetch(`/accounts/${id}`, { method: "DELETE" });
}

export function getSnapshot(id: string): Promise<PortfolioSnapshotDetail> {
  return apiFetch(`/portfolio/snapshots/${id}`);
}

// Irreversible: wipes every holding, snapshot, uploaded file, and everything
// derived from them (see backend/app/services/portfolio/reset.py).
export function resetPortfolio(): Promise<PortfolioResetResponse> {
  return apiFetch("/portfolio/reset?confirm=true", { method: "DELETE" });
}

export function listDocuments(holdingId?: string): Promise<DocumentSummary[]> {
  const qs = holdingId ? `?holding_id=${encodeURIComponent(holdingId)}` : "";
  return apiFetch(`/documents${qs}`);
}

export function uploadDocument(params: {
  file: File;
  holdingId: string;
  documentType: string;
  reportingPeriod?: string;
}): Promise<DocumentUploadResponse> {
  const form = new FormData();
  form.append("file", params.file);
  form.append("holding_id", params.holdingId);
  form.append("document_type", params.documentType);
  if (params.reportingPeriod) form.append("reporting_period", params.reportingPeriod);
  return apiFetch("/documents/upload", { method: "POST", body: form });
}

export function getDocument(id: string): Promise<DocumentDetail> {
  return apiFetch(`/documents/${id}`);
}

export function createAnalysisRun(
  snapshotId: string,
  holdingIds?: string[],
): Promise<AnalysisRunDetail> {
  return apiFetch(`/analysis/snapshots/${snapshotId}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ holding_ids: holdingIds ?? null }),
  });
}

export function getAnalysisRun(id: string): Promise<AnalysisRunDetail> {
  return apiFetch(`/analysis/runs/${id}`);
}

export function listHoldingAnalyses(holdingId: string): Promise<HoldingAnalysisSummary[]> {
  return apiFetch(`/analysis/holdings/${holdingId}/analyses`);
}

export function getHoldingAnalysis(id: string): Promise<HoldingAnalysisDetail> {
  return apiFetch(`/analysis/holding-analyses/${id}`);
}

export async function getHoldingAnalysisMemo(id: string): Promise<string> {
  const response = await fetch(`${API_BASE}/analysis/holding-analyses/${id}/memo`, withAuthHeaders());
  if (!response.ok) {
    throw new ApiError(response.status, await response.text().catch(() => null));
  }
  return response.text();
}

// --- Phase 2/5 — market valuation & portfolio risk (§26) -------------------

export function refreshSnapshotValuation(
  snapshotId: string,
  accountIds?: string[],
): Promise<PortfolioValuationOut> {
  return apiFetch(`/portfolio/snapshots/${snapshotId}/valuation${accountIdsQuery(accountIds)}`, {
    method: "POST",
  });
}

export function createPortfolioRiskSnapshot(
  snapshotId: string,
  accountIds?: string[],
): Promise<PortfolioRiskSnapshotOut> {
  return apiFetch(`/portfolio/snapshots/${snapshotId}/risk-snapshot${accountIdsQuery(accountIds)}`, {
    method: "POST",
  });
}

export function listPortfolioRiskSnapshots(snapshotId: string): Promise<PortfolioRiskSnapshotOut[]> {
  return apiFetch(`/portfolio/snapshots/${snapshotId}/risk-snapshots`);
}

export function getPortfolioRiskSnapshot(id: string): Promise<PortfolioRiskSnapshotOut> {
  return apiFetch(`/portfolio/risk-snapshots/${id}`);
}

// --- Phase 5 — thesis ledger (§16) ------------------------------------------

export function listHoldingTheses(holdingId: string): Promise<ThesisOut[]> {
  return apiFetch(`/thesis/holdings/${holdingId}`);
}

export function createHoldingThesis(holdingId: string, body: ThesisCreate): Promise<ThesisOut> {
  return apiFetch(`/thesis/holdings/${holdingId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function updateThesis(thesisId: string, body: ThesisUpdate): Promise<ThesisOut> {
  return apiFetch(`/thesis/${thesisId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function getInvalidationCheck(thesisId: string): Promise<InvalidationSignalOut> {
  return apiFetch(`/thesis/${thesisId}/invalidation-check`);
}

// --- Phase 5 — DCF valuation cases (§17) ------------------------------------

// ECON-001 fix (docs/decisions/0014) — a suggested discount_rate_pct/
// fx_rate_to_reporting anchored in macro/FX data the app already fetches.
export function getHoldingValuationDefaults(holdingId: string): Promise<ValuationDefaults> {
  return apiFetch(`/valuation/holdings/${holdingId}/defaults`);
}

export function listHoldingValuationCases(holdingId: string): Promise<ValuationCaseOut[]> {
  return apiFetch(`/valuation/holdings/${holdingId}/cases`);
}

export function createHoldingValuationCase(
  holdingId: string,
  body: ValuationCaseCreate,
): Promise<ValuationCaseOut> {
  return apiFetch(`/valuation/holdings/${holdingId}/cases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// --- Phase 4 — external research (§9) ---------------------------------------

export function getMacroSnapshot(): Promise<MacroSnapshotOut> {
  return apiFetch("/research/macro/snapshot");
}

export function refreshMacroSnapshot(force = false): Promise<ResearchRunOut> {
  return apiFetch(`/research/macro/refresh?force=${force}`, { method: "POST" });
}

export function listKnownSectors(): Promise<string[]> {
  return apiFetch("/research/sectors");
}

export function getSectorResearch(sector: string): Promise<SectorResearchOut> {
  return apiFetch(`/research/sectors/${encodeURIComponent(sector)}/items`);
}

export function refreshSectorResearch(sector: string, force = false): Promise<ResearchRunOut> {
  return apiFetch(`/research/sectors/${encodeURIComponent(sector)}/refresh?force=${force}`, { method: "POST" });
}

// --- LLM usage ledger (§28 observability follow-up, ADR 0013) --------------

export function getUsageSummary(): Promise<UsageSummaryOut> {
  return apiFetch("/usage/summary");
}
