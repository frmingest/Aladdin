import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { formatDate, formatDuration, formatRelative } from "../lib/format";
import { queueStall, type QueueStall } from "../lib/queueStall";
import type { AnalysisQueue, AnalysisWorker, QueuedRun, QueueReadyHoldingsResult, QueueScope } from "../lib/types";
import { Button, Card, EmptyState, Modal, PageHeader, SectionTitle } from "../components/ui";

/** Sprint 5B (F8 local LLM from Railway + F5 overnight queue).
 *
 * The server never calls the PC: "Run on my PC" and "Queue all ready
 * holdings" only add rows to the shared database. The worker on the PC
 * (`python -m app.worker`) checks in every ~30 s, claims the oldest queued
 * run and runs it on Ollama. Backend: app/services/analysis/queue.py. */

const REFRESH_MS = 15000;

const QUEUE_SCOPE_OPTIONS: { value: QueueScope; label: string; hint: string }[] = [
  { value: "holdings", label: "Actual holdings only", hint: "Currently owned positions. Skips anything on the watchlist." },
  { value: "watchlist", label: "Watchlist only", hint: "Companies you're following but don't own." },
  { value: "all", label: "All holdings + watchlist", hint: "Owned positions and watchlist companies together." },
];

const WORKER_STATE: Record<string, string> = {
  idle: "Idle, waiting for work",
  running: "Running an analysis",
  background_job: "Background job (still checking the queue)",
  waiting_quota: "Waiting for Gemini quota",
  llm_unavailable: "LLM unavailable",
  stopped: "Stopped",
};

const STATUS_STYLE: Record<string, string> = {
  QUEUED: "bg-accent-subtle text-accent",
  RUNNING: "bg-caution-subtle text-caution",
  COMPLETED: "bg-positive-subtle text-positive",
  BLIND_ONLY: "bg-caution-subtle text-caution",
  FAILED: "bg-negative-subtle text-negative",
  CANCELLED: "bg-border-subtle text-ink-muted",
};

/** The worker bakes "(NN%)" onto the end of its heartbeat `detail` text at
 * each pipeline stage boundary (backend/app/worker/runner.py `_on_stage`) —
 * no separate progress field, so a heartbeat from an older worker build
 * (no percentage yet) just renders as plain text, no bar. */
function parseProgress(detail: string | null | undefined): { pct: number; label: string } | null {
  if (!detail) return null;
  const m = detail.match(/^(.*)\((\d{1,3})%\)\s*$/);
  if (!m) return null;
  const pct = Math.min(100, Math.max(0, parseInt(m[2], 10)));
  return { pct, label: m[1].trim() };
}

/** Average wall-clock time of recently finished runs — the only ETA basis
 * we have (the backend doesn't track per-stage timing). COMPLETED only:
 * a FAILED run can end after seconds and would otherwise drag the average
 * down to something misleading. */
