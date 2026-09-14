import { useState } from "react";
import { getHoldingAnalysisMemo } from "../services/api";
import type { HoldingAnalysisDetail as HoldingAnalysisDetailType } from "../types/analysis";

/**
 * Shared per-security analysis detail rendering — the "full results" view a
 * completed AI analysis run produces for one holding: executive summary,
 * business quality / financial strength / valuation factor breakdown, key
 * strengths/risks, blind-vs-thesis divergence, and any insufficient-evidence
 * flags, plus an on-demand Markdown memo.
 *
 * Originally lived only in Analysis.tsx (shown right after triggering a new
 * run). Extracted so the same view can also be dropped into the Dashboard's
 * HoldingDetailSection (bottom section) against whatever analysis is already
 * on record, without duplicating the JSX or drifting the two copies apart.
 */

export function ScorePill({ score }: { score: string | number | null }) {
  if (score === null) return <span className="text-tertiary">n/a</span>;
  const numericScore = Number(score);
  const className =
    numericScore >= 7 ? "score-indicator score-excellent" : numericScore >= 5 ? "score-indicator score-fair" : "score-indicator score-poor";
  return <span className={className}>{score}/10</span>;
}

export function FactorRow({ label, factor }: { label: string; factor: { score: number; confidence: string; reasoning: string } }) {
  return (
    <div className="border-b border-secondary py-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium text-primary">{label}</span>
        <ScorePill score={factor.score} />
        <span className="text-xs text-tertiary">({factor.confidence} confidence)</span>
      </div>
      <p className="text-sm text-secondary">{factor.reasoning}</p>
    </div>
  );
}

/** The full breakdown for one completed analysis — executive summary through
 * insufficient-evidence flags. Pure/presentational: takes the detail object
 * a caller has already fetched. */
export function HoldingAnalysisFullDetail({ detail }: { detail: HoldingAnalysisDetailType }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-secondary">{detail.structured_output.executive_summary}</p>

      <div>
        <FactorRow label="Business Quality" factor={detail.structured_output.business_quality} />
        <FactorRow label="Financial Strength" factor={detail.structured_output.financial_strength} />
        <FactorRow label="Valuation" factor={detail.structured_output.valuation} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <h4 className="stat-label mb-1">Key Strengths</h4>
          <ul className="text-sm list-disc list-inside text-secondary">
            {detail.structured_output.key_strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="stat-label mb-1">Key Risks</h4>
          <ul className="text-sm list-disc list-inside text-secondary">
            {detail.structured_output.key_risks.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-tertiary rounded-lg p-3">
        <h4 className="stat-label mb-1">Thesis Divergence (blind vs. your notes)</h4>
        <p className="text-sm text-secondary">
          <span className="text-tertiary">Blind:</span> {detail.structured_output.thesis_divergence.blind_assessment_summary}
        </p>
        <p className="text-sm text-secondary">
          <span className="text-tertiary">Your notes:</span> {detail.structured_output.thesis_divergence.user_thesis_summary}
        </p>
        <p className="text-sm mt-1">
          <span className={detail.structured_output.thesis_divergence.material_disagreement ? "text-warning" : "text-positive"}>
            {detail.structured_output.thesis_divergence.material_disagreement ? "Material disagreement" : "No material disagreement"}
          </span>
          {" — "}
          <span className="text-secondary">{detail.structured_output.thesis_divergence.disagreement_notes}</span>
        </p>
      </div>

      {detail.structured_output.insufficient_evidence_areas.length > 0 && (
        <div>
          <h4 className="stat-label mb-1">Insufficient Evidence</h4>
          <ul className="text-sm list-disc list-inside text-warning">
            {detail.structured_output.insufficient_evidence_areas.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-disabled">{detail.evidence_references.length} evidence reference(s) cited.</p>
    </div>
  );
}

/** Full detail plus an on-demand Markdown memo toggle — the "Memo" button
 * behavior Analysis.tsx originally had, generalized so any caller that
 * already has a HoldingAnalysisDetail on hand (no need to re-fetch it) can
 * offer the memo alongside it. */
export function HoldingAnalysisFullDetailWithMemo({ detail }: { detail: HoldingAnalysisDetailType }) {
  const [memo, setMemo] = useState<string | null>(null);
  const [showMemo, setShowMemo] = useState(false);
  const [loadingMemo, setLoadingMemo] = useState(false);

  async function toggleMemo() {
    if (showMemo) {
      setShowMemo(false);
      return;
    }
    if (!memo) {
      setLoadingMemo(true);
      try {
        setMemo(await getHoldingAnalysisMemo(detail.id));
      } finally {
        setLoadingMemo(false);
      }
    }
    setShowMemo(true);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="stat-label">Full analysis</h4>
        <button type="button" onClick={toggleMemo} className="text-xs text-accent hover:underline">
          {loadingMemo ? "Loading…" : showMemo ? "Hide memo" : "Memo"}
        </button>
      </div>
      <HoldingAnalysisFullDetail detail={detail} />
      {showMemo && (
        <pre className="bg-tertiary rounded-lg p-3 text-xs text-secondary whitespace-pre-wrap">{memo ?? "Loading…"}</pre>
      )}
    </div>
  );
}
