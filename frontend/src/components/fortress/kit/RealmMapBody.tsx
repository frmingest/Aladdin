import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MAP_COPY, PATCH_LOOK, flagsFor, commissionShape } from "../../../lib/realmMap";
import { weightText } from "../../../lib/rituals";
import type { Commission, SurveyState, TowerFog } from "../../../lib/survey";
import { Card, Disclosure, EmptyState } from "../../ui";
import CommissionSeal from "./CommissionSeal";
import { FogDefs, PatchMark } from "./FogPatch";
import WorldMap from "./WorldMap";
import NightPanel from "./NightPanel";
import TowerSlate from "./TowerSlate";
import "./realmMap.css";

/** The body of the Cartographer's table (game mode G34 / G35, wins 1 to 4): every tower with its five
 * fog patches, a slate for the tower you press, and the commissions as numbered seals that plant flags
 * on the towers they cover. Read-only: nothing here trades, scores or rewards anything. The numbered
 * list of commissions and the closed text list of towers are the accessible source of truth; the
 * painting only repeats what they say. `painted` false renders the same facts as ordinary cards (Plain
 * view, or game mode off). */

const weightOf = (t: TowerFog) => weightText(t.weightPct === null ? null : String(t.weightPct));

function holdingTo(commissionId: string, holdingId: string): string {
  if (commissionId === "report") return `/holdings/${holdingId}?tab=documents`;
  if (commissionId === "valuation") return `/holdings/${holdingId}?tab=analysis`;
  return `/holdings/${holdingId}`;
}

/** The text list of the survey: every tower, every check, with its word and reason. Same labels and
 * reasons as the slate. Fog is not drawn fainter than clear here either. */
