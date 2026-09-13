/**
 * Portfolio risk snapshot JSON columns (concentration/correlation/exposure/
 * systemic_state_risk/scenario on PortfolioRiskSnapshotOut) store every
 * Decimal as a string (app.services.portfolio_risk.builder._json_safe
 * converts Decimal -> str before persisting, since JSON columns can't hold
 * Decimal directly) — unlike Pydantic-typed Decimal fields elsewhere in
 * this API (e.g. PortfolioValuationOut), which serialize as JSON numbers.
 * `num()` parses that string form back to a JS number for charting/display;
 * `null`/`undefined` pass through unchanged rather than becoming `NaN`.
 */
export function num(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}
