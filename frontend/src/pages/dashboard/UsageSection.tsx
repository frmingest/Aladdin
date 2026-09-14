import { useEffect, useState } from "react";
import { getUsageSummary } from "../../services/api";
import type { UsageSummaryOut } from "../../types/usage";
import InfoTooltip from "../../components/InfoTooltip";

const SECTION_EXPLANATION =
  "Real token/request counts Google's Gemini API reports back on every call this app makes (analysis + research) — not an estimate, the same numbers aistudio.google.com/usage is built from. Compared against this account's free-tier limits (entered by hand below — Google doesn't expose that dashboard through an API) to estimate how many more holding analyses you can run today.";

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: "var(--bg-tertiary)" }}>
      <div
        className="h-1.5 rounded-full transition-all"
        style={{ width: `${Math.min(Math.max(pct, 0), 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}

/**
 * LLM usage & free-tier quota (§28 observability follow-up — the Phase 8
 * status review flagged this as "computed per analysis run, never persisted
 * or surfaced"; docs/decisions/0013 fixes that). Reading is always free
 * (§2.7) — there's no manual refresh trigger here, this section just
 * reflects whatever app.services.usage's ledger already has on record.
 * Polls on an interval rather than only on mount, since usage changes from
 * actions elsewhere in the app (running an analysis, refreshing research),
 * not from anything on this page itself.
 */
export default function UsageSection() {
  const [summary, setSummary] = useState<UsageSummaryOut | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      getUsageSummary()
        .then((s) => {
          if (!cancelled) setSummary(s);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    load();
    const interval = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Usage is a nice-to-have overlay on top of the real work the dashboard
  // does — never block or clutter the rest of the page if it can't load.
  if (failed || !summary) return null;

  const requestsPct = summary.rpd_limit > 0 ? (summary.today.requests / summary.rpd_limit) * 100 : 0;
  const barColor =
    requestsPct >= 90 ? "var(--color-negative)" : requestsPct >= 60 ? "var(--color-warning)" : "var(--accent-primary)";
  const minuteTokens = summary.last_minute.input_tokens + summary.last_minute.output_tokens;

  return (
    <section className="terminal-card space-y-4">
      <div className="terminal-card-header">
        <h2 className="terminal-card-title flex items-center gap-2">
          Gemini usage today
          <InfoTooltip text={SECTION_EXPLANATION} />
        </h2>
        <span className="text-xs text-disabled font-mono">as of {new Date(summary.as_of).toLocaleTimeString()}</span>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm flex-wrap gap-x-4">
          <span className="text-secondary">
            {summary.today.requests} / {summary.rpd_limit} requests used today
          </span>
          <span className="font-mono text-tertiary">
            {summary.today.input_tokens.toLocaleString()} in / {summary.today.output_tokens.toLocaleString()} out tokens
          </span>
        </div>
        <Bar pct={requestsPct} color={barColor} />
      </div>

      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
        <div>
          <div className="stat-label">Est. analyses left today</div>
          <div className="text-lg font-mono text-primary">{summary.estimated_analyses_remaining_today}</div>
        </div>
        <div>
          <div className="stat-label">Avg cost / analysis</div>
          <div className="text-sm font-mono text-secondary">
            {summary.avg_tokens_per_analysis.toLocaleString()} tokens ({summary.avg_calls_per_analysis.toFixed(1)} call
            {summary.avg_calls_per_analysis === 1 ? "" : "s"})
          </div>
        </div>
        <div>
          <div className="stat-label">This minute</div>
          <div className="text-sm font-mono text-secondary">
            {summary.last_minute.requests}/{summary.rpm_limit} req · {minuteTokens.toLocaleString()}/
            {summary.tpm_limit.toLocaleString()} tok
          </div>
        </div>
      </div>

      {!summary.baseline_is_calibrated && (
        <p className="text-xs text-tertiary">
          No completed analyses recorded in the ledger yet — the estimate above uses the Vår Energi run as a
          calibration baseline (~{summary.avg_tokens_per_analysis.toLocaleString()} tokens for a single-pass holding
          analysis) until real history takes over.
        </p>
      )}

      <p className="text-xs text-disabled">
        Limits are this account's free-tier quotas for the configured model, entered here by hand — Google doesn't
        expose the aistudio.google.com/usage dashboard through an API, so this can drift if your tier or model
        changes.
      </p>
    </section>
  );
}