function SurveyList({ towers }: { towers: TowerFog[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Fog by tower">
      {towers.map((t) => (
        <li key={t.holdingId} className="rounded-md border border-border p-3">
          <div className="flex items-baseline justify-between gap-2">
            <Link to={`/holdings/${t.holdingId}`} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-accent hover:underline">
              {t.name}
            </Link>
            <span className="text-xs text-ink-muted">{weightOf(t)}</span>
          </div>
          <ul className="mt-1 space-y-1 text-sm text-ink">
            {t.checks.map((c) => (
              <li key={c.id}>
                <span aria-hidden="true" className="inline-block w-5 font-semibold">
                  {PATCH_LOOK[c.state].glyph}
                </span>
                {c.label}: {PATCH_LOOK[c.state].word.toLowerCase()}. {c.reason}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function HoldingChips({ commission }: { commission: Commission }) {
  return (
    <ul className="flex flex-wrap gap-2 text-sm">
      {commission.holdings.map((h) => (
        <li key={h.holdingId ?? h.name} className="inline-flex min-h-[44px] items-center rounded-md border border-border">
          {h.holdingId ? (
            <Link to={holdingTo(commission.id, h.holdingId)} className="inline-flex min-h-[44px] items-center px-3 text-accent hover:underline">
              {h.name}
            </Link>
          ) : (
            <span className="px-3">{h.name}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function CommissionEnd({ commission }: { commission: Commission }) {
  if (!commission.to) return null;
  return (
    <p className="text-xs">
      <Link to={commission.to} className="inline-flex min-h-[44px] items-center text-accent hover:underline">
        {commission.linkLabel}
      </Link>
    </p>
  );
}

function DemoPill() {
  return <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-ink-muted">{MAP_COPY.demo}</span>;
}

/** The three looks, once, with their printed words. */
function Key({ hatchId }: { hatchId: string }) {
  const states: SurveyState[] = ["fog", "clear", "not_judged"];
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink" aria-label="Key">
      {states.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <PatchMark state={s} hatchId={hatchId} size={28} />
          <span className="font-semibold">{PATCH_LOOK[s].word}</span>
        </li>
      ))}
    </ul>
  );
}

function PaintedBody({
  towers,
  commissions,
  demo,
  sectors,
  sectorsKnown,
}: {
  towers: TowerFog[];
  commissions: Commission[];
  demo: boolean;
  sectors: Record<string, string | null>;
  sectorsKnown: boolean;
}) {
  const hatchId = `fog-hatch-${useId().replace(/:/g, "")}`;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [commissionId, setCommissionId] = useState<string | null>(null);
  const slateRef = useRef<HTMLDivElement | null>(null);

  const selected = towers.find((t) => t.holdingId === selectedId) ?? null;
  const flags = useMemo(() => flagsFor(commissions, commissionId, towers.map((t) => t.holdingId)), [commissions, commissionId, towers]);
  const flagByTower = useMemo(() => new Map(flags.map((f) => [f.target, f])), [flags]);

  useEffect(() => {
    if (!selected || !slateRef.current || typeof slateRef.current.scrollIntoView !== "function") return;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    slateRef.current.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [selected]);

  function closeSlate() {
    const id = selectedId;
    setSelectedId(null);
    if (id) document.getElementById(`wm-btn-${id}`)?.focus();
  }

  return (
    <div className="space-y-4">
      <FogDefs id={hatchId} />
      <NightPanel>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="section-title mb-0">The map</h2>
          {demo && <DemoPill />}
        </div>
        <p className="mt-1 text-sm text-ink-muted">{MAP_COPY.intro}</p>
        {towers.length === 0 ? (
          <EmptyState>{MAP_COPY.empty}</EmptyState>
        ) : (
          <>
            <div className="mt-3">
              <Key hatchId={hatchId} />
              <p className="mt-1 text-xs text-ink-muted">{MAP_COPY.hint} {MAP_COPY.hintSeal}</p>
            </div>
            <div className="mt-3">
              <WorldMap
                towers={towers}
                sectors={sectors}
                sectorsKnown={sectorsKnown}
                hatchId={hatchId}
                selectedId={selectedId}
                flags={flagByTower}
                onSelect={(id) => setSelectedId((cur) => (cur === id ? null : id))}
                onEscape={() => selectedId !== null && closeSlate()}
              />
            </div>
            <div id="map-slate" ref={slateRef} className="mt-3 scroll-mt-4" aria-live="polite">
              {selected && <TowerSlate tower={selected} hatchId={hatchId} onClose={closeSlate} />}
            </div>
            <Disclosure label="the survey as a list" className="map-disc mt-2">
              <SurveyList towers={towers} />
            </Disclosure>
          </>
        )}
      </NightPanel>

      <NightPanel>
        <h2 className="section-title">Commissions</h2>
        {commissions.length === 0 ? (
          <p className="text-sm text-ink-muted">{MAP_COPY.commissionsEmpty}</p>
        ) : (
          <ol className="divide-y divide-border-subtle" aria-label="Commissions">
            {commissions.map((c, i) => {
              const shape = commissionShape(c.id);
              const planted = commissionId === c.id;
              return (
                <li key={c.id} className="flex items-start gap-2 py-2">
                  {c.id === "vault" ? (
                    // The cash commission plants its flag on the Great Keep at the capital.
                    <button
                      type="button"
                      className="map-seal-btn"
                      aria-pressed={planted}
                      aria-label={`Show on the map: ${c.title}`}
                      onClick={() => setCommissionId((cur) => (cur === c.id ? null : c.id))}
                    >
                      <CommissionSeal shape={shape} n={i + 1} size={34} pressed={planted} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="map-seal-btn"
                      aria-pressed={planted}
                      aria-label={`Show on the map: ${c.title}`}
                      onClick={() => setCommissionId((cur) => (cur === c.id ? null : c.id))}
                    >
                      <CommissionSeal shape={shape} n={i + 1} size={34} pressed={planted} />
                    </button>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="pt-2.5 text-sm font-semibold text-ink">{c.title}</h3>
                    <p className="mt-1 text-sm text-ink-muted">{c.text}</p>
                    {c.holdings.length > 0 && (
                      <div className="mt-2">
                        <HoldingChips commission={c} />
                      </div>
                    )}
                    <CommissionEnd commission={c} />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </NightPanel>
    </div>
  );
}

function PlainBody({ towers, commissions, demo }: { towers: TowerFog[]; commissions: Commission[]; demo: boolean }) {
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="section-title mb-0">The map</h2>
          {demo && <DemoPill />}
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          {MAP_COPY.intro} {MAP_COPY.browserNote}
        </p>
        {towers.length === 0 ? (
          <EmptyState>{MAP_COPY.empty}</EmptyState>
        ) : (
          <div className="mt-3">
            <SurveyList towers={towers} />
          </div>
        )}
      </Card>
      <Card>
        <h2 className="section-title">Commissions</h2>
        {commissions.length === 0 ? (
          <p className="text-sm text-ink-muted">{MAP_COPY.commissionsEmpty}</p>
        ) : (
          <ol className="divide-y divide-border-subtle" aria-label="Commissions">
            {commissions.map((c) => (
              <li key={c.id} className="py-3">
                <h3 className="text-sm font-semibold text-ink">{c.title}</h3>
                <p className="mt-1 text-sm text-ink-muted">{c.text}</p>
                {c.holdings.length > 0 && (
                  <div className="mt-2">
                    <HoldingChips commission={c} />
                  </div>
                )}
                <CommissionEnd commission={c} />
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

export default function RealmMapBody({
  towers,
  commissions,
  demo,
  painted,
  sectors = {},
  sectorsKnown = false,
}: {
  towers: TowerFog[];
  commissions: Commission[];
  demo: boolean;
  painted: boolean;
  /** holding id -> sector, from the Circle of Competence; empty when it could not be read. */
  sectors?: Record<string, string | null>;
  sectorsKnown?: boolean;
}) {
  return painted ? (
    <PaintedBody towers={towers} commissions={commissions} demo={demo} sectors={sectors} sectorsKnown={sectorsKnown} />
  ) : (
    <PlainBody towers={towers} commissions={commissions} demo={demo} />
  );
}
