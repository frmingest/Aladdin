/**
 * Illustrative reference bands for the portfolio risk heatmap (architecture
 * §19 "Portfolio risk heatmap — risk dimensions at a glance").
 *
 * `PortfolioRiskSnapshotOut` (§26 Phase 5) does not expose the per-dimension
 * LOW/MODERATE/MODERATE-HIGH/HIGH bands the backend computes internally
 * (app.domain.portfolio_risk.score_dimension) — only the raw metrics plus
 * one overall `risk_band` (the worst dimension) and `composite_risk_score`.
 * Re-deriving the app's own versioned scoring thresholds here would
 * duplicate business logic the backend already owns (scoring/versions/
 * risk_v1.yaml) and risk silently drifting out of sync with it.
 *
 * These bands are deliberately NOT that: they're well-known public
 * reference conventions — cited in app.domain.calculations.
 * herfindahl_hirschman_index's own docstring for HHI (US DOJ/FTC
 * merger-guideline convention) and standard statistics texts for
 * correlation strength — used only to color this "at a glance" grid. The
 * dashboard always shows the snapshot's own authoritative `risk_band` and
 * `composite_risk_score` alongside it as the real assessment (§19: "a
 * single composite risk gauge may exist, but should not dominate").
 */

export type ReferenceBand = "LOW" | "MODERATE" | "HIGH";

export function hhiReferenceBand(hhi: number | null): ReferenceBand | null {
  if (hhi === null) return null;
  if (hhi < 1500) return "LOW";
  if (hhi <= 2500) return "MODERATE";
  return "HIGH";
}

export function percentReferenceBand(pct: number | null, moderateAt = 20, highAt = 40): ReferenceBand | null {
  if (pct === null) return null;
  const magnitude = Math.abs(pct);
  if (magnitude < moderateAt) return "LOW";
  if (magnitude <= highAt) return "MODERATE";
  return "HIGH";
}

export function correlationReferenceBand(r: number | null): ReferenceBand | null {
  if (r === null) return null;
  const magnitude = Math.abs(r);
  if (magnitude < 0.3) return "LOW";
  if (magnitude <= 0.6) return "MODERATE";
  return "HIGH";
}
