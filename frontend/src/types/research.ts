// Mirrors backend/app/schemas/research.py (architecture §9, §26 Phase 4).

export type MacroObservationOut = {
  series_key: string;
  value: string; // Decimal -> JSON string; see market_valuation.ts's note
  unit: string;
  region: string;
  provider: string;
  observed_at: string;
};

export type ResearchItemOut = {
  title: string;
  summary: string;
  source_name: string;
  source_url: string;
  published_at: string | null;
  retrieved_at: string;
};

export type MacroSnapshotOut = {
  available: boolean;
  as_of: string | null;
  observations: MacroObservationOut[];
  narrative_items: ResearchItemOut[];
  reason: string | null;
};

export type SectorResearchOut = {
  available: boolean;
  sector: string;
  as_of: string | null;
  items: ResearchItemOut[];
  reason: string | null;
};

export type ResearchRunOut = {
  id: string;
  type: string;
  sector: string | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  methodology_version: string;
  item_count: number;
  error_message: string | null;
};
