import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { formatDate } from "../lib/format";
import type { MonitorRow, ThesisMonitor, ThesisStatus } from "../lib/types";
import { Card, EmptyState, PageHeader, SectionTitle } from "../components/ui";
import { CheckTripwiresButton } from "../components/TripwireBanner";

/** Sprint 11 — "is my thesis still intact?" One row per holding you own
 * or have a tripwire on, most urgent status first. Everything comes from
 * GET /thesis/monitor (backend/app/services/thesis/monitor.py), which
 * reads stored data only: no LLM call, no live market-data provider. */

const STATUS_ORDER: ThesisStatus[] = ["tripwire_fired", "review", "not_analyzed", "intact"];

const STATUS_BAR: Record<ThesisStatus, string> = {
  tripwire_fired: "bg-negative",
  review: "bg-caution",
  not_analyzed: "bg-ink-faint/50",
  intact: "bg-positive",
};

/** One glance: how many holdings sit in each status. */
function StatusBar({ rows }: { rows: MonitorRow[] }) {
  const total = rows.length;
  return (
    <Card>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-border-subtle"
        role="img"
        aria-label="Holdings by thesis status"
      >
        {STATUS_ORDER.map((status) => {
          const n = rows.filter((r) => r.status === status).length;
          return n > 0 ? (
            <div key={status} className={STATUS_BAR[status]} style={{ width: `${(n / total) * 100}%` }} />
          ) : null;
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {STATUS_ORDER.map((status) => {
          const match = rows.filter((r) => r.status === status);
          if (match.length === 0) return null;
          return (
            <span key={status} className="inline-flex items-center gap-2 text-ink-muted">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_BAR[status]}`} />
              <span className="tabular font-semibold text-ink">{match.length}</span>
              {match[0].status_label}
            </span>
          );
        })}
      </div>
    </Card>
  );
}

/** Signals column: nothing to say = a quiet check mark; otherwise a chip. */
function Signals({ row }: { row: MonitorRow }) {
  if (row.status === "not_analyzed") return <span className="text-xs text-ink-faint">Run an analysis first</span>;
  if (!row.firing_count && !row.change_reason_count) {
    return (
      <span className="text-positive" title="No tripwires firing and nothing changed since the last analysis">
        ✓
      </span>
    );
  }
  return (
    <span className="flex flex-wrap gap-1.5">
      {row.firing_count > 0 && (
        <span className="rounded-full bg-negative-subtle px-2 py-0.5 text-xs font-medium text-negative">
          {row.firing_count} tripwire{row.firing_count === 1 ? "" : "s"} firing
        </span>
      )}
      {row.change_reason_count > 0 && (
        <span className="rounded-full bg-caution-subtle px-2 py-0.5 text-xs font-medium text-caution">
          {row.change_reason_count} change{row.change_reason_count === 1 ? "" : "s"}
        </span>
      )}
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
            <th className="py-2 pr-4 font-medium">Signals</th>
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
                <Signals row={row} />
              </td>
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

  const load = () => {
    api
      .getThesisMonitor()
      .then(setMonitor)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load the thesis monitor."));
  };

  useEffect(load, []);

  const groups = STATUS_ORDER.map((status) => ({
    status,
    rows: (monitor?.rows ?? []).filter((r) => r.status === status),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
      <PageHeader
        title="Thesis"
        subtitle="Is my thesis still intact? One row per holding you own or watch."
        actions={<CheckTripwiresButton onChecked={load} />}
      />

      {monitor && (
        <p className="mb-4 text-xs text-ink-muted">
          {monitor.last_check_at
            ? `Nightly check last ran ${formatDate(monitor.last_check_at)}${monitor.last_check_summary ? ` — ${monitor.last_check_summary}` : ""}.`
            : "The nightly tripwire check hasn't run yet — the PC worker runs it once a day, or press Check now."}
        </p>
      )}

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
          <StatusBar rows={monitor.rows} />
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
