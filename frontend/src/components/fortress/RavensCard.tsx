import { useState } from "react";
import { Link } from "react-router-dom";
import {
  DIRECTION_CLASS,
  DIRECTION_LABEL,
  RECENT_HOURS,
  ageText,
  groupSummary,
  ravenHeading,
  ravenOneLine,
  ravenReadable,
  splitRavens,
  type RavenScope,
} from "../../lib/ravens";
import type { Raven, Ravens } from "../../lib/types";
import { DocumentReadButton } from "../DocumentReader";
import { Button, Card } from "../ui";

/** Game mode G15, the Ravens: a raven lands on a tower when a new report is captured and says what
 * moved between the newest stored period and the one before. Information, never a verdict: no line
 * says what to do. "Seen" is kept per browser; it never changes a stored value. */

function RavenRow({ raven, onSeen, compact = false }: { raven: Raven; onSeen: (id: string) => void; compact?: boolean }) {
  const readable = ravenReadable(raven);
  return (
    <li className="py-3">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span aria-hidden>🪶</span>
        {compact ? (
          <span className="font-medium text-ink">{raven.period ? `${raven.period} report` : "A report"}</span>
        ) : (
          <Link to={`/holdings/${raven.holding_id}`} className="font-medium text-ink hover:underline">
            {ravenHeading(raven)}
          </Link>
        )}
        <span className="text-xs text-ink-faint">
          {ageText(raven.age_days)}
          {raven.in_portfolio || compact ? "" : " · watchlist"}
        </span>
      </p>
      <p className="mt-1 text-sm text-ink-muted">{ravenOneLine(raven)}</p>
      {raven.lines.length > 0 && (
        <details className="mt-1 text-sm">
          <summary className="cursor-pointer select-none text-xs text-ink-faint hover:text-ink-muted">
            What moved
          </summary>
          <ul className="mt-1 space-y-1">
            {raven.lines.map((line) => (
              <li key={line.metric} className="flex flex-wrap items-baseline gap-x-2">
                <span className={`w-28 shrink-0 text-xs font-semibold ${DIRECTION_CLASS[line.direction]}`}>
                  {DIRECTION_LABEL[line.direction]}
                </span>
                <span className="text-ink-muted">{line.text}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-x-3">
        {readable && <DocumentReadButton document={readable} label="Read the report" className="-ml-1.5" />}
        <button
          type="button"
          onClick={() => onSeen(raven.id)}
          className="text-xs text-ink-faint underline-offset-2 hover:text-ink-muted hover:underline"
        >
          Mark as seen
        </button>
      </div>
    </li>
  );
}

const SCOPES: { id: RavenScope; label: string }[] = [
  { id: "all", label: "All" },
  { id: "portfolio", label: "Portfolio" },
  { id: "watchlist", label: "Watchlist" },
];

export default function RavensCard({
  ravens,
  seen,
  onSeen,
}: {
  ravens: Ravens | null;
  seen: Set<string>;
  onSeen: (ids: string[]) => void;
}) {
  const [showSeen, setShowSeen] = useState(false);
  const [scope, setScope] = useState<RavenScope>("all");
  if (!ravens) return null;
  const { recent, earlier, earlierCount } = splitRavens(ravens.ravens, seen, ravens.as_of, scope);
  const old = ravens.ravens.filter((r) => seen.has(r.id));
  const allUnseen = recent.length + earlierCount;

  return (
    <Card aria-label="Ravens">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="section-title mb-0">The ravens</h2>
        <span className="rounded-full bg-raised px-2.5 py-0.5 text-xs font-semibold text-ink-muted">
          {recent.length === 0 ? "None in the last 48 hours" : `${recent.length} new`}
        </span>
        {ravens.demo && (
          <span className="rounded-full bg-caution-subtle px-2.5 py-0.5 text-xs font-semibold text-caution">Demo data</span>
        )}
        {recent.length > 1 && (
          <Button variant="secondary" onClick={() => onSeen(recent.map((r) => r.id))}>
            Mark new as seen
          </Button>
        )}
        <div className="ml-auto flex gap-1" role="group" aria-label="Which ravens">
          {SCOPES.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={scope === o.id}
              onClick={() => setScope(o.id)}
              className={`rounded-full px-2.5 py-0.5 text-xs ${
                scope === o.id ? "bg-raised font-semibold text-ink" : "text-ink-faint hover:text-ink-muted"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {recent.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">
          {ravens.ravens.length === 0
            ? `No report has been captured in the last ${ravens.window_days} days.`
            : allUnseen === 0
              ? `Every raven of the last ${ravens.window_days} days has been seen.`
              : `No report landed in the last ${RECENT_HOURS} hours.`}
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-border-subtle">
          {recent.map((r) => (
            <RavenRow key={r.id} raven={r} onSeen={(id) => onSeen([id])} />
          ))}
        </ul>
      )}

      {earlierCount > 0 && (
        <details className="mt-3 rounded-lg border border-border-subtle px-3 py-2">
          <summary className="cursor-pointer select-none text-sm text-ink-muted hover:text-ink">
            Earlier: {earlierCount} {earlierCount === 1 ? "report" : "reports"} from {earlier.length}{" "}
            {earlier.length === 1 ? "company" : "companies"}
          </summary>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => onSeen(earlier.flatMap((g) => g.ravens.map((r) => r.id)))}
              className="text-xs text-ink-faint underline-offset-2 hover:text-ink-muted hover:underline"
            >
              Mark all earlier as seen
            </button>
          </div>
          <ul className="divide-y divide-border-subtle">
            {earlier.map((g) => (
              <li key={g.holding_id} className="py-1">
                <details>
                  <summary className="flex cursor-pointer select-none flex-wrap items-baseline gap-x-2 py-1.5 text-sm">
                    <span className="font-medium text-ink">{g.name}</span>
                    <span className="text-xs text-ink-faint">
                      {groupSummary(g)}
                      {g.in_portfolio ? "" : " · watchlist"}
                    </span>
                  </summary>
                  <div className="pl-3">
                    <ul className="divide-y divide-border-subtle">
                      {g.ravens.map((r) => (
                        <RavenRow key={r.id} raven={r} compact onSeen={(id) => onSeen([id])} />
                      ))}
                    </ul>
                    <div className="flex gap-3 pb-1">
                      <Link to={`/holdings/${g.holding_id}`} className="text-xs text-ink-faint hover:text-ink-muted hover:underline">
                        Open {g.name}
                      </Link>
                      <button
                        type="button"
                        onClick={() => onSeen(g.ravens.map((r) => r.id))}
                        className="text-xs text-ink-faint underline-offset-2 hover:text-ink-muted hover:underline"
                      >
                        Mark {g.name} as seen
                      </button>
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </details>
      )}

      {old.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowSeen((v) => !v)}
            className="text-xs text-ink-faint hover:text-ink-muted"
            aria-expanded={showSeen}
          >
            {showSeen ? "Hide" : "Show"} {old.length} seen {old.length === 1 ? "raven" : "ravens"}
          </button>
          {showSeen && (
            <ul className="mt-1 divide-y divide-border-subtle opacity-75">
              {old.map((r) => (
                <li key={r.id} className="py-2 text-sm text-ink-muted">
                  <Link to={`/holdings/${r.holding_id}`} className="hover:underline">
                    {ravenHeading(r)}
                  </Link>
                  <span className="text-xs text-ink-faint"> · {ageText(r.age_days)}</span>
                  <p className="text-xs">{ravenOneLine(r)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <p className="mt-2 text-xs text-ink-faint">
        A raven says what moved between two stored reports. It is not a verdict and not a reason to trade. Half-year
        reports are read as text only, so they carry no comparison.
      </p>
    </Card>
  );
}
