import { useEffect, useState } from "react";
import { ApiError, createAnalysisRun, getHoldingAnalysis, listSnapshots } from "../services/api";
import type { PortfolioSnapshotSummary } from "../types/portfolio";
import type { AnalysisRunDetail, HoldingAnalysisDetail, HoldingAnalysisSummary } from "../types/analysis";
import { ScorePill, HoldingAnalysisFullDetailWithMemo } from "../components/HoldingAnalysisDetail";

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: "text-positive",
  PARTIAL: "text-warning",
  FAILED: "text-negative",
  RUNNING: "text-tertiary",
  QUEUED: "text-tertiary",
};

function HoldingAnalysisPanel({ summary }: { summary: HoldingAnalysisSummary }) {
  const [detail, setDetail] = useState<HoldingAnalysisDetail | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggleDetail() {
    if (detail) {
      setDetail(null);
      return;
    }
    setLoading(true);
    try {
      setDetail(await getHoldingAnalysis(summary.id));
    } finally {
      setLoading(false);
    }
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
        <button onClick={toggleDetail} className="text-xs text-accent hover:underline">
          {detail ? "Hide" : "Details"}
        </button>
      </div>

      {loading && <p className="text-sm text-tertiary mt-2">Loading…</p>}

      {detail && (
        <div className="mt-3">
          <HoldingAnalysisFullDetailWithMemo detail={detail} />
        </div>
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
