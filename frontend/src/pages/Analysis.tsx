import { useEffect, useState } from "react";
import {
  ApiError,
  createAnalysisRun,
  getHoldingAnalysis,
  getHoldingAnalysisMemo,
  listSnapshots,
} from "../services/api";
import type { PortfolioSnapshotSummary } from "../types/portfolio";
import type { AnalysisRunDetail, HoldingAnalysisDetail, HoldingAnalysisSummary } from "../types/analysis";

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: "text-positive",
  PARTIAL: "text-warning",
  FAILED: "text-negative",
  RUNNING: "text-tertiary",
  QUEUED: "text-tertiary",
};

function ScorePill({ score }: { score: string | number | null }) {
  if (score === null) return <span className="text-tertiary">n/a</span>;
  const numericScore = Number(score);
  const className =
    numericScore >= 7 ? "score-indicator score-excellent" : numericScore >= 5 ? "score-indicator score-fair" : "score-indicator score-poor";
  return <span className={className}>{score}/10</span>;
}

function FactorRow({ label, factor }: { label: string; factor: { score: number; confidence: string; reasoning: string } }) {
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

function HoldingAnalysisPanel({ summary }: { summary: HoldingAnalysisSummary }) {
  const [detail, setDetail] = useState<HoldingAnalysisDetail | null>(null);
  const [memo, setMemo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showMemo, setShowMemo] = useState(false);

  async function toggleDetail() {
    if (detail) {
      setDetail(null);
      setShowMemo(false);
      return;
    }
    setLoading(true);
    try {
      setDetail(await getHoldingAnalysis(summary.id));
    } finally {
      setLoading(false);
    }
  }

  async function toggleMemo() {
    if (showMemo) {
      setShowMemo(false);
      return;
    }
    if (!memo) setMemo(await getHoldingAnalysisMemo(summary.id));
    setShowMemo(true);
  }

  return (
    <div className="terminal-panel mb-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="font-medium text-primary">{summary.name}</span>
          <span className="text-tertiary text-sm font-mono">{summary.ticker}</span>
          <ScorePill score={summary.overall_score} />
          <span className="text-xs text-tertiary">{summary.thesis_status}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={toggleDetail} className="text-xs text-accent hover:underline">
            {detail ? "Hide" : "Details"}
          </button>
          <button onClick={toggleMemo} className="text-xs text-accent hover:underline">
            {showMemo ? "Hide memo" : "Memo"}
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-tertiary mt-2">Loading…</p>}

      {detail && (
        <div className="mt-3 space-y-3">
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
              <span className="text-tertiary">Your notes:</span>{" "}
              {detail.structured_output.thesis_divergence.user_thesis_summary}
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

          <p className="text-xs text-disabled">
            {detail.evidence_references.length} evidence reference(s) cited.
          </p>
        </div>
      )}

      {showMemo && (
        <pre className="mt-3 bg-tertiary rounded-lg p-3 text-xs text-secondary whitespace-pre-wrap">
          {memo ?? "Loading…"}
        </pre>
      )}
    </div>
  );
}

/**
 * Phase 3 — AI analysis (docs/architecture.md §26). Bare-bones ahead of the
 * real Phase 6 dashboard: pick a snapshot, run the two-pass Buffett/Munger
 * analysis over it, read the results and memo. No polling/background jobs —
 * the run happens synchronously within the request (see
 * app.services.analysis.runner's docstring for why).
 */
export default function Analysis() {
  const [snapshots, setSnapshots] = useState<PortfolioSnapshotSummary[]>([]);
  const [snapshotId, setSnapshotId] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<AnalysisRunDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    listSnapshots()
      .then((list) => {
        setSnapshots(list);
        if (list.length > 0) setSnapshotId(list[0].id);
      })
      .catch(() => undefined);
  }, []);

  async function handleRun() {
    if (!snapshotId) return;
    setRunning(true);
    setErrorMessage(null);
    setRun(null);
    try {
      const result = await createAnalysisRun(snapshotId);
      setRun(result);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? String(err.detail ?? err.message) : "Analysis run failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="terminal-card">
        <h2 className="terminal-card-title mb-3">Run analysis</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label-terminal">Portfolio snapshot</label>
            <select
              value={snapshotId}
              onChange={(e) => setSnapshotId(e.target.value)}
              className="input-terminal min-w-[280px]"
            >
              {snapshots.length === 0 && <option value="">No snapshots uploaded yet</option>}
              {snapshots.map((s) => (
                <option key={s.id} value={s.id}>
                  {new Date(s.uploaded_at).toLocaleString()} — {s.position_count} position(s)
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleRun}
            disabled={!snapshotId || running}
            className="btn-terminal btn-terminal-primary"
          >
            {running ? "Analyzing…" : "Run analysis"}
          </button>
        </div>
        <p className="text-xs text-tertiary mt-2">
          Analyzes every holding in the snapshot that has at least one uploaded document or
          financial fact on record. Each run is a two-pass Buffett/Munger assessment — an
          independent blind read, then reconciliation against any notes on that holding's position.
        </p>

        {errorMessage && <p className="text-negative text-sm mt-3">{errorMessage}</p>}
      </section>

      {run && (
        <section className="terminal-card">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <h2 className="terminal-card-title">Run {run.id.slice(0, 8)}</h2>
            <span className={`text-sm font-medium ${STATUS_COLOR[run.status] ?? "text-tertiary"}`}>
              {run.status}
            </span>
            <span className="text-xs text-tertiary font-mono">
              {run.model_name} · prompt {run.prompt_version} · scoring {run.scoring_version}
            </span>
          </div>

          {run.error_message && <p className="text-negative text-sm mb-3">{run.error_message}</p>}

          {run.failures.length > 0 && (
            <div className="mb-3">
              <p className="text-warning text-sm mb-1">{run.failures.length} holding(s) could not be analyzed:</p>
              <ul className="text-sm text-warning list-disc list-inside">
                {run.failures.map((f, i) => (
                  <li key={i}>{f.reason}</li>
                ))}
              </ul>
            </div>
          )}

          {run.holding_analyses.length === 0 ? (
            <p className="text-tertiary text-sm">No holdings were successfully analyzed.</p>
          ) : (
            run.holding_analyses.map((ha) => <HoldingAnalysisPanel key={ha.id} summary={ha} />)
          )}
        </section>
      )}
    </div>
  );
}
