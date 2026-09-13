import { useEffect, useState } from "react";
import { ApiError, createPortfolioRiskSnapshot, listPortfolioRiskSnapshots } from "../../services/api";
import type { PortfolioRiskSnapshotOut } from "../../types/portfolio_risk";
import { num } from "../../lib/num";
import { bandColor } from "../../charts/palette";
import RiskHeatmap, { type RiskCell } from "../../charts/RiskHeatmap";
import { correlationReferenceBand, hhiReferenceBand, percentReferenceBand } from "../../charts/referenceBands";
import ScenarioImpactChart, { type ScenarioImpactPoint } from "../../charts/ScenarioImpactChart";

function buildHeatmapCells(snapshot: PortfolioRiskSnapshotOut): RiskCell[] {
  const singleNameHhi = num(snapshot.concentration.single_name_hhi);
  const sectorHhi = num(snapshot.concentration.sector_hhi);
  const currencyExposure = num(snapshot.exposure.currency_exposure_pct);
  const commodityExposure = num(snapshot.exposure.commodity_exposure_pct);
  const correlation = num(snapshot.correlation.average_pairwise_correlation);
  const depositsOverGuarantee = num(snapshot.systemic_state_risk.deposits_over_guarantee_limit_pct);

  const cells: RiskCell[] = [
    { dimension: "single_name_concentration", band: hhiReferenceBand(singleNameHhi), detail: singleNameHhi !== null ? `HHI ${singleNameHhi.toFixed(0)}` : undefined },
    { dimension: "sector_concentration", band: hhiReferenceBand(sectorHhi), detail: sectorHhi !== null ? `HHI ${sectorHhi.toFixed(0)}` : undefined },
    { dimension: "currency_exposure", band: percentReferenceBand(currencyExposure), detail: currencyExposure !== null ? `${currencyExposure.toFixed(1)}% outside reporting ccy` : undefined },
    { dimension: "commodity_exposure", band: percentReferenceBand(commodityExposure), detail: commodityExposure !== null ? `${commodityExposure.toFixed(1)}%` : undefined },
    { dimension: "correlation", band: correlationReferenceBand(correlation), detail: correlation !== null ? `avg r ${correlation.toFixed(2)}` : undefined },
    { dimension: "systemic_state_risk", band: percentReferenceBand(depositsOverGuarantee), detail: depositsOverGuarantee !== null ? `${depositsOverGuarantee.toFixed(1)}% over guarantee` : undefined },
  ];
  return cells.filter((c) => c.band !== null);
}

function buildScenarioImpacts(snapshot: PortfolioRiskSnapshotOut): ScenarioImpactPoint[] {
  return Object.values(snapshot.scenario)
    .map((s) => ({ label: s.label, impact_pct: num(s.estimated_portfolio_impact_pct) }))
    .filter((s): s is ScenarioImpactPoint => s.impact_pct !== null)
    .sort((a, b) => a.impact_pct - b.impact_pct);
}

/**
 * Portfolio risk (architecture §19 "Portfolio risk heatmap", "Scenario
 * impact"; §15, §15.1, §18, §26 Phase 5). Computing a fresh snapshot
 * re-values the portfolio and pulls historical prices for correlation, so
 * it's a manual trigger; reading the latest existing one on mount is free
 * (§2.7 — reading never costs a provider call).
 */
export default function RiskSection({ snapshotId }: { snapshotId: string }) {
  const [snapshot, setSnapshot] = useState<PortfolioRiskSnapshotOut | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSnapshot(null);
    listPortfolioRiskSnapshots(snapshotId)
      .then((rows) => setSnapshot(rows[0] ?? null))
      .catch(() => undefined);
  }, [snapshotId]);

  async function handleCompute() {
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await createPortfolioRiskSnapshot(snapshotId));
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail ?? err.message) : "Risk snapshot computation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-lg font-semibold">Portfolio risk</h2>
        <button
          onClick={handleCompute}
          disabled={loading}
          className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 rounded px-3 py-1 text-xs font-medium"
        >
          {loading ? "Computing…" : "Compute new risk snapshot"}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
      {!snapshot && !loading && <p className="text-sm text-slate-500">No risk snapshot yet for this portfolio.</p>}

      {snapshot && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span
              className="rounded px-3 py-1 text-sm font-semibold"
              style={{ backgroundColor: `${bandColor(snapshot.risk_band)}26`, color: bandColor(snapshot.risk_band) }}
            >
              Overall: {snapshot.risk_band}
            </span>
            {snapshot.composite_risk_score !== null && (
              <span className="text-xs text-slate-500">composite score {snapshot.composite_risk_score}/100</span>
            )}
            <span className="text-xs text-slate-600">
              as of {new Date(snapshot.created_at).toLocaleString()}
            </span>
          </div>

          <p className="text-sm text-slate-300">{snapshot.narrative}</p>

          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-2">Risk dimensions</h3>
            <RiskHeatmap
              cells={buildHeatmapCells(snapshot)}
              footnote="Bands here are standard reference conventions (US DOJ/FTC HHI thresholds; common correlation-strength ranges) used only to shade this grid — not the app's own versioned risk-scoring thresholds. The overall band and composite score above are the authoritative assessment."
            />
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-2">Scenario impact</h3>
            <ScenarioImpactChart data={buildScenarioImpacts(snapshot)} />
          </div>

          {snapshot.systemic_state_risk.wealth_tax_estimate && (
            <div className="bg-slate-900 rounded p-3 text-sm">
              <h3 className="text-xs uppercase text-slate-500 mb-1">Estimated Norwegian wealth tax</h3>
              <p>
                {snapshot.systemic_state_risk.wealth_tax_estimate.estimated_tax} NOK on a taxable base of{" "}
                {snapshot.systemic_state_risk.wealth_tax_estimate.taxable_base} NOK (
                {snapshot.systemic_state_risk.wealth_tax_estimate.rate_pct}%).
              </p>
            </div>
          )}

          {snapshot.systemic_state_risk.deposit_exposures.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-2">Deposit concentration by institution</h3>
              <table className="text-sm w-full">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="text-left font-medium py-1">Institution</th>
                    <th className="text-right font-medium py-1">Value</th>
                    <th className="text-right font-medium py-1">Over guarantee</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.systemic_state_risk.deposit_exposures.map((d) => (
                    <tr key={d.institution} className="border-t border-slate-900">
                      <td className="py-1">{d.institution}</td>
                      <td className="text-right py-1">{d.value_reporting_ccy}</td>
                      <td className="text-right py-1">
                        {Number(d.excess_over_guarantee) > 0 ? (
                          <span className="text-amber-400">{d.excess_over_guarantee}</span>
                        ) : (
                          <span className="text-slate-500">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {snapshot.systemic_state_risk.warnings.length > 0 && (
            <ul className="text-xs text-amber-400 list-disc list-inside">
              {snapshot.systemic_state_risk.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
