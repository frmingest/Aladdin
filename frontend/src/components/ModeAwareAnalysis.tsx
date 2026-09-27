import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { useAnalystMode } from "../lib/analystMode";
import { AGREEMENT_LABELS, ROLE_LABELS } from "../lib/analystTypes";
import type { Agreement, AutoQueueResult, SideBySide, Synthesis, SynthesisPoint } from "../lib/analystTypes";
import { formatDate } from "../lib/format";
import { AnalysisPanel, NotesCard } from "./AnalysisPanel";
import { Prose } from "./Prose";
import { Button, Card, VerdictBadge } from "./ui";

/**
 * The holding page's analysis section, following the whole-app analyst
 * mode (Epic F22): the Buffett/Munger panel, the Dalio panel, or both side
 * by side with a deterministic agree/disagree strip (story 22.7), the
 * automatic queueing of a missing partner run, and the optional synthesis
 * (story 22.8).
 */

const AGREEMENT_STYLES: Record<Agreement, string> = {
  agree: "bg-positive-subtle text-positive",
  partly_agree: "bg-caution-subtle text-caution",
  disagree: "bg-negative-subtle text-negative",
  incomplete: "bg-border-subtle text-ink-muted",
};

export function ModeAwareAnalysis({ holdingId, refreshKey }: { holdingId: string; refreshKey: number }) {
  const { mode } = useAnalystMode();
  if (mode === "dalio") {
    return (
      <Section title="Ray Dalio analysis">
        <AnalysisPanel key={`d-${refreshKey}`} holdingId={holdingId} persona="dalio" />
      </Section>
    );
  }
  if (mode === "side_by_side") {
    return <SideBySidePanel key={refreshKey} holdingId={holdingId} />;
  }
  return (
    <Section title="Buffett/Munger analysis">
      {/* Keyed on refreshKey so readiness re-checks after an upload or
          EDGAR import adds financial history. */}
      <AnalysisPanel key={`b-${refreshKey}`} holdingId={holdingId} />
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="section-title">{title}</h2>
      {children}
    </div>
  );
}

function autoQueueLine(result: AutoQueueResult | null): string | null {
  if (!result) return null;
  const queued = result.actions.filter((a) => a.action === "queued");
  const capped = result.actions.filter((a) => a.action === "cap_reached");
  const blocked = result.actions.filter((a) => a.action === "blocked");
  const parts: string[] = [];
  if (queued.length)
    parts.push(
      `Queued the missing ${queued.map((a) => (a.persona === "dalio" ? "Dalio" : "Buffett/Munger")).join(" and ")} run on your PC automatically.`,
    );
  if (capped.length) parts.push(`Auto-queue cap reached (${result.auto_queued_last_24h}/${result.cap} in 24 h).`);
  if (blocked.length) parts.push(`Not auto-queued: ${blocked.map((a) => a.detail).join(" ")}`);
  return parts.length ? parts.join(" ") : null;
}

function SideBySidePanel({ holdingId }: { holdingId: string }) {
  const [data, setData] = useState<SideBySide | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoQueue, setAutoQueue] = useState<AutoQueueResult | null>(null);

  const load = useCallback(() => {
    api
      .getSideBySide(holdingId)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the comparison."));
  }, [holdingId]);

  useEffect(() => {
    load();
    // Story 22.7: the missing (or stale) partner run is queued on the local
    // worker automatically. Guardrails live on the server; a 403 in demo
    // mode or an older backend is simply ignored.
    api
      .autoQueueHolding(holdingId)
      .then(setAutoQueue)
      .catch(() => setAutoQueue(null));
  }, [holdingId, load]);

  const line = autoQueueLine(autoQueue);

  return (
    <div className="mb-8">
      <h2 className="section-title">Side-by-side: Buffett/Munger and Ray Dalio</h2>
      {error && <p className="mb-3 text-sm text-negative">{error}</p>}
      {data && <ComparisonStrip data={data} />}
      {line && <p className="mt-2 text-xs text-ink-muted">{line}</p>}
      {data && <SynthesisCard data={data} holdingId={holdingId} onDone={load} />}

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="min-w-0">
          <ColumnHeader title="Buffett/Munger" hint="Is this a wonderful business at a sensible price?" />
          <AnalysisPanel holdingId={holdingId} persona="buffett_munger" showNotes={false} />
        </div>
        <div className="min-w-0">
          <ColumnHeader
            title="Ray Dalio"
            hint="Cycle fit, currency and country risk, and the job it does in the portfolio."
          />
          <AnalysisPanel holdingId={holdingId} persona="dalio" showNotes={false} />
        </div>
      </div>
      <div className="mt-6">
        <NotesCard holdingId={holdingId} usedInLatestRun={undefined} />
      </div>
    </div>
  );
}

