import { useState } from "react";
import { Link } from "react-router-dom";
import { DIRECTION_CLASS, DIRECTION_LABEL, ageText, ravenHeading, ravenOneLine, ravenReadable, unseen } from "../../lib/ravens";
import type { Raven, Ravens } from "../../lib/types";
import { DocumentReadButton } from "../DocumentReader";
import { Button, Card } from "../ui";

/** Game mode G15, the Ravens: a raven lands on a tower when a new report is captured and says what
 * moved between the newest stored period and the one before. Information, never a verdict: no line
 * says what to do. "Seen" is kept per browser; it never changes a stored value. */

function RavenRow({ raven, onSeen }: { raven: Raven; onSeen: (id: string) => void }) {
  const readable = ravenReadable(raven);
  return (
    <li className="py-3">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span aria-hidden>🪶</span>
        <Link to={`/holdings/${raven.holding_id}`} className="font-medium text-ink hover:underline">
          {ravenHeading(raven)}
        </Link>
        <span className="text-xs text-ink-faint">
          {ageText(raven.age_days)}
          {raven.in_portfolio ? "" : " · watchlist"}
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
  if (!ravens) return null;
  const fresh = unseen(ravens.ravens, seen);
  const old = ravens.ravens.filter((r) => seen.has(r.id));

  return (
    <Card aria-label="Ravens">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="section-title mb-0">The ravens</h2>
        <span className="rounded-full bg-raised px-2.5 py-0.5 text-xs font-semibold text-ink-muted">
          {fresh.length === 0 ? "None waiting" : `${fresh.length} waiting`}
        </span>
        {ravens.demo && (
          <span className="rounded-full bg-caution-subtle px-2.5 py-0.5 text-xs font-semibold text-caution">Demo data</span>
        )}
        {fresh.length > 1 && (
          <Button variant="secondary" onClick={() => onSeen(fresh.map((r) => r.id))}>
            Mark all as seen
          </Button>
        )}
      </div>

      {fresh.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">
          {ravens.ravens.length === 0
            ? `No report has been captured in the last ${ravens.window_days} days.`
            : "Every raven of the last " + ravens.window_days + " days has been seen."}
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-border-subtle">
          {fresh.map((r) => (
            <RavenRow key={r.id} raven={r} onSeen={(id) => onSeen([id])} />
          ))}
        </ul>
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
