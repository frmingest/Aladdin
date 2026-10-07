import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { formatDate, formatDecimal, formatRelative } from "../lib/format";
import { stallFor } from "../lib/queueStall";
import type {
  AnalysisQueue,
  AnalysisReadiness,
  AnalysisRun,
  EvidenceItem,
  FundBlindPassOutput,
  HoldingNote,
  MoatRating,
  NarrativeAssessment,
  QueuedRun,
  ReadinessStatus,
  VerdictContent,
  VerdictRating,
} from "../lib/types";
import { isFundBlindPass } from "../lib/types";
import { dataGapCount } from "../lib/prose";
import { Prose, WithFigures } from "./Prose";
import { Button, Card, EmptyState } from "./ui";

/** The Buffett/Munger analysis for one holding (Sprint 4 frontend = F1,
 * readiness checklist = F2). Backend: app/api/analysis.py.
 *
 * - Readiness is loaded first and is free; Run is disabled on any blocker so
 *   no Gemini quota is spent on a run that can't produce a useful result.
 * - Every section's citations resolve against the run's own evidence items
 *   (exactly what the model was given), so a claim can always be traced.
 * - LLM text and issuer-sourced evidence are rendered as plain text only,
 *   never as HTML (CLAUDE.md Rule 5).
 * - The price-target range is deterministic DCF output, labelled as such.
 * - Sprint 5B: "Run on my PC" queues the run for the local worker instead of
 *   running it in this request; the pending run is polled until it finishes,
 *   while the previous result stays on screen. */

// Readiness checks that matter for a run on the PC. Provider/quota/Ollama
// checks describe this server's configuration, not the worker's (mirrors
// QUEUE_BLOCKING_CHECKS in backend/app/services/analysis/queue.py).
const LOCAL_BLOCKING_CHECKS = new Set(["instrument_type", "ticker", "financials", "fund_profile"]);
// Checks about this server's own plumbing (LLM provider, Ollama, quota). They never get the
// investment warning colour and always sort after the checks about the holding itself.
const PLUMBING_CHECKS = new Set(["providers", "local_llm", "quota", "worker"]);
const QUEUE_POLL_MS = 15000;

function errorText(err: unknown): string {
  return err instanceof ApiError || err instanceof Error ? err.message : "Request failed.";
}

const MOAT_SOURCE_LABELS: Record<string, string> = {
  brand: "Brand",
  pricing_power: "Pricing power",
  switching_costs: "Switching costs",
  network_effects: "Network effects",
  cost_advantage: "Cost advantage",
  intellectual_property: "Intellectual property",
  distribution: "Distribution",
};

const RATING_STYLES: Record<VerdictRating, string> = {
  "Strong Buy": "bg-positive text-onfill",
  Buy: "bg-positive-subtle text-positive",
  Hold: "bg-border-subtle text-ink",
  Sell: "bg-negative-subtle text-negative",
  Avoid: "bg-negative text-onfill",
};

const MOAT_STYLES: Record<MoatRating, string> = {
  Wide: "bg-positive-subtle text-positive",
  Narrow: "bg-caution-subtle text-caution",
  None: "bg-border-subtle text-ink-muted",
};

const CHECK_DOT: Record<ReadinessStatus, string> = {
  ok: "bg-positive",
  warn: "bg-caution",
  block: "bg-negative",
};

const CHECK_TEXT: Record<ReadinessStatus, string> = {
  ok: "Ready",
  warn: "Warning",
  block: "Blocking",
};

const RUN_STATUS_TEXT: Record<AnalysisRun["status"], { text: string; style: string }> = {
  QUEUED: { text: "Queued for your PC", style: "bg-accent-subtle text-accent" },
  CANCELLED: { text: "Cancelled", style: "bg-border-subtle text-ink-muted" },
  COMPLETED: { text: "Completed", style: "bg-positive-subtle text-positive" },
  BLIND_ONLY: { text: "Blind pass only", style: "bg-caution-subtle text-caution" },
  RUNNING: { text: "Running", style: "bg-caution-subtle text-caution" },
  FAILED: { text: "Failed", style: "bg-negative-subtle text-negative" },
};

// ---------------------------------------------------------------------------
// Citations

