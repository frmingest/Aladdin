import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { councilSeats } from "../lib/councilSeats";
import { ADVISOR_TONE_LABEL, advisorRuleLabel } from "../lib/fortress";
import { usePlainView } from "../lib/plainView";
import { COUNCIL_LABEL, weightText } from "../lib/rituals";
import { sealForTone } from "../lib/seals";
import type { Council, CouncilItem, CouncilKind } from "../lib/types";
import CouncilChamber from "../components/fortress/kit/CouncilChamber";
import FogPanel from "../components/fortress/kit/FogPanel";
import ParchmentPanel from "../components/fortress/kit/ParchmentPanel";
import SealMark from "../components/fortress/kit/SealMark";
import Speaker from "../components/fortress/kit/Speaker";
import GameFooter from "../components/fortress/GameFooter";
import { Card, EmptyState, PageHeader } from "../components/ui";

/** The Council Chamber (game mode G17): a quarterly review room. The agenda is built by fixed rules
 * from stored facts the Fortress already uses (fired tripwires, weak walls, old analyses, reviews
 * owed, holdings outside your circle, the cash figure). Read-only: nothing is traded, attending earns
 * nothing (no streak, no points), and an empty agenda is said plainly, never padded. Each item links
 * to where you can act on it; a decision itself is written in the Journal.
 *
 * Identity pass (page-scene kit): a round-table chamber with one seat per rule, parchment folios with
 * wax seals (shape + glyph + word), advisors with speech bubbles and a fog panel for what cannot be
 * seen. The painting only repeats facts the list below already states; Plain view drops it. */

function Pennant() {
  return (
    <svg viewBox="0 0 14 12" width="14" height="12" aria-hidden className="shrink-0">
      <path d="M1 1 H13 L10 6 L13 11 H1 Z" fill="#6b4d1a" stroke="#3a2a0e" strokeWidth="0.8" />
    </svg>
  );
}

function Folio({ item, n }: { item: CouncilItem; n: number }) {
  return (
    <li className="py-1.5">
      <ParchmentPanel id={`council-item-${item.kind}`} tabIndex={-1} className="scroll-mt-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="library-plaque">
              <span className="text-xs font-semibold">{n}.</span> {COUNCIL_LABEL[item.kind]}
            </p>
            <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
          </div>
          <SealMark kind={sealForTone(item.tone)} showLabel />
        </div>
        <p className="mt-1 text-sm text-ink-muted">{item.text}</p>
        {item.holdings.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2 text-sm">
            {item.holdings.map((h) => (
              <li key={`${h.holding_id}-${h.name}`} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1">
                <Pennant />
                {h.holding_id ? (
                  <Link to={`/holdings/${h.holding_id}`} className="text-accent hover:underline">
                    {h.name}
                  </Link>
                ) : (
                  h.name
                )}
                <span className="text-xs text-ink-faint">{weightText(h.weight_pct)}</span>
              </li>
            ))}
            {item.more > 0 && <li className="px-1 py-1 text-xs text-ink-faint">and {item.more} more</li>}
          </ul>
        )}
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {(item.kind === "review_due" || item.kind === "cash") && (
            <Link to={item.kind === "cash" ? "/fortress" : "/fortress/records"} className="inline-block py-2 text-accent hover:underline">
              {item.kind === "cash" ? "Enter cash on the Fortress" : "Open the Hall of Records"}
            </Link>
          )}
          {item.kind === "outside_circle" && (
            <Link to="/fortress/circle" className="inline-block py-2 text-accent hover:underline">
              Open the Circle of Competence
            </Link>
          )}
          {item.kind === "stale_analysis" && (
            <Link to="/analysis-queue" className="inline-block py-2 text-accent hover:underline">
              Open the analysis queue
            </Link>
          )}
          <Link to="/journal" className="inline-block py-2 text-ink-faint hover:text-ink-muted hover:underline">
            Write it in the Journal
          </Link>
        </p>
      </ParchmentPanel>
    </li>
  );
}

export default function CouncilPage() {
  const [council, setCouncil] = useState<Council | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plain] = usePlainView();

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

  const seats = useMemo(() => (council ? councilSeats(council) : []), [council]);

  function jump(kind: CouncilKind) {
    const el = document.getElementById(`council-item-${kind}`);
    if (!el) return;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    el.focus({ preventScroll: true });
  }

  return (
    <div>
      <PageHeader
        title="Council Chamber"
        subtitle="A quarterly review room: what the fixed rules put on the agenda, and what the advisors say."
        actions={
          <Link to="/fortress" className="inline-block py-2 text-sm text-accent hover:underline">
            Back to the Fortress
          </Link>
        }
      />
      {error && <EmptyState>{error}</EmptyState>}
      {!error && !council && <p className="text-sm text-ink-muted">The council is gathering…</p>}
      {council && (
        <div className="space-y-4">
          {!plain && <CouncilChamber seats={seats} onJump={jump} unresolved={council.unknowns.length > 0} />}
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="section-title mb-0">The agenda</h2>
              {council.demo && (
                <span className="rounded-full bg-caution-subtle px-2.5 py-0.5 text-xs font-semibold text-caution">Demo data</span>
              )}
            </div>
            <p className="mt-1 text-sm text-ink">{council.summary}</p>
            {council.items.length > 0 && (
              <ol className="mt-2" aria-label="Council agenda">
                {council.items.map((item, i) => (
                  <Folio key={item.kind} item={item} n={i + 1} />
                ))}
              </ol>
            )}
          </Card>

          <FogPanel title="What the council cannot see" lines={council.unknowns} />

          {council.advisors.length > 0 && (
            <Card>
              <h2 className="section-title">The advisors speak</h2>
              <ul>
                {council.advisors.map((line, i) => (
                  <Speaker
                    key={`${line.rule}-${i}`}
                    who={line.advisor}
                    seal={line.tone === "warning" ? "alert" : "notice"}
                    toneLabel={ADVISOR_TONE_LABEL[line.tone]}
                    side={line.advisor === "partner" ? "right" : "left"}
                  >
                    {line.holding_id && line.holding_name && (
                      <Link to={`/holdings/${line.holding_id}`} className="mb-1 inline-block text-[#f2d27a] hover:underline">
                        {line.holding_name}
                      </Link>
                    )}
                    <p className="text-[#f3e4bf]">{line.text}</p>
                    {line.facts.length > 0 && (
                      <details className="mt-1 text-xs text-[#cdb98c]">
                        <summary className="cursor-pointer select-none">Why this line</summary>
                        <p className="mt-1">Rule: {advisorRuleLabel(line.rule)}</p>
                        <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
                          {line.facts.map((f) => (
                            <li key={f}>{f}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </Speaker>
                ))}
              </ul>
            </Card>
          )}
          <GameFooter rules={`Council rules ${council.rules_version}.`}>
            <p className="mt-1">{council.disclaimer}</p>
          </GameFooter>
        </div>
      )}
    </div>
  );
}
