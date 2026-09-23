import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { formatDate, formatRelative } from "../lib/format";
import type { AnalysisQueue, AnalysisWorker, QueuedRun, QueueReadyHoldingsResult } from "../lib/types";
import { Button, Card, EmptyState, PageHeader, SectionTitle } from "../components/ui";

/** Sprint 5B (F8 local LLM from Railway + F5 overnight queue).
 *
 * The server never calls the PC: "Run on my PC" and "Queue all ready
 * holdings" only add rows to the shared database. The worker on the PC
 * (`python -m app.worker`) checks in every ~30 s, claims the oldest queued
 * run and runs it on Ollama. Backend: app/services/analysis/queue.py. */

const REFRESH_MS = 15000;

const WORKER_STATE: Record<string, string> = {
  idle: "Idle, waiting for work",
  running: "Running an analysis",
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

function WorkerRow({ worker }: { worker: AnalysisWorker }) {
  const dot = !worker.online
    ? "bg-ink-faint"
    : worker.state === "llm_unavailable" || worker.state === "waiting_quota"
      ? "bg-caution"
      : "bg-positive";
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
        {worker.online && worker.detail && <p className="text-xs text-ink-muted">{worker.detail}</p>}
      </div>
    </li>
  );
}

function RunTable({
  runs,
  onCancel,
  busyId,
  finished,
}: {
  runs: QueuedRun[];
  onCancel?: (run: QueuedRun) => void;
  busyId?: string | null;
  finished?: boolean;
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

  async function queueAll() {
    setQueueing(true);
    setError(null);
    try {
      setResult(await api.queueReadyHoldings());
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

  return (
    <div>
      <PageHeader
        title="Analysis queue"
        subtitle="Runs queued for the worker on your PC. It runs research and both analysis passes there, on the local LLM; nothing is spent on this server."
        actions={
          <Button onClick={() => void queueAll()} disabled={queueing}>
            {queueing ? "Queueing…" : "Queue all ready holdings"}
          </Button>
        }
      />

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
                {online.length === 0 && (
                  <p className="mb-2 text-sm text-caution">
                    No worker online. Queued runs wait until the worker is started on your PC.
                  </p>
                )}
                <ul className="divide-y divide-border-subtle">
                  {queue.workers.map((w) => (
                    <WorkerRow key={w.worker_id} worker={w} />
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
                <RunTable runs={queue.pending} onCancel={(r) => void cancel(r)} busyId={busyId} />
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
