import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import type { FreshnessItem, StatusItem, StatusLevel, SystemStatus } from "../lib/types";
import { Button, Card, PageHeader, SectionTitle } from "../components/ui";

/** Feature F4. Everything comes from GET /system/status
 * (backend/app/services/system_status.py), which reads configuration and
 * the database only. Opening this page never calls Gemini, yfinance or
 * any other provider, so it never spends quota. */

const LEVEL: Record<StatusLevel, { dot: string; label: string }> = {
  ok: { dot: "bg-positive", label: "OK" },
  warn: { dot: "bg-caution", label: "Check" },
  error: { dot: "bg-negative", label: "Problem" },
  off: { dot: "bg-ink-faint", label: "Off" },
};

function Level({ status }: { status: StatusLevel }) {
  return (
    <span className="mt-0.5 inline-flex w-20 shrink-0 items-center gap-1.5 text-xs text-ink-muted">
      <span className={`h-2 w-2 rounded-full ${LEVEL[status].dot}`} aria-hidden />
      {LEVEL[status].label}
    </span>
  );
}

function relative(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return iso;
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

function ItemRows({ items }: { items: StatusItem[] }) {
  return (
    <ul className="divide-y divide-border-subtle">
      {items.map((item) => (
        <li key={item.key} className="flex items-start gap-3 py-2.5 text-sm">
          <Level status={item.status} />
          <span className="w-44 shrink-0 text-ink">{item.label}</span>
          <span className="min-w-0 flex-1">
            <span className="text-ink">{item.value}</span>
            {item.detail && <span className="block text-xs text-ink-muted">{item.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function FreshnessRows({ items }: { items: FreshnessItem[] }) {
  return (
    <ul className="divide-y divide-border-subtle">
      {items.map((item) => (
        <li key={item.key} className="flex items-start gap-3 py-2.5 text-sm">
          <Level status={item.status} />
          <span className="w-44 shrink-0 text-ink">{item.label}</span>
          <span className="min-w-0 flex-1">
            <span className="tabular text-ink" title={item.last_at ?? undefined}>
              {item.last_at ? relative(item.last_at) : item.detail || "Never"}
            </span>
            {item.last_at && item.detail && <span className="block text-xs text-ink-muted">{item.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function SystemStatusPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .getSystemStatus()
      .then((s) => {
        setStatus(s);
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Backend unreachable."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const migrationOk =
    status && (!status.migration_current || status.migration_current === status.migration_head);
  const budgetPct = status && status.llm_daily_limit > 0
    ? (status.llm_calls_remaining_today / status.llm_daily_limit) * 100
    : 0;

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <PageHeader
        title="System status"
        subtitle="Configuration, data freshness and recent failures. Nothing here calls an external service."
        actions={
          <Button variant="secondary" onClick={load} disabled={loading}>
            {loading ? "Checking…" : "Refresh"}
          </Button>
        }
      />

      {error && (
        <Card className="mb-6 border-negative/40">
          <p className="text-sm text-negative">{error}</p>
        </Card>
      )}

      {status && (
        <div className="space-y-6">
          <Card className={status.issues.length ? "border-caution/50" : ""}>
            {status.issues.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-ink">
                <span className="h-2 w-2 rounded-full bg-positive" aria-hidden /> No configuration problems found.
              </p>
            ) : (
              <>
                <SectionTitle>Needs attention ({status.issues.length})</SectionTitle>
                <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
                  {status.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <p className="text-xs text-ink-muted">Build</p>
              <p className="mt-1 text-sm font-semibold text-ink">
                v{status.version} · {status.environment}
              </p>
              <p className="mt-0.5 text-xs text-ink-faint">
                {status.commit ? `commit ${status.commit}` : "commit not reported (local run)"}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-ink-muted">Database</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-ink">
                <span className={`h-2 w-2 rounded-full ${migrationOk ? "bg-positive" : "bg-negative"}`} aria-hidden />
                {status.database_dialect ?? "unknown"}
              </p>
              <p className="mt-0.5 text-xs text-ink-faint">
                Migration {status.migration_current ?? "not tracked"}
                {status.migration_current && status.migration_head && status.migration_current !== status.migration_head &&
                  ` · code expects ${status.migration_head}`}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-ink-muted">Gemini calls left today</p>
              <p className="tabular mt-1 text-sm font-semibold text-ink">
                {status.llm_calls_remaining_today} / {status.llm_daily_limit}
              </p>
              <div className="mt-2 h-1.5 rounded-full bg-border-subtle">
                <div
                  className={`h-1.5 rounded-full ${budgetPct < 20 ? "bg-caution" : "bg-accent"}`}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-ink-faint">Counted in this server process; resets on restart.</p>
            </Card>
          </div>

          <Card>
            <SectionTitle hint="What each data source is set to. Keys show only as set or missing.">
              Providers
            </SectionTitle>
            <ItemRows items={status.providers} />
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <SectionTitle hint="When each kind of data was last fetched.">Data freshness</SectionTitle>
              <FreshnessRows items={status.freshness} />
            </Card>
            <Card>
              <SectionTitle>Analysis runs</SectionTitle>
              <ItemRows
                items={status.analysis.map((a) =>
                  a.key === "last_run" && a.value !== "never" ? { ...a, value: relative(a.value) } : a,
                )}
              />
              <div className="mt-4 grid grid-cols-4 gap-2 border-t border-border-subtle pt-4 text-center">
                {Object.entries(status.counts).map(([k, v]) => (
                  <div key={k}>
                    <p className="tabular text-lg font-semibold text-ink">{v}</p>
                    <p className="text-xs capitalize text-ink-muted">{k}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
