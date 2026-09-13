/**
 * Thin fetch wrapper for the Phase 1 endpoints. Routes go through /api,
 * which Vite's dev proxy strips before forwarding to the backend (see
 * vite.config.ts) — matches the pattern already established for /health.
 */

import type {
  Holding,
  PortfolioSnapshotDetail,
  PortfolioSnapshotSummary,
  PortfolioUploadResponse,
} from "../types/portfolio";
import type { DocumentDetail, DocumentSummary, DocumentUploadResponse } from "../types/document";

const API_BASE = "/api";

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(typeof detail === "string" ? detail : JSON.stringify(detail));
    this.status = status;
    this.detail = detail;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body?.detail ?? body);
  }
  return (await response.json()) as T;
}

export function listHoldings(): Promise<Holding[]> {
  return apiFetch("/portfolio/holdings");
}

export function listSnapshots(): Promise<PortfolioSnapshotSummary[]> {
  return apiFetch("/portfolio/snapshots");
}

export function uploadPortfolio(
  file: File,
  reportingCurrency?: string,
): Promise<PortfolioUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  if (reportingCurrency) form.append("reporting_currency", reportingCurrency);
  return apiFetch("/portfolio/upload", { method: "POST", body: form });
}

export function getSnapshot(id: string): Promise<PortfolioSnapshotDetail> {
  return apiFetch(`/portfolio/snapshots/${id}`);
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
