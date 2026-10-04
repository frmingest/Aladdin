import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { COUNCIL_LABEL, weightText } from "../lib/rituals";
import type { Council, CouncilItem } from "../lib/types";
import { Line } from "../components/fortress/AdvisorsCard";
import { Card, EmptyState, PageHeader } from "../components/ui";

/** The Council Chamber (game mode G17): a quarterly review room. The agenda is built by fixed rules
 * from stored facts the Fortress already uses (fired tripwires, weak walls, old analyses, reviews
 * owed, holdings outside your circle, the cash figure). Read-only: nothing is traded, attending earns
 * nothing (no streak, no points), and an empty agenda is said plainly, never padded. Each item links
 * to where you can act on it; a decision itself is written in the Journal. */

function Item({ item, n }: { item: CouncilItem; n: number }) {
  const warn = item.tone === "warning";
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-xs font-semibold text-ink-faint">{n}.</span>
        <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            warn ? "bg-caution-subtle text-caution" : "bg-raised text-ink-muted"
          }`}
        >
          {COUNCIL_LABEL[item.kind]}
        </span>
      </div>
      <p className="mt-1 text-sm text-ink-muted">{item.text}</p>
      {item.holdings.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2 text-sm">
          {item.holdings.map((h) => (
            <li key={`${h.holding_id}-${h.name}`} className="rounded-md border border-border px-2 py-1">
              {h.holding_id ? (
                <Link to={`/holdings/${h.holding_id}`} className="text-accent hover:underline">
                  {h.name}
                </Link>
              ) : (
                h.name
              )}
              <span className="ml-1 text-xs text-ink-faint">{weightText(h.weight_pct)}</span>
            </li>
          ))}
          {item.more > 0 && <li className="px-1 py-1 text-xs text-ink-faint">and {item.more} more</li>}
        </ul>
      )}
      <p className="mt-2 flex flex-wrap gap-3 text-xs">
        {(item.kind === "review_due" || item.kind === "cash") && (
          <Link to={item.kind === "cash" ? "/fortress" : "/fortress/records"} className="text-accent hover:underline">
            {item.kind === "cash" ? "Enter cash on the Fortress" : "Open the Hall of Records"}
          </Link>
        )}
        {item.kind === "outside_circle" && (
          <Link to="/fortress/circle" className="text-accent hover:underline">
            Open the Circle of Competence
          </Link>
        )}
        {item.kind === "stale_analysis" && (
          <Link to="/analysis-queue" className="text-accent hover:underline">
            Open the analysis queue
          </Link>
        )}
        <Link to="/journal" className="text-ink-faint hover:text-ink-muted hover:underline">
          Write it in the Journal
        </Link>
      </p>
    </li>
  );
}

export default function CouncilPage() {
  const [council, setCouncil] = useState<Council | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api
      .getCouncil()
      .then((c) => live && setCouncil(c))
      .catch((e: unknown) => live && setError(e instanceof ApiError ? e.message : "Could not load the Council."));
    return () => {
      live = false;
    };
  }, []);

  return (
    <div>
      <PageHeader
        title="Council Chamber"
        subtitle="A quarterly review room: what the fixed rules put on the agenda, and what the advisors say."
        actions={
          <Link to="/fortress" className="text-sm text-accent hover:underline">
            Back to the Fortress
          </Link>
        }
      />
      {error && <EmptyState>{error}</EmptyState>}
      {!error && !council && <p className="text-sm text-ink-muted">The council is gathering…</p>}
      {council && (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="section-title mb-0">The agenda</h2>
              {council.demo && (
                <span className="rounded-full bg-caution-subtle px-2.5 py-0.5 text-xs font-semibold text-caution">Demo data</span>
              )}
            </div>
            <p className="mt-1 text-sm text-ink">{council.summary}</p>
            {council.items.length > 0 && (
              <ol className="mt-2 divide-y divide-border-subtle" aria-label="Council agenda">
                {council.items.map((item, i) => (
                  <Item key={item.kind} item={item} n={i + 1} />
                ))}
              </ol>
            )}
          </Card>

          {council.unknowns.length > 0 && (
            <Card>
              <h2 className="section-title">What the council cannot see</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
                {council.unknowns.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </Card>
          )}

          {council.advisors.length > 0 && (
            <Card>
              <h2 className="section-title">The advisors speak</h2>
              <ul className="divide-y divide-border-subtle">
                {council.advisors.map((line, i) => (
                  <Line key={`${line.rule}-${i}`} line={line} />
                ))}
              </ul>
            </Card>
          )}
          <p className="text-xs text-ink-faint">{council.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
