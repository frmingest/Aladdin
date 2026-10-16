import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import {
  ORDER_MAX_LENGTH,
  cleanOrder,
  coverageLine,
  daysWord,
  loadOrder,
  saveOrder,
  sceneState,
  signedNok,
  signedPercent,
} from "../lib/winter";
import type { WinterPoint, WinterRehearsal } from "../lib/types";
import { Button, Card, Disclosure, EmptyState, LoadError, PageHeader } from "../components/ui";
import { describeError } from "../lib/errors";
import { useGameMode } from "../lib/gameMode";
import { getObjectArt } from "../lib/stitchArt";
import GameFooter from "../components/fortress/GameFooter";
import NightPanel from "../components/fortress/kit/NightPanel";
import WinterScene from "../components/fortress/kit/WinterScene";

/** Winter Rehearsal (game mode E2): in calm weather, write your own winter order, then walk down the worst
 * real fall on file, replayed at today's holdings. At the bottom the page shows only your own words and the
 * numbers. No score, no outcome, no advice. The server computes every figure; your order is kept on the server
 * (with a copy in this browser) and reaches no analysis. */

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function OrderEditor({ saved, onSave }: { saved: string; onSave: (text: string) => void }) {
  const [draft, setDraft] = useState(saved);
  useEffect(() => setDraft(saved), [saved]);
  const dirty = cleanOrder(draft) !== saved;
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
      }}
    >
      <label htmlFor="winter-order" className="block text-sm font-medium text-ink">
        If the market falls hard, I will first check…
      </label>
      <input
        id="winter-order"
        value={draft}
        maxLength={ORDER_MAX_LENGTH}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="my own words, one line"
        className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
        aria-describedby="winter-order-hint"
      />
      <p id="winter-order-hint" className="text-xs text-ink-faint">
        One line. Kept here, and shown again in the Hearth.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!dirty}>
          {saved ? "Update my order" : "Save my order"}
        </Button>
        {saved && (
          <button type="button" className="inline-flex min-h-[44px] items-center text-xs text-accent hover:underline" onClick={() => onSave("")}>
            Clear my order
          </button>
        )}
      </div>
    </form>
  );
}

