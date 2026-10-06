import { useState } from "react";
import { Link } from "react-router-dom";
import { budgetWarnings, DEFAULT_WARNING_BUDGET, type WarningItem, type WarningSeverity } from "../lib/warnings";

/** Renders warnings under the page's warning budget (lib/warnings.ts): at most
 * `max` visible, ranked, "+N more" for the rest, and plumbing as one small
 * muted line that links to System status rather than as a warning.
 *
 * Investment and data warnings use the warning colours; plumbing never does,
 * so an offline worker cannot look like a concentrated portfolio. */

const SEVERITY_STYLE: Record<WarningSeverity, { row: string; dot: string; label: string }> = {
  high: { row: "border-negative/40 bg-negative-subtle", dot: "bg-negative", label: "Important" },
  medium: { row: "border-caution/40 bg-caution-subtle", dot: "bg-caution", label: "Check" },
  low: { row: "border-border bg-surface", dot: "bg-ink-faint", label: "Note" },
};

function WarningRow({ item }: { item: WarningItem }) {
  const style = SEVERITY_STYLE[item.severity];
  const body = (
    <>
      <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
      <span className="min-w-0">
        <span className="sr-only">{style.label}: </span>
        <span className="block text-sm font-medium text-ink">{item.title}</span>
        {item.detail && <span className="mt-0.5 block text-xs text-ink-muted">{item.detail}</span>}
      </span>
      {item.to && (
        <span aria-hidden className="ml-auto shrink-0 self-center text-xs font-medium text-accent">
          Open →
        </span>
      )}
    </>
  );
  const className = `flex gap-2.5 rounded-lg border px-3.5 py-2.5 ${style.row}`;
  return item.to ? (
    <Link to={item.to} className={`${className} transition-colors hover:border-accent/50`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function WarningStack({
  items,
  max = DEFAULT_WARNING_BUDGET,
  statusLink = "/status",
}: {
  items: WarningItem[];
  max?: number;
  statusLink?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const { visible, hidden, infrastructure } = budgetWarnings(items, max);
  const shown = showAll ? [...visible, ...hidden] : visible;

  if (shown.length === 0 && infrastructure.length === 0) return null;

  return (
    <div className="space-y-2">
      {shown.length > 0 && (
        <ul className="space-y-2">
          {shown.map((item) => (
            <li key={item.id}>
              <WarningRow item={item} />
            </li>
          ))}
        </ul>
      )}
      {hidden.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="text-xs font-medium text-accent hover:text-accent-hover"
        >
          {showAll ? "Show fewer" : `+${hidden.length} more`}
        </button>
      )}
      {infrastructure.length > 0 && (
        <p className="text-xs text-ink-faint">
          <Link to={statusLink} className="hover:text-ink-muted">
            {infrastructure.length === 1 ? infrastructure[0].title : `${infrastructure.length} system notes`} · System status →
          </Link>
        </p>
      )}
    </div>
  );
}