function Citations({ ids, evidence }: { ids: string[]; evidence: Map<string, EvidenceItem> }) {
  const [open, setOpen] = useState<string | null>(null);
  // 2026-09-30 UX: a run cites 20-40 evidence ids per card; as a chip wall it
  // dominated the page. Collapsed by default behind one "N sources" toggle.
  const [showAll, setShowAll] = useState(false);
  if (ids.length === 0) return null;
  const selected = open ? evidence.get(open) : undefined;
  const unknownCount = ids.filter((id) => !evidence.has(id)).length;

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-1.5 border-t border-border-subtle pt-3">
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent-subtle px-2.5 py-0.5 text-xs font-medium text-accent hover:bg-accent hover:text-onfill focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {ids.length} source{ids.length === 1 ? "" : "s"}
          <span aria-hidden="true">{showAll ? "▴" : "▾"}</span>
        </button>
        {unknownCount > 0 && (
          <span className="rounded-full bg-caution-subtle px-2 py-0.5 text-[11px] font-medium text-caution">
            {unknownCount} not in evidence
          </span>
        )}
        {(showAll || open) &&
          ids.map((id) => {
            const known = evidence.has(id);
            const active = open === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setOpen(active ? null : id)}
                aria-expanded={active}
                title={known ? evidence.get(id)?.label : "Not found in this run's evidence packet"}
                className={`tabular rounded-md px-1.5 py-0.5 font-mono text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  !known
                    ? "bg-caution-subtle text-caution line-through"
                    : active
                      ? "bg-accent text-onfill"
                      : "bg-accent-subtle text-accent hover:bg-accent hover:text-onfill"
                }`}
              >
                {id}
              </button>
            );
          })}
      </div>
      {open && (
        <div className="mt-2 rounded-lg border border-border-subtle bg-raised p-3 text-sm">
          {selected ? (
            <>
              <p className="font-medium text-ink">{selected.label}</p>
              <p className="mt-1 whitespace-pre-line text-ink-muted">{selected.content}</p>
              {selected.citation && (
                <p className="mt-1.5 break-words text-xs text-ink-faint">Source: {selected.citation}</p>
              )}
            </>
          ) : (
            <p className="text-caution">
              {open} was cited by the model but isn't in this run's evidence packet — treat that claim
              as unsupported.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Readiness (F2)

function canQueueLocally(readiness: AnalysisReadiness): boolean {
  return !readiness.checks.some((c) => c.status === "block" && LOCAL_BLOCKING_CHECKS.has(c.key));
}

function ReadinessCard({
  readiness,
  error,
  running,
  onRun,
  hasRun,
  onQueue,
  queueing,
  pending,
}: {
  readiness: AnalysisReadiness | null;
  error: string | null;
  running: boolean;
  onRun: () => void;
  hasRun: boolean;
  onQueue: () => void;
  queueing: boolean;
  pending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const problems = readiness?.checks.filter((c) => c.status !== "ok") ?? [];
  // Blockers always show. When the run can go ahead, the warnings (mostly plumbing: Ollama, the PC
  // worker, quota) stay one click away so they do not push the verdict down the page.
  const showAll = expanded || (readiness !== null && !readiness.ready);
  const visible = showAll
    ? [...(readiness?.checks ?? [])].sort(
        (a, b) => Number(PLUMBING_CHECKS.has(a.key)) - Number(PLUMBING_CHECKS.has(b.key)),
      )
    : [];

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">Readiness</h3>
          {readiness && (
            <p className="mt-0.5 text-xs text-ink-muted">
              {readiness.ready
                ? readiness.warnings === 0
                  ? "Everything the analysis needs is in place."
                  : `Can run, with ${readiness.warnings} warning${readiness.warnings === 1 ? "" : "s"}.`
                : `${readiness.blockers} blocking issue${readiness.blockers === 1 ? "" : "s"} — fix before running.`}
              {" "}Costs about {readiness.estimated_gemini_calls} Gemini call
              {readiness.estimated_gemini_calls === 1 ? "" : "s"}
              {readiness.gemini_calls_remaining_today !== null &&
                ` (${readiness.gemini_calls_remaining_today} left today)`}
              .
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={onQueue}
            disabled={queueing || pending || running || !readiness || !canQueueLocally(readiness)}
            title="Queue it for the worker on your PC (Ollama). The page doesn't need to stay open."
          >
            {queueing ? "Queueing…" : pending ? "Queued on PC" : "Run on my PC"}
          </Button>
          <Button onClick={onRun} disabled={running || pending || !readiness || !readiness.ready}>
            {running ? "Analyzing…" : hasRun ? "Run again" : "Run analysis"}
          </Button>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-negative">{error}</p>}
      {!readiness && !error && <p className="mt-3 text-sm text-ink-muted">Checking…</p>}

      {running && (
        <p className="mt-3 text-sm text-ink-muted">
          Building the evidence packet, then the blind pass and the reconciliation pass. This usually
          takes up to a minute — keep this page open.
        </p>
      )}

      {readiness && visible.length > 0 && (
        <ul className="mt-4 divide-y divide-border-subtle border-t border-border-subtle">
          {visible.map((check) => (
            <li key={check.key} className="flex gap-3 py-2.5 text-sm">
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  PLUMBING_CHECKS.has(check.key) && check.status === "warn" ? "bg-ink-faint" : CHECK_DOT[check.status]
                }`}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-ink">
                  {check.label}
                  {PLUMBING_CHECKS.has(check.key) && <span className="ml-2 text-xs text-ink-faint">system</span>}
                  <span className="sr-only"> — {CHECK_TEXT[check.status]}</span>
                </p>
                <p className="text-xs text-ink-muted">{check.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {readiness && readiness.ready && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-xs text-accent hover:text-accent-hover"
        >
          {expanded
            ? "Hide checks"
            : problems.length > 0
              ? `Show ${problems.length} warning${problems.length === 1 ? "" : "s"}`
              : `Show all ${readiness.checks.length} checks`}
        </button>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Pending local run (Sprint 5B)

function PendingRunCard({
  run,
  queue,
  busy,
  onCancel,
  onRunInCloud,
  cloudReady,
}: {
  run: QueuedRun;
  queue: AnalysisQueue;
  busy: boolean;
  onCancel: () => void;
  onRunInCloud: () => void;
  cloudReady: boolean;
}) {
  const worker =
    queue.workers.find((w) => w.worker_id === run.claimed_by) ??
    queue.workers.find((w) => w.online) ??
    queue.workers[0];
  const stall = run.status === "QUEUED" ? stallFor(run, queue.workers, Date.now()) : null;
  const position = queue.pending.filter((r) => r.status === "QUEUED").findIndex((r) => r.id === run.id);

  let workerLine: string;
  if (!worker) workerLine = "No worker has ever checked in. Start `python -m app.worker` on your PC.";
  else if (!worker.online) workerLine = `Worker '${worker.worker_id}' is offline (last seen ${formatRelative(worker.last_seen_at)}). The run waits until it's started.`;
  else if (worker.state === "llm_unavailable") workerLine = `Worker '${worker.worker_id}' is online, but its LLM is unavailable: ${worker.detail ?? "unknown"}.`;
  else if (worker.state === "waiting_quota") workerLine = worker.detail ?? "Waiting for Gemini quota.";
  else if (worker.state === "background_job") workerLine = `Worker '${worker.worker_id}' is online and doing a background job (${worker.detail ?? "details unavailable"}); it checks the queue meanwhile.`;
  else workerLine = `Worker '${worker.worker_id}'${worker.model_name ? ` (${worker.model_name})` : ""} online, seen ${formatRelative(worker.last_seen_at)}.`;

  return (
    <Card className="border-accent/30">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">
            {run.status === "RUNNING"
              ? `Running on ${run.claimed_by ?? "your PC"} since ${formatRelative(run.claimed_at)}`
              : `Queued for your PC ${formatRelative(run.queued_at)}${position > 0 ? ` · ${position} ahead in the queue` : ""}`}
          </p>
          <p className="mt-1 text-xs text-ink-muted">{workerLine}</p>
          {stall && (
            <p role="alert" className="mt-1 text-xs text-caution">
              {stall.message}
            </p>
          )}
          {run.error_message && <p className="mt-1 text-xs text-caution">{run.error_message}</p>}
          <p className="mt-1 text-xs text-ink-faint">
            The previous result below stays until this run finishes. This page checks every 15 s;
            you can also close it. <Link to="/analysis-queue" className="text-accent hover:text-accent-hover">Analysis queue</Link>
          </p>
        </div>
        {run.status === "QUEUED" && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="secondary" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={onRunInCloud} disabled={busy || !cloudReady} title="Cancel the queued run and run it now on the server's LLM">
              Run in cloud instead
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Verdict

function BulletList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{title}</h4>
      <ul className="mt-2 space-y-2 text-sm leading-relaxed text-ink">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
            <span>
              <WithFigures text={item} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 5-step scale so the verdict reads at a glance, not just as a word. */
const VERDICT_SCALE: VerdictRating[] = ["Avoid", "Sell", "Hold", "Buy", "Strong Buy"];
const VERDICT_SEGMENT: Record<VerdictRating, string> = {
  Avoid: "bg-negative",
  Sell: "bg-negative/60",
  Hold: "bg-ink-faint",
  Buy: "bg-positive/60",
  "Strong Buy": "bg-positive",
};

function VerdictScale({ rating }: { rating: VerdictRating }) {
  return (
    <div className="mt-3 w-56" role="img" aria-label={`Verdict ${rating} on a scale from Avoid to Strong Buy`}>
      <div className="flex gap-1">
        {VERDICT_SCALE.map((step) => (
          <div
            key={step}
            className={`h-2 flex-1 rounded-full ${VERDICT_SEGMENT[step]} ${step === rating ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : "opacity-30"}`}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-ink-faint">
        <span>Avoid</span>
        <span>Strong Buy</span>
      </div>
    </div>
  );
}

function VerdictCard({
  run,
  verdict,
  evidence,
}: {
  run: AnalysisRun;
  verdict: VerdictContent;
  evidence: Map<string, EvidenceItem>;
}) {
  const reconciliation = run.reconciliation;
  const blindRating = run.blind_pass?.verdict.rating;
  const changed = reconciliation?.changed_from_blind && blindRating && blindRating !== verdict.rating;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Verdict</p>
          <p
            className={`mt-1.5 inline-block rounded-lg px-4 py-1.5 font-display text-2xl font-semibold tracking-tight ${RATING_STYLES[verdict.rating]}`}
          >
            {verdict.rating}
          </p>
          <VerdictScale rating={verdict.rating} />
          {changed && (
            <p className="mt-2 text-xs text-ink-muted">
              Blind pass said <span className="font-medium text-ink">{blindRating}</span>; changed after
              weighing your notes.
            </p>
          )}
          {!reconciliation && (
            <p className="mt-2 text-xs text-caution">
              Blind pass only — the reconciliation pass didn't complete.
            </p>
          )}
        </div>
        <div className="md:text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Price target range</p>
          {run.schema_version.startsWith("fund") ? (
            <p className="mt-1 text-sm text-ink-faint">Not applicable to a fund (no DCF)</p>
          ) : run.price_target_warning ? (
            <div className="mt-1.5 rounded-md border border-negative/30 bg-negative-subtle px-3 py-2 text-left text-xs text-negative">
              <p className="font-semibold">Price target not reliable</p>
              <p className="mt-0.5">{run.price_target_warning}</p>
            </div>
          ) : run.price_target_low && run.price_target_high ? (
            <>
              <p className="tabular mt-1.5 font-display text-2xl font-semibold tracking-tight text-ink">
                {formatDecimal(run.price_target_low)} – {formatDecimal(run.price_target_high)}
                {run.price_target_currency && (
                  <span className="ml-1 text-xs font-normal text-ink-faint">
                    {run.price_target_currency}
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-ink-faint">DCF bear to bull — calculated, not the model's opinion</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-ink-faint">Unavailable (no DCF)</p>
          )}
        </div>
      </div>

      {reconciliation && reconciliation.reconciliation_narrative && run.user_notes_snapshot?.trim() && (
        <div className="mt-5 rounded-lg border-l-2 border-accent bg-raised p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">How your notes were weighed</p>
          <Prose text={reconciliation.reconciliation_narrative} clampAfter={2} />
          <Citations ids={reconciliation.evidence_ids} evidence={evidence} />
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <BulletList title="Thesis" items={verdict.thesis_bullets} />
        <BulletList title="Top risks" items={verdict.top_risks} />
        <BulletList title="Metrics to monitor" items={verdict.metrics_to_monitor} />
        <BulletList title="What would prove this wrong" items={verdict.invalidation_triggers} />
      </div>
      <Citations ids={verdict.evidence_ids} evidence={evidence} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Moat and narrative sections

/** Sprint 8: a fund's moat is the look-through moat of what it owns, with
 * a caveat saying how much of the fund the judgement rests on. */
/** Collapse-toggle chevron shared by FundMoatCard, MoatCard and
 * NarrativeCard (2026-09-27: a full analysis run is 6-8 of these long
 * text cards — collapsed by default keeps the page scannable). */
function CardChevron({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-raised text-[10px] text-ink-muted transition-transform ${open ? "rotate-90" : ""}`}
    >
      ▶
    </span>
  );
}

function FundMoatCard({
  blind,
  evidence,
}: {
  blind: FundBlindPassOutput;
  evidence: Map<string, EvidenceItem>;
}) {
  const moat = blind.moat;
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <CardTitle icon="moat">The businesses underneath (look-through moat)</CardTitle>
        <span className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${MOAT_STYLES[moat.overall_rating]}`}>
            {moat.overall_rating === "None" ? "No moat" : `${moat.overall_rating} moat`}
          </span>
          <CardChevron open={open} />
        </span>
      </button>
      {open && (
        <>
          <div className="mt-3">
            <Prose text={moat.circle_of_competence_summary} clampAfter={2} />
          </div>
          <p className="mt-3 text-xs text-caution">Coverage: {moat.coverage_caveat}</p>
          <Citations ids={moat.evidence_ids} evidence={evidence} />
        </>
      )}
    </Card>
  );
}

function MoatCard({ run, evidence }: { run: AnalysisRun; evidence: Map<string, EvidenceItem> }) {
  const [open, setOpen] = useState(false);
  const blind = run.blind_pass;
  if (!blind || isFundBlindPass(blind)) return null;
  const moat = blind.moat;
  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <CardTitle icon="moat">Business quality &amp; moat</CardTitle>
        <span className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${MOAT_STYLES[moat.overall_rating]}`}>
            {moat.overall_rating === "None" ? "No moat" : `${moat.overall_rating} moat`}
          </span>
          <CardChevron open={open} />
        </span>
      </button>
      {open && (
        <>
          <div className="mt-3">
            <Prose text={moat.circle_of_competence_summary} clampAfter={2} />
          </div>
          <Citations ids={moat.evidence_ids} evidence={evidence} />

          <ul className="mt-4 divide-y divide-border-subtle border-t border-border-subtle">
            {moat.sources.map((source) => (
              <li key={source.source} className="py-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-ink">
                    {MOAT_SOURCE_LABELS[source.source] ?? source.source}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${MOAT_STYLES[source.rating]}`}>
                    {source.rating}
                  </span>
                </div>
                <p className="mt-1 max-w-[72ch] text-sm leading-relaxed text-ink-muted">
                  <WithFigures text={source.reasoning} />
                </p>
                <Citations ids={source.evidence_ids} evidence={evidence} />
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

type SectionIcon =
  | "moat"
  | "capital"
  | "fortress"
  | "macro"
  | "valuation"
  | "steward"
  | "portfolio"
  | "role";

// Simple 24px line icons (stroke = currentColor), one per analysis section,
// so the cards can be told apart before reading a word.
const ICON_PATHS: Record<SectionIcon, string> = {
  moat: "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z M9 12l2 2 4-4",
  capital: "M3 17l6-6 4 4 8-8 M15 7h6v6",
  fortress: "M4 21V8l4-3 4 3 4-3 4 3v13 M4 21h16 M10 21v-5h4v5",
  macro: "M12 3a9 9 0 100 18 9 9 0 000-18z M3 12h18 M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z",
  valuation: "M12 3v18 M5 7h14 M5 7l-3 7a4 4 0 006 0L5 7z M19 7l-3 7a4 4 0 006 0l-3-7z",
  steward: "M12 11a4 4 0 100-8 4 4 0 000 8z M4 21a8 8 0 0116 0",
  portfolio: "M12 3v9l7.8 4.5 M12 3a9 9 0 109 9",
  role: "M12 3a9 9 0 100 18 9 9 0 000-18z M12 8a4 4 0 100 8 4 4 0 000-8z M12 11.5v1",
};

function CardTitle({ icon, children }: { icon: SectionIcon; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-3 font-display text-[15px] font-semibold tracking-tight text-ink">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={ICON_PATHS[icon]} />
        </svg>
      </span>
      {children}
    </h3>
  );
}

function NarrativeCard({
  title,
  icon,
  section,
  evidence,
}: {
  title: string;
  icon: SectionIcon;
  section: NarrativeAssessment;
  evidence: Map<string, EvidenceItem>;
}) {
  const gaps = dataGapCount(section.summary);
  const [open, setOpen] = useState(false);
  return (
    <Card className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex w-full items-start justify-between gap-3 text-left ${open ? "mb-4" : ""}`}
      >
        <CardTitle icon={icon}>{title}</CardTitle>
        <span className="flex shrink-0 items-center gap-2">
          {gaps > 0 && (
            <span
              className="rounded-full bg-caution-subtle px-2 py-0.5 text-[11px] font-medium text-caution"
              title="Sentences where the analysis says it lacked data — highlighted below"
            >
              {gaps} data gap{gaps === 1 ? "" : "s"}
            </span>
          )}
          <CardChevron open={open} />
        </span>
      </button>
      {open && (
        <>
          <div className="flex-1">
            <Prose text={section.summary} />
          </div>
          <Citations ids={section.evidence_ids} evidence={evidence} />
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Run details: data gaps, citation warnings, full evidence list

function RunDetails({ run }: { run: AnalysisRun }) {
  const warnings = [
    ...(run.blind_pass_citation_warnings ?? []),
    ...(run.reconciliation_citation_warnings ?? []),
  ];
  const byCategory = new Map<string, EvidenceItem[]>();
  for (const item of run.evidence_items) {
    byCategory.set(item.category, [...(byCategory.get(item.category) ?? []), item]);
  }

  return (
    <Card>
      <h3 className="text-sm font-semibold text-ink">About this run</h3>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
        <div>
          <dt className="text-xs text-ink-muted">Started</dt>
          <dd className="tabular text-ink">{formatDate(run.started_at)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Model</dt>
          <dd className="text-ink">{run.model_name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Versions</dt>
          <dd className="text-ink">
            schema {run.schema_version}, prompt {run.blind_prompt_version}, evidence{" "}
            {run.evidence_packet_version}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Evidence items</dt>
          <dd className="tabular text-ink">{run.evidence_items.length}</dd>
        </div>
      </dl>

      {warnings.length > 0 && (
        <div className="mt-4 rounded-md bg-caution-subtle p-3 text-sm text-caution">
          <p className="font-medium">Citation warnings</p>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {run.evidence_unavailable_reasons.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-ink-muted hover:text-ink">
            Data that was missing for this run ({run.evidence_unavailable_reasons.length})
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-ink-muted">
            {run.evidence_unavailable_reasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        </details>
      )}

      {run.evidence_items.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-ink-muted hover:text-ink">
            All evidence the model was given ({run.evidence_items.length})
          </summary>
          <div className="mt-2 space-y-4">
            {[...byCategory.entries()].map(([category, items]) => (
              <div key={category}>
                <p className="text-xs font-medium text-ink-muted">{category.replace(/_/g, " ")}</p>
                <ul className="mt-1 divide-y divide-border-subtle">
                  {items.map((item) => (
                    <li key={item.id} className="py-2">
                      <p className="text-ink">
                        <span className="tabular mr-2 text-xs text-accent">{item.id}</span>
                        {item.label}
                      </p>
                      <p className="mt-0.5 whitespace-pre-line text-xs text-ink-muted">{item.content}</p>
                      {item.citation && (
                        <p className="mt-0.5 break-words text-xs text-ink-faint">{item.citation}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Notes editor

function NotesCard({
  holdingId,
  usedInLatestRun,
}: {
  holdingId: string;
  usedInLatestRun: string | null | undefined;
}) {
  const [note, setNote] = useState<HoldingNote | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getAnalysisNotes(holdingId)
      .then((n) => {
        setNote(n);
        setDraft(n.content);
      })
      .catch((e) => setError(errorText(e)));
  }, [holdingId]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const saved = await api.saveAnalysisNotes(holdingId, draft);
      setNote(saved);
      setDraft(saved.content);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  const dirty = note !== null && draft !== note.content;
  const staleVsRun =
    usedInLatestRun !== undefined && note !== null && (usedInLatestRun ?? "") !== note.content;

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">Your notes &amp; thesis</h3>
          <p className="mt-0.5 text-xs text-ink-faint">
            Only the reconciliation pass reads these. The blind pass never sees them, so its verdict
            stays independent of what you already believe.
          </p>
        </div>
        <div className="shrink-0">
          <Button variant="secondary" onClick={save} disabled={!dirty || saving}>
            {saving ? "Saving…" : "Save notes"}
          </Button>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-negative">{error}</p>}
      <label className="mt-3 block">
        <span className="sr-only">Notes for this holding</span>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={note === null}
          rows={5}
          placeholder="Why you own it, what you expect, what would make you sell…"
          className="w-full rounded-md border border-border px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
      </label>
      <p className="mt-1 text-xs text-ink-faint">
        {note?.updated_at ? `Last saved ${formatDate(note.updated_at)}.` : "Not saved yet."}
        {staleVsRun && !dirty && " Changed since the latest run — run again to have them weighed."}
      </p>
    </Card>
  );
}

// ---------------------------------------------------------------------------

/** The holding page shows the analysis in two tabs: `summary` (status, verdict, readiness)
 * on Overview and `detail` (moat, the narrative sections, your notes, run details) on Analysis.
 * `all` is both, in the old order. */
export type AnalysisView = "all" | "summary" | "detail";

export function AnalysisPanel({
  holdingId,
  view = "all",
  onOpenDetail,
}: {
  holdingId: string;
  view?: AnalysisView;
  /** Overview only: switches to the Analysis tab. */
  onOpenDetail?: () => void;
}) {
  const showSummary = view !== "detail";
  const showDetail = view !== "summary";
  const [run, setRun] = useState<AnalysisRun | null | undefined>(undefined);
  const [runError, setRunError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<AnalysisReadiness | null>(null);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [queue, setQueue] = useState<AnalysisQueue | null>(null);
  const [queueing, setQueueing] = useState(false);

  const pending = queue?.pending.find((r) => r.holding_id === holdingId) ?? null;

  const loadLatest = useCallback(() => {
    return api
      .getLatestAnalysis(holdingId)
      .then(setRun)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setRun(null);
        else {
          setRun(null);
          setRunError(errorText(e));
        }
      });
  }, [holdingId]);

  const loadQueue = useCallback(() => {
    return api
      .getAnalysisQueue()
      .then(setQueue)
      .catch(() => setQueue(null)); // an older backend without /analysis/queue: no local runs
  }, []);

  function loadReadiness() {
    setReadinessError(null);
    api
      .getAnalysisReadiness(holdingId)
      .then(setReadiness)
      .catch((e) => setReadinessError(errorText(e)));
  }

  useEffect(() => {
    setRun(undefined);
    loadLatest();
    loadQueue();
    loadReadiness();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdingId]);

  // While a local run is pending, poll the queue; when it leaves the queue,
  // fetch the finished result.
  const pendingId = pending?.id ?? null;
  useEffect(() => {
    if (!pendingId) return;
    const timer = window.setInterval(() => {
      api
        .getAnalysisQueue()
        .then((q) => {
          setQueue(q);
          if (!q.pending.some((r) => r.id === pendingId)) {
            loadLatest();
            loadReadiness();
          }
        })
        .catch(() => undefined);
    }, QUEUE_POLL_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingId, loadLatest]);

  async function handleQueue() {
    setQueueing(true);
    setRunError(null);
    try {
      await api.queueAnalysis(holdingId);
      await loadQueue();
    } catch (e) {
      setRunError(errorText(e));
    } finally {
      setQueueing(false);
    }
  }

  async function handleCancel(): Promise<boolean> {
    if (!pending) return true;
    setQueueing(true);
    setRunError(null);
    try {
      await api.cancelAnalysisRun(pending.id);
      return true;
    } catch (e) {
      setRunError(errorText(e));
      return false;
    } finally {
      await loadQueue();
      setQueueing(false);
    }
  }

  function confirmCloudRun(): boolean {
    const cost = readiness?.estimated_gemini_calls ?? 2;
    return window.confirm(
      `Run the analysis? This spends about ${cost} Gemini call${cost === 1 ? "" : "s"} of today's quota.`,
    );
  }

  async function handleRunInCloud() {
    if (!confirmCloudRun()) return;
    if (await handleCancel()) await runInCloud();
  }

  async function handleRun() {
    if (!confirmCloudRun()) return;
    await runInCloud();
  }

  async function runInCloud() {
    setRunning(true);
    setRunError(null);
    try {
      setRun(await api.runAnalysis(holdingId));
    } catch (e) {
      setRunError(errorText(e));
    } finally {
      setRunning(false);
      loadReadiness();
    }
  }

  const evidence = new Map((run?.evidence_items ?? []).map((item) => [item.id, item]));
  const blind = run?.blind_pass ?? null;
  const verdict = run?.reconciliation?.verdict ?? blind?.verdict ?? null;
  const status = run ? RUN_STATUS_TEXT[run.status] : null;

  const readinessCard = (
    <ReadinessCard
      readiness={readiness}
      error={readinessError}
      running={running}
      onRun={() => void handleRun()}
      hasRun={Boolean(run)}
      onQueue={handleQueue}
      queueing={queueing}
      pending={Boolean(pending)}
    />
  );

  if (view === "detail" && run === null && !runError) {
    // Nothing to detail yet; the run itself is started from Overview.
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">No analysis yet. Run one from the Overview tab.</p>
        <NotesCard holdingId={holdingId} usedInLatestRun={undefined} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showSummary && (
        <>
          {/* With no result yet the readiness card leads; once there is a verdict it comes first. */}
          {!run && readinessCard}

          {pending && queue && (
            <PendingRunCard
              run={pending}
              queue={queue}
              busy={queueing || running}
              onCancel={() => void handleCancel()}
              onRunInCloud={() => void handleRunInCloud()}
              cloudReady={Boolean(readiness?.ready)}
            />
          )}

          {runError && <p className="text-sm text-negative">{runError}</p>}

          {run === undefined && <p className="text-sm text-ink-muted">Loading latest analysis…</p>}

          {run === null && !runError && (
            <EmptyState>
              No analysis yet. When the readiness checks pass, run one — the verdict, moat breakdown and
              every piece of evidence behind them will show here.
            </EmptyState>
          )}

          {run && status && (
            <p className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
              <span className={`rounded-full px-2 py-0.5 font-medium ${status.style}`}>{status.text}</span>
              <span>Latest run {formatDate(run.started_at)}</span>
              {run.engine === "local" && <span>· on {run.claimed_by ?? "your PC"}</span>}
            </p>
          )}

          {run?.status === "FAILED" && (
            <Card className="border-negative/30">
              <p className="text-sm font-medium text-negative">This run failed</p>
              <p className="mt-1 text-sm text-ink-muted">{run.error_message ?? "No error message recorded."}</p>
            </Card>
          )}

          {run && run.status === "BLIND_ONLY" && run.error_message && (
            <p className="text-xs text-caution">{run.error_message}</p>
          )}

          {run && verdict && <VerdictCard run={run} verdict={verdict} evidence={evidence} />}

          {run && readinessCard}

          {view === "summary" && run && blind && onOpenDetail && (
            <button
              type="button"
              onClick={onOpenDetail}
              className="text-sm font-medium text-accent hover:text-accent-hover"
            >
              Moat, evidence and the full reasoning →
            </button>
          )}
        </>
      )}

      {showDetail && run && blind && isFundBlindPass(blind) && (
        <>
          <FundMoatCard blind={blind} evidence={evidence} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <NarrativeCard title="Steward & costs" icon="steward" section={blind.steward_and_costs} evidence={evidence} />
            <NarrativeCard title="Portfolio construction" icon="portfolio" section={blind.portfolio_construction} evidence={evidence} />
            <NarrativeCard title="Macro & industry stress test" icon="macro" section={blind.macro_stress_test} evidence={evidence} />
            <NarrativeCard title="Valuation" icon="valuation" section={blind.valuation_synthesis} evidence={evidence} />
          </div>
          <NarrativeCard title="Role in your portfolio" icon="role" section={blind.role_in_portfolio} evidence={evidence} />
        </>
      )}

      {showDetail && run && blind && !isFundBlindPass(blind) && (
        <>
          <MoatCard run={run} evidence={evidence} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <NarrativeCard title="Capital efficiency" icon="capital" section={blind.capital_efficiency} evidence={evidence} />
            <NarrativeCard title="Financial fortress" icon="fortress" section={blind.financial_fortress} evidence={evidence} />
            <NarrativeCard title="Macro & industry stress test" icon="macro" section={blind.macro_stress_test} evidence={evidence} />
            <NarrativeCard title="Valuation & margin of safety" icon="valuation" section={blind.valuation_synthesis} evidence={evidence} />
          </div>
        </>
      )}

      {showDetail && (
        <NotesCard holdingId={holdingId} usedInLatestRun={run ? run.user_notes_snapshot : undefined} />
      )}

      {showDetail && run && <RunDetails run={run} />}
    </div>
  );
}
