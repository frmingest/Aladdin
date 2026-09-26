import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { formatDate, formatDecimal, formatPercent } from "../lib/format";
import type {
  ChangeReason,
  HoldingThesis,
  MetricDef,
  ThesisStatus,
  TimelineEntry,
  Tripwire,
  TripwireOperator,
  TripwireSuggestion,
} from "../lib/types";
import { Button } from "./ui";

/** Sprint 11 — "is my thesis still intact?" on the holding page: status,
 * what's changed since the last analysis, tripwires (with current
 * values), "make a tripwire" from the latest run's own invalidation
 * triggers / metrics-to-monitor, and the verdict timeline. Everything
 * here is backend/app/services/thesis/* — database-only, no LLM, no live
 * market-data provider. */

const STATUS_STYLE: Record<ThesisStatus, string> = {
  tripwire_fired: "bg-negative-subtle text-negative",
  review: "bg-caution-subtle text-caution",
  not_analyzed: "bg-border-subtle text-ink-faint",
  intact: "bg-positive-subtle text-positive",
};

const ARROW: Record<string, string> = { up: "↑", down: "↓", flat: "→" };

function formatMetricValue(value: string | null, unit: string | undefined): string {
  if (value === null) return "—";
  if (unit === "pct") return formatPercent(value);
  if (unit === "x") return `${formatDecimal(value, 2)}x`;
  return formatDecimal(value, 2);
}

function StatusPill({ thesis }: { thesis: HoldingThesis }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium ${STATUS_STYLE[thesis.status]}`}>
      {thesis.status_label}
    </span>
  );
}

function ChangeReasonsList({ reasons }: { reasons: ChangeReason[] }) {
  if (reasons.length === 0) {
    return <p className="text-sm text-ink-muted">Nothing has changed since the latest analysis.</p>;
  }
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
      {reasons.map((r) => (
        <li key={r.key}>{r.text}</li>
      ))}
    </ul>
  );
}

function TripwireRow({
  tripwire,
  unit,
  onAcknowledge,
  onEdit,
  onDelete,
}: {
  tripwire: Tripwire;
  unit: string | undefined;
  onAcknowledge: (id: string) => void;
  onEdit: (tripwire: Tripwire) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
      <div className="min-w-0">
        <p className="text-ink">
          {tripwire.metric_label} {tripwire.operator} {formatMetricValue(tripwire.threshold, unit)}
          {tripwire.label && <span className="ml-2 text-xs text-ink-faint">"{tripwire.label}"</span>}
        </p>
        <p className="text-xs text-ink-faint">
          {!tripwire.active
            ? "Paused"
            : tripwire.firing
              ? `Firing — now ${formatMetricValue(tripwire.current_value, unit)}`
              : tripwire.unavailable_reason
                ? `No data: ${tripwire.unavailable_reason}`
                : `Now ${formatMetricValue(tripwire.current_value, unit)}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {tripwire.firing && (
          <Button variant="secondary" onClick={() => onAcknowledge(tripwire.id)}>
            Mark seen
          </Button>
        )}
        <Button variant="secondary" onClick={() => onEdit(tripwire)}>
          Edit
        </Button>
        <Button variant="danger" onClick={() => onDelete(tripwire.id)}>
          Delete
        </Button>
      </div>
    </li>
  );
}

