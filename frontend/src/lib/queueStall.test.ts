import { describe, expect, it } from "vitest";
import { queueStall, stallFor, STALL_MINUTES } from "./queueStall";
import type { AnalysisQueue, AnalysisWorker, QueuedRun } from "./types";

const NOW = new Date("2026-10-07T09:30:00Z").getTime();
const minutesAgo = (m: number) => new Date(NOW - m * 60000).toISOString();

function run(over: Partial<QueuedRun> = {}): QueuedRun {
  return {
    id: "r1", holding_id: "h1", ticker: "EQNR", holding_name: "Equinor", status: "QUEUED", engine: "local",
    queued_at: minutesAgo(10), claimed_by: null, claimed_at: null, started_at: minutesAgo(10), completed_at: null,
    attempts: 0, error_message: null, provider: null, model_name: null, verdict: null,
    ...over,
  } as QueuedRun;
}

function worker(over: Partial<AnalysisWorker> = {}): AnalysisWorker {
  return {
    worker_id: "pc", hostname: "PC", llm_provider: "ollama", model_name: "m", state: "idle", detail: null,
    current_run_id: null, started_at: minutesAgo(600), last_seen_at: minutesAgo(0), online: true,
    ...over,
  };
}

describe("stallFor", () => {
  it("is quiet for a run that has only just been queued", () => {
    expect(stallFor(run({ queued_at: minutesAgo(STALL_MINUTES - 1) }), [worker()], NOW)).toBeNull();
  });

  it("flags an online idle worker that has not claimed an old run", () => {
    const s = stallFor(run(), [worker()], NOW);
    expect(s?.minutes).toBe(10);
    expect(s?.message).toContain("has not claimed");
  });

  it("names the background job when the worker is busy with one", () => {
    const s = stallFor(run(), [worker({ state: "background_job", detail: "Background job: snapshot refresh (since 09:15 UTC)" })], NOW);
    expect(s?.message).toContain("snapshot refresh");
  });

  it("says nothing when the worker is running, waiting for quota or without an LLM", () => {
    for (const state of ["running", "waiting_quota", "llm_unavailable"]) {
      expect(stallFor(run(), [worker({ state })], NOW)).toBeNull();
    }
  });

  it("says nothing with no worker online (the page already says so)", () => {
    expect(stallFor(run(), [worker({ online: false })], NOW)).toBeNull();
    expect(stallFor(run(), [], NOW)).toBeNull();
  });

  it("ignores runs that are not queued", () => {
    expect(stallFor(run({ status: "RUNNING" }), [worker()], NOW)).toBeNull();
  });
});

describe("queueStall", () => {
  it("looks at the oldest queued run", () => {
    const queue: AnalysisQueue = {
      workers: [worker()],
      any_worker_online: true,
      pending: [run({ id: "new", queued_at: minutesAgo(1) }), run({ id: "old", queued_at: minutesAgo(12) })],
      recent: [],
    };
    expect(queueStall(queue, NOW)?.minutes).toBe(12);
  });

  it("is null for an empty queue", () => {
    expect(queueStall({ workers: [worker()], any_worker_online: true, pending: [], recent: [] }, NOW)).toBeNull();
  });
});