export function DaysTable({ points }: { points: WinterPoint[] }) {
  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-xs sm:text-sm">
        <caption className="mb-2 text-left text-xs text-ink-faint">Every stored day from the peak to the bottom.</caption>
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-faint">
            <th scope="col" className="py-1.5 pr-2 font-medium">Day</th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">Book value</th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">Against the peak</th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">Fall</th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">Days under water</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {points.map((p) => (
            <tr key={p.day}>
              <th scope="row" className="whitespace-nowrap py-1.5 pr-2 text-left font-medium text-ink">{formatDate(p.day)}</th>
              <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-ink">{signedNok(p.value_nok).replace("−", "")}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-ink">{signedNok(p.change_nok)}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-ink">{signedPercent(p.change)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-ink">{p.days_under_water}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Readout({ point, frost }: { point: WinterPoint; frost: number }) {
  const rows: [string, string][] = [
    ["Day", formatDate(point.day)],
    ["Against the peak", signedNok(point.change_nok)],
    ["Fall", signedPercent(point.change)],
    ["Under water", daysWord(point.days_under_water)],
    ["Frost", `${Math.round(frost * 100)}% of the worst day`],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-5" aria-live="polite">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs uppercase tracking-wide text-ink-faint">{k}</dt>
          <dd className="tabular-nums text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** At the bottom the page shows only your own words and the numbers: no outcome, no score, no advice. */
export function BottomCard({ order, point, gameMode }: { order: string; point: WinterPoint; gameMode: boolean }) {
  const tablet = gameMode ? getObjectArt("winter-tablet") : null;
  return (
    <div className="space-y-2" data-testid="winter-bottom">
      <h2 className="section-title">The bottom</h2>
      <div className="flex flex-wrap items-center gap-4">
        {tablet && <img src={tablet.src} alt="" aria-hidden="true" width={tablet.width} height={tablet.height} className="h-auto w-32" />}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs uppercase tracking-wide text-ink-faint">Your winter order</p>
          {order ? (
            <p className="break-words text-base font-medium text-ink">&ldquo;{order}&rdquo;</p>
          ) : (
            <p className="text-sm text-ink-muted">You have not written one.</p>
          )}
        </div>
      </div>
      <p className="text-sm text-ink">
        Down {signedNok(point.change_nok).replace("−", "")}, {signedPercent(point.change).replace("−", "")}, for{" "}
        {daysWord(point.days_under_water)} under water.
      </p>
    </div>
  );
}

export function CoverageBlock({ data }: { data: WinterRehearsal }) {
  const fog = data.coverage.holdings.filter((h) => !h.covered);
  return (
    <div className="space-y-1 text-xs text-ink-muted">
      <p>{coverageLine(data)}.</p>
      {fog.length > 0 && (
        <Disclosure label={`the ${fog.length} in fog`} level="evidence">
          <ul className="space-y-0.5">
            {fog.map((h) => (
              <li key={h.holding_id}>
                <span className="font-medium text-ink">{h.name}</span>: {h.reason ?? "no stored prices"}
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
    </div>
  );
}

export default function WinterRehearsalPage() {
  const { gameMode } = useGameMode();
  const [data, setData] = useState<WinterRehearsal | null>(null);
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [order, setOrder] = useState(() => loadOrder(storage()));
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let live = true;
    setError(null);
    api
      .getWinterRehearsal()
      .then((d) => {
        if (!live) return;
        setData(d);
        setIndex(0);
      })
      .catch((e: unknown) => live && setError(describeError(e, "the winter replay")));
    return () => {
      live = false;
    };
  }, [attempt]);

  // The server copy is the one the Hearth shows. If it has none yet but this browser does (an order written
  // before E3), it is sent up once. If the server cannot be reached the browser copy simply stays.
  useEffect(() => {
    let live = true;
    api
      .getWinterOrder()
      .then((o) => {
        if (!live) return;
        if (o.text) setOrder(saveOrder(storage(), o.text));
        else {
          const local = loadOrder(storage());
          if (local) api.saveWinterOrder(local).catch(() => undefined);
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const keepOrder = (text: string) => {
    setOrder(saveOrder(storage(), text));
    api.saveWinterOrder(cleanOrder(text)).catch(() => undefined);
  };

  const points = useMemo(() => data?.window?.points ?? [], [data]);
  const scene = useMemo(() => sceneState(points, index), [points, index]);
  const point = points.length ? points[Math.min(Math.max(index, 0), points.length - 1)] : null;
  const Panel = gameMode ? NightPanel : Card;
  const snow = gameMode ? getObjectArt("backdrop-winter-snow") : null;

  return (
    <div>
      <PageHeader
        title="Winter Rehearsal"
        subtitle="Write your winter order now, while it is calm. Then walk down the worst fall on file."
        actions={
          <Link to="/fortress" className="inline-flex min-h-[44px] items-center text-sm text-accent hover:underline">
            Back to the Fortress
          </Link>
        }
      />
      {error && <LoadError message={error.message} retryable={error.retryable} onRetry={() => setAttempt((n) => n + 1)} />}
      {!error && !data && <p className="text-sm text-ink-muted">Lighting the candles…</p>}
      {data && (
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">{data.caption}</p>

          <Panel>
            <h2 className="section-title">Your winter order</h2>
            <OrderEditor saved={order} onSave={keepOrder} />
          </Panel>

          {data.status !== "ok" && (
            <Panel>
              <h2 className="section-title">{data.status === "no_winter" ? "No real winter on file" : "Nothing to walk down yet"}</h2>
              {data.status === "no_winter" && snow && (
                <img src={snow.src} alt="" aria-hidden="true" width={snow.width} height={snow.height} className="mb-3 h-24 w-full rounded-md object-cover" />
              )}
              <EmptyState>{data.status_reason}</EmptyState>
              {data.status === "no_winter" && (
                <p className="mt-2 text-xs text-ink-faint">
                  A fall counts from {signedPercent(data.real_winter_fall).replace("−", "")}. A small dip would only teach the wrong lesson.
                </p>
              )}
              {data.coverage.total_count > 0 && data.status !== "demo" && (
                <div className="mt-2">
                  <CoverageBlock data={data} />
                </div>
              )}
            </Panel>
          )}

          {data.status === "ok" && data.window && point && scene && (
            <>
              <Panel>
                <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="section-title !mb-0">The worst winter on file</h2>
                  <span className="text-xs text-ink-faint">
                    {formatDate(data.window.peak_date)} to {formatDate(data.window.trough_date)} · {signedPercent(data.window.fall)}
                  </span>
                </div>
                {gameMode && (
                  <div className="mb-3">
                    <WinterScene state={scene} />
                  </div>
                )}
                <label htmlFor="winter-walk" className="mb-1 block text-sm font-medium text-ink">
                  Walk down the fall
                </label>
                <input
                  id="winter-walk"
                  type="range"
                  min={0}
                  max={points.length - 1}
                  step={1}
                  value={index}
                  onChange={(e) => setIndex(Number(e.target.value))}
                  aria-valuetext={`${formatDate(point.day)}, ${signedPercent(point.change)}, ${daysWord(point.days_under_water)} under water`}
                  className="mb-3 h-6 w-full"
                />
                <Readout point={point} frost={scene.frost} />
                <div className="mt-2">
                  <CoverageBlock data={data} />
                </div>
              </Panel>

              {scene.atBottom && (
                <Panel>
                  <BottomCard order={order} point={point} gameMode={gameMode} />
                </Panel>
              )}

              <Panel>
                <Disclosure label="the days as a table" level="evidence" defaultOpen={!gameMode}>
                  <DaysTable points={points} />
                </Disclosure>
              </Panel>
            </>
          )}

          <GameFooter rules={`Winter Rehearsal ${data.version}. The worst peak-to-trough fall of today's holdings at constant weights through the stored prices; kroner are scaled to what the covered holdings are worth today. A fall under ${signedPercent(data.real_winter_fall).replace("−", "")} is not shown as a winter.`}>
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
