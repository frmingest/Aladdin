import { useEffect, useState } from "react";
import { getHoldingAnalysis, listHoldingAnalyses, listHoldings } from "../../services/api";
import FactorProfileChart, { type FactorProfilePoint } from "../../charts/FactorProfileChart";
import InfoTooltip from "../../components/InfoTooltip";

const SECTION_EXPLANATION =
  "Each holding's most recent AI analysis, scored 1-10 on business quality, financial strength, and valuation. It's a fundamentals check that sits alongside the numbers-only risk metrics elsewhere on this page — a stock can look fine on concentration and correlation while still resting on a weak business or an expensive valuation.";

/**
 * Factor profile (architecture §19 "Factor profile — business/financial/
 * valuation/macro assessment", §12). One bar-group per holding using each
 * holding's most recent completed analysis (§26 Phase 3) — holdings never
 * analyzed are simply omitted (§21: no basis for a score isn't the same as
 * a score of zero).
 */
export default function FactorProfileSection({ accountIds }: { accountIds: string[] }) {
  const [points, setPoints] = useState<FactorProfilePoint[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPoints(null);
    listHoldings(accountIds)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountIds.join(",")]);

  return (
    <section className="terminal-card">
      <h2 className="terminal-card-title mb-3 flex items-center gap-2">
        Factor profile
        <InfoTooltip text={SECTION_EXPLANATION} />
      </h2>
      {points === null ? <p className="text-sm text-tertiary">Loading…</p> : <FactorProfileChart data={points} />}
    </section>
  );
}
