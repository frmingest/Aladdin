import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { describeError } from "../lib/errors";
import { formatDate } from "../lib/format";
import { useGameMode } from "../lib/gameMode";
import { getObjectArt } from "../lib/stitchArt";
import type { Hearth, HearthInvalidation, HearthLine } from "../lib/types";
import { Card, Disclosure, EmptyState, LoadError, PageHeader } from "../components/ui";
import GameFooter from "../components/fortress/GameFooter";
import NightPanel from "../components/fortress/kit/NightPanel";

/** The Hearth (game mode E3): when the stored weather is bad, a quiet room with three shelves (what moved,
 * what held, what changed), your own invalidation lines beside the live numbers of the tripwires you set,
 * your winter order, and the record of the worst fall on file. In calm weather the door is shut. The server
 * writes every line; this page only lays them out. No score, no verdict, no advice. */

function Pic({ id, className }: { id: string; className: string }) {
  const art = getObjectArt(id);
  if (!art) return null;
  return <img src={art.src} alt="" aria-hidden="true" width={art.width} height={art.height} className={className} />;
}

export function Shelf({ title, lines, empty }: { title: string; lines: HearthLine[]; empty: string }) {
  return (
    <section aria-label={title} data-testid={`shelf-${title.toLowerCase()}`}>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">{title}</h3>
      {lines.length === 0 ? (
        <p className="text-sm text-ink-muted">{empty}</p>
      ) : (
        <ul className="space-y-1 text-sm text-ink">
          {lines.map((l, i) => (
            <li key={`${l.holding_id ?? "book"}-${i}`}>
              {l.text}
              {l.day && <span className="ml-1 text-xs text-ink-faint">{formatDate(l.day)}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const OPERATOR_WORD: Record<string, string> = { below: "below", above: "above" };

export function InvalidationShelf({ items }: { items: HearthInvalidation[] }) {
  if (items.length === 0) {
    return <EmptyState>No invalidation line is written for any holding in the journal yet.</EmptyState>;
  }
  return (
    <ul className="space-y-3" data-testid="invalidation-shelf">
      {items.map((i) => (
        <li key={i.entry_id} className="text-sm">
          <p className="font-medium text-ink">{i.name}</p>
          <p className="break-words text-ink">&ldquo;{i.line}&rdquo;</p>
          <p className="text-xs text-ink-faint">Written {formatDate(i.decided_on)}, in your words.</p>
          {i.tripwires.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-xs text-ink-muted">
              {i.tripwires.map((t) => (
                <li key={`${t.metric}-${t.threshold}`}>
                  {t.label ?? t.metric}: {t.current_value ?? `no value (${t.unavailable_reason ?? "unavailable"})`}, line{" "}
                  {OPERATOR_WORD[t.operator] ?? t.operator} {t.threshold}
                  {t.firing ? " (crossed)" : ""}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ShutDoor({ reason, gameMode }: { reason: string; gameMode: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-4" data-testid="hearth-shut">
      {gameMode && <Pic id="hearth-door" className="h-auto w-28" />}
      <div className="min-w-0 flex-1 space-y-1">
        <h2 className="section-title !mb-0">The door is shut</h2>
        <p className="text-sm text-ink-muted">{reason}</p>
        <p className="text-xs text-ink-faint">
          Write your winter order now, while it is calm, in <Link to="/fortress/winter" className="text-accent hover:underline">Winter Rehearsal</Link>.
        </p>
      </div>
    </div>
  );
}

export function OrderShelf({ order }: { order: Hearth["order"] }) {
  return order.text ? (
    <p className="break-words text-base font-medium text-ink" data-testid="hearth-order">
      &ldquo;{order.text}&rdquo;
    </p>
  ) : (
    <p className="text-sm text-ink-muted" data-testid="hearth-order">
      You have not written one. <Link to="/fortress/winter" className="text-accent hover:underline">Write it in Winter Rehearsal.</Link>
    </p>
  );
}

export function HearthRoom({ data, gameMode }: { data: Hearth; gameMode: boolean }) {
  const Panel = gameMode ? NightPanel : Card;
  if (data.state === "shut") {
    return (
      <div className="space-y-4">
        <Panel>
          <ShutDoor reason={data.state_reason} gameMode={gameMode} />
        </Panel>
        {data.order.text && (
          <Panel>
            <h2 className="section-title">Your winter order</h2>
            <OrderShelf order={data.order} />
          </Panel>
        )}
        {data.gaps.length > 0 && <GapNote gaps={data.gaps} gameMode={gameMode} />}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-center gap-4">
          {gameMode && (
            <div className="relative w-40" aria-hidden="true">
              <Pic id="hearth-fireplace" className="h-auto w-full" />
              <Pic id="hearth-log" className="absolute bottom-0 left-1/4 h-auto w-1/2" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="section-title !mb-1">The fire is lit</h2>
            <p className="text-sm text-ink-muted">{data.state_reason}</p>
          </div>
        </div>
      </Panel>

      <Panel>
        <h2 className="section-title">The three shelves</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Shelf title="Moved" lines={data.moved} empty="Nothing changed size." />
          <Shelf title="Held" lines={data.held} empty="Nothing can be said to have held yet." />
          <Shelf title="Changed" lines={data.changed} empty="No wall, moat, thesis or weather changed." />
        </div>
      </Panel>

      <Panel>
        <h2 className="section-title">Your own lines</h2>
        <InvalidationShelf items={data.invalidations} />
      </Panel>

      <Panel>
        <h2 className="section-title">Your winter order</h2>
        <OrderShelf order={data.order} />
        {data.record && <p className="mt-2 text-sm text-ink-muted">{data.record.text}</p>}
      </Panel>

      {data.gaps.length > 0 && <GapNote gaps={data.gaps} gameMode={gameMode} />}
    </div>
  );
}

export function GapNote({ gaps, gameMode }: { gaps: string[]; gameMode: boolean }) {
  const Panel = gameMode ? NightPanel : Card;
  return (
    <Panel>
      <div className="flex flex-wrap items-center gap-4">
        {gameMode && <Pic id="hearth-shutters" className="h-auto w-16" />}
        <div className="min-w-0 flex-1">
          <Disclosure label={`${gaps.length} stretch${gaps.length === 1 ? "" : "es"} with nothing recorded`} level="evidence">
            <ul className="space-y-0.5 text-xs text-ink-muted">
              {gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </Disclosure>
        </div>
      </div>
    </Panel>
  );
}

export default function HearthPage() {
  const { gameMode } = useGameMode();
  const [data, setData] = useState<Hearth | null>(null);
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setError(null);
    api
      .getHearth()
      .then((d) => live && setData(d))
      .catch((e: unknown) => live && setError(describeError(e, "the Hearth")));
    return () => {
      live = false;
    };
  }, [attempt]);

  return (
    <div>
      <PageHeader
        title="The Hearth"
        subtitle="Where you sit when the weather turns bad: what moved, what held, what changed, in your own words."
        actions={
          <Link to="/fortress" className="inline-flex min-h-[44px] items-center text-sm text-accent hover:underline">
            Back to the Fortress
          </Link>
        }
      />
      {error && <LoadError message={error.message} retryable={error.retryable} onRetry={() => setAttempt((n) => n + 1)} />}
      {!error && !data && <p className="text-sm text-ink-muted">Stoking the fire…</p>}
      {data && (
        <div className="space-y-4">
          <HearthRoom data={data} gameMode={gameMode} />
          <GameFooter rules={`Hearth ${data.version}. Opens when the newest stored weather is gathering or besieged and looks back over the stored days (from the Chronicle's own frame comparisons). Held means unchanged in every recorded comparison, not a promise. Your lines are shown as you wrote them; only tripwires you set are read for live numbers.`}>
            {data.notes.length > 0 && (
              <ul className="mt-1 list-disc pl-4">
                {data.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
          </GameFooter>
        </div>
      )}
    </div>
  );
}
