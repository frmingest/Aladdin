import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { formatDate } from "../lib/format";
import type { MonitorRow, ThesisMonitor, ThesisStatus } from "../lib/types";
import { Card, EmptyState, PageHeader, SectionTitle } from "../components/ui";

/** Sprint 11 — "is my thesis still intact?" One row per holding you own
 * or have a tripwire on, most urgent status first. Everything comes from
 * GET /thesis/monitor (backend/app/services/thesis/monitor.py), which
 * reads stored data only: no LLM call, no live market-data provider. */

const STATUS_ORDER: ThesisStatus[] = ["tripwire_fired", "review", "not_analyzed", "intact"];

const STATUS_STYLE: Record<ThesisStatus, string> = {
  tripwire_fired: "bg-negative-subtle text-negative",
  review: "bg-caution-subtle text-caution",
  not_analyzed: "bg-border-subtle text-ink-faint",
  intact: "bg-positive-subtle text-positive",
};

function StatusPill({ row }: { row: MonitorRow }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[row.status]}`}>
      {row.status_label}
    </span>
  );
}

function MonitorTable({ rows }: { rows: MonitorRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-ink-muted">
            <th className="py-2 pr-4 font-medium">Holding</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 pr-4 font-medium">Tripwires firing</th>
            <th className="py-2 pr-4 font-medium">What changed</th>
            <th className="py-2 pr-4 font-medium">Last analyzed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.holding_id} className="border-t border-border-subtle align-middle">
              <td className="py-3 pr-4">
                <Link to={`/holdings/${row.holding_id}`} className="font-medium text-ink hover:text-accent">
                  {row.name}
                </Link>
                <p className="text-xs text-ink-faint">{row.ticker}</p>
              </td>
              <td className="py-3 pr-4">
                <StatusPill row={row} />
              </td>
              <td className="tabular py-3 pr-4 text-ink-muted">{row.firing_count || "—"}</td>
              <td className="tabular py-3 pr-4 text-ink-muted">{row.change_reason_count || "—"}</td>
              <td className="py-3 pr-4 text-xs text-ink-muted">
                {row.analyzed_at ? formatDate(row.analyzed_at) : "Never"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ThesisMonitorPage() {
  const [monitor, setMonitor] = useState<ThesisMonitor | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getThesisMonitor()
      .then(setMonitor)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load the thesis monitor."));
  }, []);

  const groups = STATUS_ORDER.map((status) => ({
    status,
    rows: (monitor?.rows ?? []).filter((r) => r.status === status),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <PageHeader
        title="Thesis"
        subtitle="Is my thesis still intact? Tripwires, what's changed since the last analysis, and the verdict timeline — for every holding you own or watch."
      />

      {error && <p className="text-sm text-negative">{error}</p>}
      {!monitor && !error && <p className="text-sm text-ink-muted">Loading…</p>}

      {monitor && monitor.rows.length === 0 && (
        <EmptyState>
          Nothing to monitor yet. A holding shows up here once it's in your portfolio or has a
          tripwire — open a holding's page to set one up.
        </EmptyState>
      )}

      {monitor && monitor.rows.length > 0 && (
        <div className="space-y-6">
          {groups.map((group) => (
            <Card key={group.status}>
              <SectionTitle>
                {group.rows[0].status_label} ({group.rows.length})
              </SectionTitle>
              <MonitorTable rows={group.rows} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