function TripwireForm({
  metrics,
  initial,
  onSave,
  onCancel,
}: {
  metrics: MetricDef[];
  initial?: { metric: string; operator: TripwireOperator; threshold: string; label?: string | null };
  onSave: (input: { metric: string; operator: TripwireOperator; threshold: string; label: string | null }) => void;
  onCancel: () => void;
}) {
  const [metric, setMetric] = useState(initial?.metric ?? metrics[0]?.key ?? "");
  const [operator, setOperator] = useState<TripwireOperator>(initial?.operator ?? "below");
  const [threshold, setThreshold] = useState(initial?.threshold ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background/40 p-3">
      <select
        value={metric}
        onChange={(e) => setMetric(e.target.value)}
        className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
      >
        {metrics.map((m) => (
          <option key={m.key} value={m.key}>
            {m.label}
          </option>
        ))}
      </select>
      <select
        value={operator}
        onChange={(e) => setOperator(e.target.value as TripwireOperator)}
        className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
      >
        <option value="below">below</option>
        <option value="above">above</option>
      </select>
      <input
        value={threshold}
        onChange={(e) => setThreshold(e.target.value)}
        placeholder="threshold"
        className="w-28 rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
      />
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="label (optional)"
        className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
      />
      <Button
        onClick={() => threshold && onSave({ metric, operator, threshold, label: label || null })}
        disabled={!threshold || !metric}
      >
        Save
      </Button>
      <Button variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

function SuggestionRow({ suggestion, onMake }: { suggestion: TripwireSuggestion; onMake: (s: TripwireSuggestion) => void }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
      <span className="text-ink">{suggestion.text}</span>
      {suggestion.metric ? (
        <Button variant="secondary" onClick={() => onMake(suggestion)}>
          Make a tripwire
        </Button>
      ) : (
        <span className="text-xs text-ink-faint">Couldn't auto-parse — add one manually below</span>
      )}
    </li>
  );
}

function TimelineRow({ entry }: { entry: TimelineEntry }) {
  return (
    <li className="border-t border-border-subtle py-3 text-sm first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-ink">{formatDate(entry.date)}</span>
        <span className="text-xs text-ink-faint">
          {entry.pass_type === "reconciled" ? "Reconciled" : "Blind only"} · {entry.engine}
          {entry.model_name ? ` · ${entry.model_name}` : ""}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
        <span>
          Verdict: {entry.verdict ?? "—"} {entry.verdict_direction && ARROW[entry.verdict_direction]}
        </span>
        <span>
          Moat: {entry.moat ?? "—"} {entry.moat_direction && ARROW[entry.moat_direction]}
        </span>
        {entry.price && (
          <span>
            Price: {entry.price_currency} {formatDecimal(entry.price)}
          </span>
        )}
        {entry.dcf_low && entry.dcf_high && (
          <span>
            DCF: {formatDecimal(entry.dcf_low)}–{formatDecimal(entry.dcf_high)}
          </span>
        )}
      </div>
      {entry.thesis_bullets.length > 0 && (
        <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs text-ink-muted">
          {entry.thesis_bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function ThesisPanel({ holdingId }: { holdingId: string }) {
  const [thesis, setThesis] = useState<HoldingThesis | null>(null);
  const [metrics, setMetrics] = useState<MetricDef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Tripwire | null>(null);
  const [creatingFrom, setCreatingFrom] = useState<TripwireSuggestion | "blank" | null>(null);

  const load = () => {
    api
      .getHoldingThesis(holdingId)
      .then(setThesis)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load the thesis check."));
  };

  useEffect(() => {
    load();
    api.getThesisMetrics().then(setMetrics).catch(() => setMetrics([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdingId]);

  const unitFor = (metric: string) => metrics.find((m) => m.key === metric)?.unit;

  if (error) return <p className="text-sm text-negative">{error}</p>;
  if (!thesis) return <p className="text-sm text-ink-muted">Loading…</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <StatusPill thesis={thesis} />
        <span className="text-xs text-ink-faint">
          {thesis.analyzed_at ? `Last analyzed ${formatDate(thesis.analyzed_at)}` : "Never analyzed"}
        </span>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">What's changed</h3>
        <ChangeReasonsList reasons={thesis.change_reasons} />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">Tripwires</h3>
        {thesis.tripwires.length === 0 ? (
          <p className="text-sm text-ink-muted">No tripwires set yet.</p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {thesis.tripwires.map((t) => (
              <TripwireRow
                key={t.id}
                tripwire={t}
                unit={unitFor(t.metric)}
                onAcknowledge={(id) => api.acknowledgeTripwire(id).then(load)}
                onEdit={setEditing}
                onDelete={(id) => api.deleteTripwire(id).then(load)}
              />
            ))}
          </ul>
        )}
        {editing && (
          <div className="mt-2">
            <TripwireForm
              metrics={metrics}
              initial={editing}
              onSave={(input) =>
                api
                  .updateTripwire(editing.id, { operator: input.operator, threshold: input.threshold, label: input.label })
                  .then(() => {
                    setEditing(null);
                    load();
                  })
              }
              onCancel={() => setEditing(null)}
            />
          </div>
        )}
        {creatingFrom && (
          <div className="mt-2">
            <TripwireForm
              metrics={metrics}
              initial={
                creatingFrom === "blank"
                  ? undefined
                  : {
                      metric: creatingFrom.metric ?? metrics[0]?.key ?? "",
                      operator: creatingFrom.operator ?? "below",
                      threshold: creatingFrom.threshold ?? "",
                    }
              }
              onSave={(input) =>
                api
                  .createTripwire(holdingId, {
                    ...input,
                    origin: creatingFrom === "blank" ? "manual" : "from_analysis",
                    source_run_id: thesis.timeline[0]?.run_id ?? null,
                  })
                  .then(() => {
                    setCreatingFrom(null);
                    load();
                  })
              }
              onCancel={() => setCreatingFrom(null)}
            />
          </div>
        )}
        {!editing && !creatingFrom && (
          <div className="mt-2">
            <Button variant="secondary" onClick={() => setCreatingFrom("blank")}>
              Add a tripwire
            </Button>
          </div>
        )}
      </div>

      {thesis.suggestions.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-ink">
            From the latest analysis's invalidation triggers &amp; metrics to monitor
          </h3>
          <ul className="divide-y divide-border-subtle">
            {thesis.suggestions.map((s, i) => (
              <SuggestionRow key={i} suggestion={s} onMake={setCreatingFrom} />
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">Verdict timeline</h3>
        {thesis.timeline.length === 0 ? (
          <p className="text-sm text-ink-muted">No completed analysis runs yet.</p>
        ) : (
          <ul>
            {thesis.timeline.map((entry) => (
              <TimelineRow key={entry.run_id} entry={entry} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default ThesisPanel;
