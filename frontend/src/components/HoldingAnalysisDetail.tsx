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
 *
 * Redesigned (2026-09-16) to cut down the "wall of text" this view had
 * become: the three factor write-ups (previously always-expanded paragraphs
 * stacked one after another) are now collapsible scorecards — score and
 * confidence stay visible, the written reasoning is a click away — and the
 * executive summary, strengths/risks, and thesis-divergence sections each
 * get their own visual treatment instead of reading as one undifferentiated
 * stream of paragraphs.
 */

const FACTOR_LABELS = {
  business_quality: "Business Quality",
  financial_strength: "Financial Strength",
  valuation: "Valuation",
} as const;

export function ScorePill({ score }: { score: string | number | null }) {
  if (score === null) return <span className="text-tertiary">n/a</span>;
  const numericScore = Number(score);
  const className =
    numericScore >= 7 ? "score-indicator score-excellent" : numericScore >= 5 ? "score-indicator score-fair" : "score-indicator score-poor";
  return <span className={className}>{score}/10</span>;
}

/** One collapsible factor scorecard — label, score, and confidence are
 * always visible; the model's written reasoning opens on click. Starts
 * collapsed so three factors read as a compact scoreboard, not three
 * paragraphs the eye has to wade through before reaching strengths/risks. */
function FactorCard({ label, factor }: { label: string; factor: { score: number; confidence: string; reasoning: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="factor-card">
      <button type="button" className="factor-card-header" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="text-sm font-medium text-primary">{label}</span>
        <ScorePill score={factor.score} />
        <span className="text-xs text-tertiary">{factor.confidence} confidence</span>
        <span className={`factor-card-chevron ${open ? "open" : ""}`}>▶</span>
      </button>
      {open && (
        <div className="factor-card-body">
          <p className="text-sm text-secondary">{factor.reasoning}</p>
        </div>
      )}
    </div>
  );
}

/** The full breakdown for one completed analysis — executive summary through
 * insufficient-evidence flags. Pure/presentational: takes the detail object
 * a caller has already fetched. */
export function HoldingAnalysisFullDetail({ detail }: { detail: HoldingAnalysisDetailType }) {
  const output = detail.structured_output;
  return (
    <div className="space-y-4">
      <div className="callout-lead">
        <p className="text-sm leading-relaxed">{output.executive_summary}</p>
      </div>

      <div>
        <h4 className="stat-label mb-2">Factor scores</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <FactorCard label={FACTOR_LABELS.business_quality} factor={output.business_quality} />
          <FactorCard label={FACTOR_LABELS.financial_strength} factor={output.financial_strength} />
          <FactorCard label={FACTOR_LABELS.valuation} factor={output.valuation} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="terminal-panel">
          <h4 className="stat-label mb-2 text-positive">Key Strengths</h4>
          {output.key_strengths.length === 0 ? (
            <p className="text-sm text-tertiary">None noted.</p>
          ) : (
            <ul className="marker-list marker-positive text-sm text-secondary">
              {output.key_strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="terminal-panel">
          <h4 className="stat-label mb-2 text-negative">Key Risks</h4>
          {output.key_risks.length === 0 ? (
            <p className="text-sm text-tertiary">None noted.</p>
          ) : (
            <ul className="marker-list marker-negative text-sm text-secondary">
              {output.key_risks.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="terminal-panel">
        <h4 className="stat-label mb-2">Thesis Divergence — blind read vs. your notes</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <p className="text-secondary">
            <span className="text-tertiary block mb-0.5">Blind assessment</span>
            {output.thesis_divergence.blind_assessment_summary}
          </p>
          <p className="text-secondary">
            <span className="text-tertiary block mb-0.5">Your notes</span>
            {output.thesis_divergence.user_thesis_summary}
          </p>
        </div>
        <p className="text-sm mt-3 pt-3 border-t border-secondary">
          <span
            className={
              output.thesis_divergence.material_disagreement
                ? "terminal-badge terminal-badge-warning"
                : "terminal-badge terminal-badge-positive"
            }
          >
            {output.thesis_divergence.material_disagreement ? "Material disagreement" : "No material disagreement"}
          </span>
          <span className="text-secondary ml-2">{output.thesis_divergence.disagreement_notes}</span>
        </p>
      </div>

      {output.insufficient_evidence_areas.length > 0 && (
        <div className="terminal-panel terminal-panel-warning">
          <h4 className="stat-label mb-2 text-warning">Insufficient Evidence</h4>
          <ul className="marker-list marker-warning text-sm text-warning">
            {output.insufficient_evidence_areas.map((s, i) => (
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
