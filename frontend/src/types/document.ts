export const DOCUMENT_TYPES = [
  "ANNUAL_REPORT",
  "QUARTERLY_REPORT",
  "PRESENTATION",
  "OTHER",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export type DocumentPage = {
  page_number: number;
  extraction_quality: string;
  text_preview: string;
};

export type FinancialLineItem = {
  metric: string;
  value: number;
  unit: string;
  currency: string | null;
  period: string;
  source_page: number | null;
  confidence: number;
};

export type DocumentSummary = {
  id: string;
  holding_id: string | null;
  type: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
  reporting_period: string | null;
  sha256: string;
  status: string;
  quality_flags: string[];
  page_count: number;
  fact_count: number;
};

export type DocumentDetail = DocumentSummary & {
  pages: DocumentPage[];
  facts: FinancialLineItem[];
};

export type DocumentUploadResponse = {
  document: DocumentDetail;
  was_duplicate_file: boolean;
};
