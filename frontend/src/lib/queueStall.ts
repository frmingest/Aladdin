/** Why a queued run has not started. The server never calls the PC: a run
 * only starts when the PC worker's own poll claims it, so the page can only
 * say what it sees (worker online, what it reports, how long the run has
 * waited) and when to restart the worker. Pure, so it is unit tested. */
import type { AnalysisQueue, AnalysisWorker, QueuedRun } from "./types";

/** A run that waited this long with an online, non-running worker is flagged. */
export const STALL_MINUTES = 3;

export interface QueueStall {
  minutes: number;
  message: string;
}

/** Whole minutes a QUEUED run has waited, or null if it is not queued / has
 * no usable timestamp. */
export function waitedMinutes(run: QueuedRun, now: number): number | null {
  if (run.status !== "QUEUED" || !run.queued_at) return null;
  const queued = new Date(run.queued_at).getTime();
  if (!Number.isFinite(queued)) return null;
  return Math.max(0, Math.floor((now - queued) / 60000));
}

/** The warning for one queued run, or null when there is nothing to warn
 * about: not queued long enough, no worker online (the page already says so),
 * a worker already running something, or one that is waiting on Gemini quota
 * or its LLM (those have their own explanation). */
export function stallFor(run: QueuedRun, workers: AnalysisWorker[], now: number): QueueStall | null {
  const minutes = waitedMinutes(run, now);
  if (minutes === null || minutes < STALL_MINUTES) return null;
  const online = workers.filter((w) => w.online);
  if (online.length === 0) return null;
  if (online.some((w) => w.state === "running" || w.state === "waiting_quota" || w.state === "llm_unavailable")) {
    return null;
  }
  const busy = online.find((w) => w.state === "background_job");
  const wait = `Waiting ${minutes} min`;
  if (busy) {
    return {
      minutes,
      message:
        `${wait}. The worker is busy with a background job (${busy.detail ?? "details unavailable"}). ` +
        "A current worker still picks up queued runs while it works; if this does not start soon, " +
        "stop it (Ctrl+C) and start it again after `git pull`: `python -m app.worker`.",
    };
  }
  return {
    minutes,
    message:
      `${wait}. The worker is online but has not claimed this run. ` +
      "If it was started before the last update it may be stuck in a long background job: " +
      "stop it (Ctrl+C) and start it again: `python -m app.worker`.",
  };
}

/** The warning for the oldest queued run (the one the worker takes next). */
export function queueStall(queue: AnalysisQueue, now: number): QueueStall | null {
  const queued = queue.pending
    .filter((r) => r.status === "QUEUED" && r.queued_at)
    .sort((a, b) => new Date(a.queued_at as string).getTime() - new Date(b.queued_at as string).getTime());
  return queued.length ? stallFor(queued[0], queue.workers, now) : null;
}