function ColumnHeader({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-3 border-b border-border pb-2">
      <h3 className="font-display text-base font-semibold tracking-tight text-ink">{title}</h3>
      <p className="text-xs text-ink-faint">{hint}</p>
    </div>
  );
}

function ComparisonStrip({ data }: { data: SideBySide }) {
  const c = data.comparison;
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${AGREEMENT_STYLES[c.agreement]}`}>
            {AGREEMENT_LABELS[c.agreement]}
          </span>
          <p className="text-sm text-ink">{c.headline}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5">
            Buffett/Munger <VerdictBadge rating={c.buffett_verdict} />
            {c.buffett_moat && <span className="text-ink-faint">· {c.buffett_moat} moat</span>}
          </span>
          <span className="flex items-center gap-1.5">
            Dalio <VerdictBadge rating={c.dalio_verdict} />
            {c.dalio_role && <span className="text-ink-faint">· {ROLE_LABELS[c.dalio_role]}</span>}
          </span>
        </div>
      </div>
      {c.points.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-ink-muted">
          {c.points.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-ink-faint">
        Computed from the two stored verdicts — no model sees both analyses to produce this strip. The two
        answer different questions; the Dalio verdict&apos;s {data.dalio_verdict_basis.charAt(0).toLowerCase()}
        {data.dalio_verdict_basis.slice(1)}
      </p>
    </Card>
  );
}

function PointList({ title, points }: { title: string; points: SynthesisPoint[] }) {
  if (points.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{title}</p>
      <ul className="mt-1.5 space-y-1.5 text-sm text-ink">
        {points.map((p, i) => (
          <li key={i}>
            {p.text}{" "}
            {p.evidence_ids.length > 0 && (
              <span className="font-mono text-[11px] text-accent">[{p.evidence_ids.join(", ")}]</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SynthesisCard({ data, holdingId, onDone }: { data: SideBySide; holdingId: string; onDone: () => void }) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Synthesis | null>(null);
  const synthesis = fresh ?? data.synthesis;
  const bothReady = Boolean(data.buffett?.blind_pass && data.dalio?.blind_pass);

  if (!data.synthesis_enabled && !synthesis) {
    return (
      <p className="mt-2 text-xs text-ink-faint">
        The optional &ldquo;where they&apos;d argue&rdquo; synthesis is off — switch it on under Settings → Analyst
        modes.
      </p>
    );
  }

  async function run() {
    if (!window.confirm("Run the synthesis? It spends one call on the server's LLM and never changes either verdict."))
      return;
    setRunning(true);
    setError(null);
    try {
      setFresh(await api.runSynthesis(holdingId));
      onDone();
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : "Synthesis failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card className="mt-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">Where they&apos;d argue</h3>
          <p className="mt-0.5 text-xs text-ink-faint">
            Optional, labelled model pass over both analyses. It cites both evidence lists (B: / D:) and never
            changes either verdict.
            {synthesis && ` Last run ${formatDate(synthesis.created_at)}.`}
          </p>
        </div>
        {data.synthesis_enabled && (
          <Button variant="secondary" onClick={() => void run()} disabled={running || !bothReady}>
            {running ? "Synthesizing…" : synthesis ? "Run again" : "Run synthesis"}
          </Button>
        )}
      </div>
      {!bothReady && <p className="mt-2 text-xs text-ink-muted">Needs both analyses first.</p>}
      {error && <p className="mt-2 text-sm text-negative">{error}</p>}
      {synthesis?.status === "FAILED" && <p className="mt-2 text-sm text-negative">{synthesis.error_message}</p>}
      {synthesis?.output && (
        <div className="mt-4 space-y-4">
          <Prose text={synthesis.output.where_they_would_argue} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <PointList title="They agree" points={synthesis.output.agreements} />
            <PointList title="They disagree" points={synthesis.output.disagreements} />
            <PointList title="What would settle it" points={synthesis.output.what_would_settle_it} />
          </div>
          {synthesis.citation_warnings.length > 0 && (
            <p className="text-xs text-caution">Citation warnings: {synthesis.citation_warnings.join("; ")}</p>
          )}
        </div>
      )}
    </Card>
  );
}