function averageRunSeconds(recent: QueuedRun[]): number | null {
  const durations = recent
    .filter((r) => r.status === "COMPLETED" && r.completed_at)
    .map((r) => (new Date(r.completed_at as string).getTime() - new Date(r.started_at).getTime()) / 1000)
    .filter((s) => Number.isFinite(s) && s > 0);
  if (durations.length === 0) return null;
  return durations.reduce((a, b) => a + b, 0) / durations.length;
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border-subtle" aria-hidden>
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function errorText(err: unknown): string {
  return err instanceof ApiError || err instanceof Error ? err.message : "Request failed.";
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? "bg-border-subtle text-ink"}`}>
      {status.charAt(0) + status.slice(1).toLowerCase().replace("_", " ")}
    </span>
  );
}

function StallBanner({ stall }: { stall: QueueStall }) {
  return (
    <p role="alert" className="mb-3 rounded-lg border border-caution/40 bg-caution-subtle px-3 py-2 text-sm text-caution">
      {stall.message}
    </p>
  );
}

function WorkerRow({ worker, avgRunSeconds }: { worker: AnalysisWorker; avgRunSeconds: number | null }) {
  const dot = !worker.online
    ? "bg-ink-faint"
    : worker.state === "llm_unavailable" || worker.state === "waiting_quota"
      ? "bg-caution"
      : "bg-positive";
  const progress = worker.online && worker.state === "running" ? parseProgress(worker.detail) : null;
  const eta =
    progress && progress.pct > 0 && avgRunSeconds
      ? formatDuration(avgRunSeconds * (1 - progress.pct / 100))
      : null;
  return (
    <li className="flex items-start gap-3 py-2.5 text-sm">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-ink">
          <span className="font-medium">{worker.worker_id}</span>
          {worker.model_name && <span className="text-ink-muted"> · {worker.model_name}</span>}
          <span className="text-ink-muted"> · {worker.online ? WORKER_STATE[worker.state] ?? worker.state : "Offline"}</span>
        </p>
        <p className="text-xs text-ink-muted">
          Last seen {formatRelative(worker.last_seen_at)} · started {formatDate(worker.started_at)}
        </p>
        {worker.online && worker.detail && (
          <div className="mt-1.5 max-w-sm">
            <p className="text-xs text-ink-muted">
              {progress ? progress.label : worker.detail}
              {progress && (
                <>
                  {" "}
                  <span className="font-medium text-ink">{progress.pct}%</span>
                  {eta && <span> · ETA {eta}</span>}
                </>
              )}
            </p>
            {progress && (
              <div className="mt-1">
                <ProgressBar pct={progress.pct} />
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function RunTable({
  runs,
  onCancel,
  busyId,
  finished,
  workers,
  avgRunSeconds,
}: {
  runs: QueuedRun[];
  onCancel?: (run: QueuedRun) => void;
  busyId?: string | null;
  finished?: boolean;
  workers?: AnalysisWorker[];
  avgRunSeconds?: number | null;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-ink-muted">
            <th className="py-2 pr-4 font-medium">Holding</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 pr-4 font-medium">{finished ? "Finished" : "Queued"}</th>
            <th className="py-2 pr-4 font-medium">{finished ? "Verdict" : "Worker"}</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="border-t border-border-subtle align-top">
              <td className="py-3 pr-4">
                <Link to={`/holdings/${run.holding_id}`} className="font-medium text-ink hover:text-accent">
                  {run.holding_name ?? run.ticker ?? run.holding_id}
                </Link>
                <p className="text-xs text-ink-faint">{run.ticker}</p>
              </td>
              <td className="py-3 pr-4">
                <StatusPill status={run.status} />
                {run.attempts > 1 && <p className="mt-1 text-xs text-ink-faint">attempt {run.attempts}</p>}
                {run.error_message && (
                  <p className="mt-1 max-w-sm text-xs text-ink-muted" title={run.error_message}>
                    {run.error_message.length > 160 ? `${run.error_message.slice(0, 160)}…` : run.error_message}
                  </p>
                )}
              </td>
              <td className="tabular py-3 pr-4 text-ink-muted">
                {finished ? formatDate(run.completed_at ?? run.started_at) : formatRelative(run.queued_at)}
              </td>
              <td className="py-3 pr-4 text-ink-muted">
                {finished ? (
                  run.verdict ?? "—"
                ) : run.status === "RUNNING" ? (
                  <>
                    {run.claimed_by}
                    <span className="block text-xs text-ink-faint">since {formatRelative(run.claimed_at)}</span>
                    {(() => {
                      const worker = workers?.find((w) => w.worker_id === run.claimed_by);
                      const progress = worker?.online ? parseProgress(worker.detail) : null;
                      if (!progress) return null;
                      const eta =
                        progress.pct > 0 && avgRunSeconds
                          ? formatDuration(avgRunSeconds * (1 - progress.pct / 100))
                          : null;
                      return (
                        <span className="mt-1 block w-32">
                          <span className="block text-xs text-ink-faint">
                            {progress.pct}%{eta && ` · ETA ${eta}`}
                          </span>
                          <ProgressBar pct={progress.pct} />
                        </span>
                      );
                    })()}
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td className="py-3 text-right">
                {onCancel && run.status === "QUEUED" && (
                  <Button variant="secondary" onClick={() => onCancel(run)} disabled={busyId === run.id}>
                    Cancel
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AnalysisQueuePage() {
  const [queue, setQueue] = useState<AnalysisQueue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queueing, setQueueing] = useState(false);
  const [result, setResult] = useState<QueueReadyHoldingsResult | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scopePickerOpen, setScopePickerOpen] = useState(false);
  const [scope, setScope] = useState<QueueScope>("holdings");

  const load = useCallback(() => {
    api
      .getAnalysisQueue()
      .then((q) => {
        setQueue(q);
        setError(null);
      })
      .catch((e) => setError(errorText(e)));
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  async function queueAll(chosenScope: QueueScope) {
    setScopePickerOpen(false);
    setQueueing(true);
    setError(null);
    try {
      setResult(await api.queueReadyHoldings(chosenScope));
      load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setQueueing(false);
    }
  }

  async function cancel(run: QueuedRun) {
    setBusyId(run.id);
    try {
      await api.cancelAnalysisRun(run.id);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusyId(null);
      load();
    }
  }

  const online = queue?.workers.filter((w) => w.online) ?? [];
  const stall = queue ? queueStall(queue, Date.now()) : null;
  const avgRunSeconds = averageRunSeconds(queue?.recent ?? []);

  return (
    <div>
      <PageHeader
        title="Analysis queue"
        subtitle="Runs queued for the worker on your PC. It runs research and both analysis passes there, on the local LLM; nothing is spent on this server."
        actions={
          <Button onClick={() => setScopePickerOpen(true)} disabled={queueing}>
            {queueing ? "Queueing…" : "Queue all ready holdings"}
          </Button>
        }
      />

      <Modal open={scopePickerOpen} onClose={() => setScopePickerOpen(false)} title="Queue all ready holdings">
        <p className="mb-4 text-sm text-ink-muted">Which holdings should be queued for analysis?</p>
        <div className="space-y-2">
          {QUEUE_SCOPE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                scope === opt.value ? "border-accent bg-accent-subtle" : "border-border hover:bg-border-subtle"
              }`}
            >
              <input
                type="radio"
                name="queue-scope"
                value={opt.value}
                checked={scope === opt.value}
                onChange={() => setScope(opt.value)}
                className="mt-0.5 accent-current text-accent"
              />
              <span>
                <span className="block text-sm font-medium text-ink">{opt.label}</span>
                <span className="block text-xs text-ink-muted">{opt.hint}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setScopePickerOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => void queueAll(scope)} disabled={queueing}>
            {queueing ? "Queueing…" : "Queue"}
          </Button>
        </div>
      </Modal>

      {error && <p className="mb-4 text-sm text-negative">{error}</p>}

      {result && (
        <Card className="mb-6">
          <p className="text-sm text-ink">
            Queued {result.queued.length} holding{result.queued.length === 1 ? "" : "s"}
            {result.already_queued.length > 0 && `, ${result.already_queued.length} already in the queue`}
            {result.skipped.length > 0 && `, ${result.skipped.length} skipped`}.
          </p>
          {result.skipped.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-ink-muted">
              {result.skipped.map((s) => (
                <li key={s.holding_id}>
                  <Link to={`/holdings/${s.holding_id}`} className="font-medium text-ink hover:text-accent">
                    {s.holding_name ?? s.ticker}
                  </Link>{" "}
                  — {s.reason}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div className="space-y-6">
        <section>
          <SectionTitle hint="Checks in every ~30 s">Local worker</SectionTitle>
          <Card>
            {queue === null && !error && <p className="text-sm text-ink-muted">Loading…</p>}
            {queue && queue.workers.length === 0 && (
              <p className="text-sm text-ink-muted">
                No worker has checked in yet. On your PC: <code>cd E:\Aladdin\backend</code>, activate the venv,
                then <code>python -m app.worker</code> (see the Ollama setup guide, "Run analyses queued from
                Railway").
              </p>
            )}
            {queue && queue.workers.length > 0 && (
              <>
                {stall && <StallBanner stall={stall} />}
                {online.length === 0 && (
                  <p className="mb-2 text-sm text-caution">
                    No worker online. Queued runs wait until the worker is started on your PC.
                  </p>
                )}
                <ul className="divide-y divide-border-subtle">
                  {queue.workers.map((w) => (
                    <WorkerRow key={w.worker_id} worker={w} avgRunSeconds={avgRunSeconds} />
                  ))}
                </ul>
              </>
            )}
          </Card>
        </section>

        <section>
          <SectionTitle hint="Oldest first">Queued and running</SectionTitle>
          {queue && queue.pending.length === 0 ? (
            <EmptyState>
              Nothing queued. Use "Run on my PC" on a holding, or "Queue all ready holdings" above.
            </EmptyState>
          ) : (
            queue && (
              <Card>
                <RunTable
                  runs={queue.pending}
                  onCancel={(r) => void cancel(r)}
                  busyId={busyId}
                  workers={queue.workers}
                  avgRunSeconds={avgRunSeconds}
                />
              </Card>
            )
          )}
        </section>

        {queue && queue.recent.length > 0 && (
          <section>
            <SectionTitle>Recently finished on your PC</SectionTitle>
            <Card>
              <RunTable runs={queue.recent} finished />
            </Card>
          </section>
        )}
      </div>
    </div>
  );
}
