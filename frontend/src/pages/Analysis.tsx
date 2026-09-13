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
  COMPLETED: "text-emerald-400",
  PARTIAL: "text-amber-400",
  FAILED: "text-red-400",
  RUNNING: "text-slate-400",
  QUEUED: "text-slate-400",
};

function ScorePill({ score }: { score: string | number | null }) {
  if (score === null) return <span className="text-slate-500">n/a</span>;
  const numericScore = Number(score);
  const color = numericScore >= 7 ? "bg-emerald-700" : numericScore >= 5 ? "bg-amber-700" : "bg-red-700";
  return <span className={`${color} rounded px-2 py-0.5 text-xs font-medium`}>{score}/10</span>;
}

function FactorRow({ label, factor }: { label: string; factor: { score: number; confidence: string; reasoning: string } }) {
  return (
    <div className="border-b border-slate-900 py-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium">{label}</span>
        <ScorePill score={factor.score} />
        <span className="text-xs text-slate-500">({factor.confidence} confidence)</span>
      </div>
      <p className="text-sm text-slate-400">{factor.reasoning}</p>
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
    <div className="border border-slate-800 rounded p-3 mb-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-medium">{summary.name}</span>
          <span className="text-slate-500 text-sm">{summary.ticker}</span>
          <ScorePill score={summary.overall_score} />
          <span className="text-xs text-slate-500">{summary.thesis_status}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={toggleDetail} className="text-xs text-emerald-400 hover:underline">
            {detail ? "Hide" : "Details"}
          </button>
          <button onClick={toggleMemo} className="text-xs text-emerald-400 hover:underline">
            {showMemo ? "Hide memo" : "Memo"}
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-500 mt-2">Loading…</p>}

      {detail && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-slate-300">{detail.structured_output.executive_summary}</p>

          <div>
            <FactorRow label="Business Quality" factor={detail.structured_output.business_quality} />
            <FactorRow label="Financial Strength" factor={detail.structured_output.financial_strength} />
            <FactorRow label="Valuation" factor={detail.structured_output.valuation} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <h4 className="text-xs uppercase text-slate-500 mb-1">Key Strengths</h4>
              <ul className="text-sm list-disc list-inside text-slate-300">
                {detail.structured_output.key_strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs uppercase text-slate-500 mb-1">Key Risks</h4>
              <ul className="text-sm list-disc list-inside text-slate-300">
                {detail.structured_output.key_risks.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-slate-900 rounded p-3">
            <h4 className="text-xs uppercase text-slate-500 mb-1">Thesis Divergence (blind vs. your notes)</h4>
            <p className="text-sm text-slate-300">
              <span className="text-slate-500">Blind:</span> {detail.structured_output.thesis_divergence.blind_assessment_summary}
            </p>
            <p className="text-sm text-slate-300">
              <span className="text-slate-500">Your notes:</span>{" "}
              {detail.structured_output.thesis_divergence.user_thesis_summary}
            </p>
            <p className="text-sm mt-1">
              <span className={detail.structured_output.thesis_divergence.material_disagreement ? "text-amber-400" : "text-emerald-400"}>
                {detail.structured_output.thesis_divergence.material_disagreement ? "Material disagreement" : "No material disagreement"}
              </span>
              {" — "}
              {detail.structured_output.thesis_divergence.disagreement_notes}
            </p>
          </div>

          {detail.structured_output.insufficient_evidence_areas.length > 0 && (
            <div>
              <h4 className="text-xs uppercase text-slate-500 mb-1">Insufficient Evidence</h4>
              <ul className="text-sm list-disc list-inside text-amber-400">
                {detail.structured_output.insufficient_evidence_areas.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-slate-600">
            {detail.evidence_references.length} evidence reference(s) cited.
          </p>
        </div>
      )}

      {showMemo && (
        <pre className="mt-3 bg-slate-900 rounded p-3 text-xs text-slate-300 whitespace-pre-wrap">
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
      <section>
        <h2 className="text-lg font-semibold mb-3">Run analysis</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Portfolio snapshot</label>
            <select
              value={snapshotId}
              onChange={(e) => setSnapshotId(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm min-w-[280px]"
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
            className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed rounded px-4 py-1.5 text-sm font-medium"
          >
            {running ? "Analyzing…" : "Run analysis"}
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Analyzes every holding in the snapshot that has at least one uploaded document or
          financial fact on record. Each run is a two-pass Buffett/Munger assessment — an
          independent blind read, then reconciliation against any notes on that holding's position.
        </p>

        {errorMessage && <p className="text-red-400 text-sm mt-3">{errorMessage}</p>}
      </section>

      {run && (
        <section>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-lg font-semibold">Run {run.id.slice(0, 8)}</h2>
            <span className={`text-sm font-medium ${STATUS_COLOR[run.status] ?? "text-slate-400"}`}>
              {run.status}
            </span>
            <span className="text-xs text-slate-500">
              {run.model_name} · prompt {run.prompt_version} · scoring {run.scoring_version}
            </span>
          </div>

          {run.error_message && <p className="text-red-400 text-sm mb-3">{run.error_message}</p>}

          {run.failures.length > 0 && (
            <div className="mb-3">
              <p className="text-amber-400 text-sm mb-1">{run.failures.length} holding(s) could not be analyzed:</p>
              <ul className="text-sm text-amber-400 list-disc list-inside">
                {run.failures.map((f, i) => (
                  <li key={i}>{f.reason}</li>
                ))}
              </ul>
            </div>
          )}

          {run.holding_analyses.length === 0 ? (
            <p className="text-slate-500 text-sm">No holdings were successfully analyzed.</p>
          ) : (
            run.holding_analyses.map((ha) => <HoldingAnalysisPanel key={ha.id} summary={ha} />)
          )}
        </section>
      )}
    </div>
  );
}
