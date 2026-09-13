import { useEffect, useState } from "react";
import { getHoldingAnalysis, listHoldingAnalyses, listHoldings } from "../../services/api";
import FactorProfileChart, { type FactorProfilePoint } from "../../charts/FactorProfileChart";

/**
 * Factor profile (architecture §19 "Factor profile — business/financial/
 * valuation/macro assessment", §12). One bar-group per holding using each
 * holding's most recent completed analysis (§26 Phase 3) — holdings never
 * analyzed are simply omitted (§21: no basis for a score isn't the same as
 * a score of zero).
 */
export default function FactorProfileSection() {
  const [points, setPoints] = useState<FactorProfilePoint[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listHoldings()
      .then(async (holdings) => {
        const results = await Promise.all(
          holdings.map(async (holding) => {
            const analyses = await listHoldingAnalyses(holding.id).catch(() => []);
            if (analyses.length === 0) return null;
            const detail = await getHoldingAnalysis(analyses[0].id).catch(() => null);
            if (!detail) return null;
            const point: FactorProfilePoint = {
              name: holding.ticker,
              business_quality: detail.structured_output.business_quality.score,
              financial_strength: detail.structured_output.financial_strength.score,
              valuation: detail.structured_output.valuation.score,
            };
            return point;
          }),
        );
        if (!cancelled) setPoints(results.filter((p): p is FactorProfilePoint => p !== null));
      })
      .catch(() => {
        if (!cancelled) setPoints([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Factor profile</h2>
      {points === null ? <p className="text-sm text-slate-500">Loading…</p> : <FactorProfileChart data={points} />}
    </section>
  );
}
