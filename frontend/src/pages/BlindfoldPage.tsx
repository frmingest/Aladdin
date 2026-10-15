import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import {
  POSITION_WORD,
  WIDTH_ORDER,
  addResult,
  clearResults,
  formatFigure,
  fractionToValue,
  loadResults,
  parseStake,
  seenIds,
  stakeText,
  tally,
  tallyByWidth,
  tallyLine,
  valueToFraction,
  widthLine,
  type BlindfoldResult,
} from "../lib/blindfold";
import type { Blindfold, BlindfoldPuzzle, BlindfoldReveal } from "../lib/types";
import { Button, Card, EmptyState, LoadError, PageHeader } from "../components/ui";
import { describeError } from "../lib/errors";
import { useGameMode } from "../lib/gameMode";
import GameFooter from "../components/fortress/GameFooter";
import NightPanel from "../components/fortress/kit/NightPanel";
import BlindfoldScene from "../components/fortress/kit/BlindfoldScene";

/** Blindfold Years (game mode E1): roll one holding back to a past year with its name masked, stake a low and
 * a high figure for the next year's owner earnings, then see the stored figure. Practice, not measurement:
 * no grade, streak or trend arrow, and a count opens only at n of 8. The server holds the answer until you
 * have staked; your answers stay in this browser and nothing typed here reaches any analysis. */

const POSITION_MARK = { below: "\u25BC", inside: "\u25CF", above: "\u25B2" } as const;
const SLIDER_STEPS = 1000;
const DEFAULT_LOW = 0.35;
const DEFAULT_HIGH = 0.65;

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function FiguresTable({ puzzle }: { puzzle: BlindfoldPuzzle }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs sm:text-sm">
        <caption className="mb-2 text-left text-xs text-ink-faint">
          Four years on record. The currency is hidden too.
        </caption>
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-faint">
            <th scope="col" className="py-1.5 pr-3 font-medium">
              <span className="sr-only">Measure</span>
            </th>
            {puzzle.years.map((y) => (
              <th key={y.label} scope="col" className="whitespace-nowrap px-1 py-1.5 text-right font-medium sm:px-2">
                {y.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {puzzle.rows.map((row) => (
            <tr key={row.key}>
              <th scope="row" className="py-1.5 pr-2 text-left font-medium text-ink">
                {row.label}
              </th>
              {puzzle.years.map((y) => {
                const cell = y.cells[row.key];
                return (
                  <td key={y.label} className="whitespace-nowrap px-1 py-1.5 text-right tabular-nums text-ink sm:px-2">
                    {cell && cell.value !== null ? (
                      formatFigure(cell.value, row.kind)
                    ) : (
                      <span className="border-b border-dashed border-ink-faint text-ink-faint" title={cell?.fog ?? "not on file"}>
                        unknown
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RevealPanel({ reveal, onNext, hasNext }: { reveal: BlindfoldReveal; onNext: () => void; hasNext: boolean }) {
  return (
    <div className="space-y-2" aria-live="polite">
      <h2 className="section-title">The answer</h2>
      <p className="text-sm text-ink">
        Owner earnings landed at <strong>{formatFigure(reveal.actual, "money")}</strong>. Your stakes: {formatFigure(reveal.low, "money")} to{" "}
        {formatFigure(reveal.high, "money")}.
      </p>
      <p className="text-sm font-semibold text-ink">
        <span aria-hidden="true">{POSITION_MARK[reveal.position]} </span>
        {POSITION_WORD[reveal.position]}.
      </p>
      <p className="text-sm text-ink-muted">
        The company: {reveal.name} ({reveal.ticker}). Year 0 was {reveal.shown_period}, the answer is {reveal.answer_period}
        {reveal.source_file ? ` (from ${reveal.source_file})` : ""}.
      </p>
      <p className="text-xs text-ink-faint">{reveal.note}</p>
      <div className="pt-1">
        <Button onClick={onNext}>{hasNext ? "Next company" : "That is all for now"}</Button>
      </div>
    </div>
  );
}

export function Tallies({ results, data, onForget }: { results: BlindfoldResult[]; data: Blindfold; onForget: () => void }) {
  const overall = tally(results, data.min_n);
  const byWidth = useMemo(() => tallyByWidth(results, data.min_n), [results, data.min_n]);
  return (
    <div className="space-y-1">
      <h2 className="section-title">Your stakes so far</h2>
      <p className="text-sm text-ink">{tallyLine(overall, data.min_n)}</p>
      {overall.open && (
        <ul className="text-sm text-ink-muted">
          {WIDTH_ORDER.map((w) => (
            <li key={w}>{widthLine(w, byWidth[w], data.min_n)}</li>
          ))}
        </ul>
      )}
      <p className="text-xs text-ink-faint">Just counts, kept in this browser.</p>
      <button type="button" className="inline-flex min-h-[44px] items-center text-xs text-accent hover:underline" onClick={onForget}>
        Clear my answers
      </button>
    </div>
  );
}

export default function BlindfoldPage() {
  const { gameMode } = useGameMode();
  const [data, setData] = useState<Blindfold | null>(null);
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [results, setResults] = useState<BlindfoldResult[]>(() => loadResults(storage()));
  const [lowText, setLowText] = useState("");
  const [highText, setHighText] = useState("");
  const [reveal, setReveal] = useState<BlindfoldReveal | null>(null);
  const [lifted, setLifted] = useState<{ name: string; ticker: string } | null>(null);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Which puzzle is next depends on the answers kept here; they are read once per load, not as a dependency.
  useEffect(() => {
    let live = true;
    setError(null);
    api
      .getBlindfold(seenIds(loadResults(storage())))
      .then((d) => {
        if (!live) return;
        setData(d);
        setReveal(null);
        setLifted(null);
        // Stakes start at the same two spots on the gauge every time and count as chosen only once moved.
        const p = d.puzzle;
        const [a, b] = p ? [Number(p.stake_min), Number(p.stake_max)] : [0, 0];
        setLowText(p ? stakeText(Number(fractionToValue(DEFAULT_LOW, a, b).toPrecision(4))) : "");
        setHighText(p ? stakeText(Number(fractionToValue(DEFAULT_HIGH, a, b).toPrecision(4))) : "");
        setTouched(false);
        setActionError(null);
      })
      .catch((e: unknown) => live && setError(describeError(e, "the puzzles")));
    return () => {
      live = false;
    };
  }, [attempt]);

  const puzzle = data?.puzzle ?? null;
  const domain = useMemo(() => (puzzle ? { min: Number(puzzle.stake_min), max: Number(puzzle.stake_max) } : null), [puzzle]);
  const lowN = parseStake(lowText);
  const highN = parseStake(highText);
  const stakesReady = lowN !== null && highN !== null;
  const [lo, hi] = stakesReady ? [Math.min(lowN, highN), Math.max(lowN, highN)] : [null, null];

  const points = useMemo(
    () =>
      puzzle
        ? puzzle.years.flatMap((y) => {
            const v = y.cells.owner_earnings?.value;
            return v != null ? [{ label: y.label, value: Number(v) }] : [];
          })
        : [],
    [puzzle],
  );

  async function doReveal() {
    if (!puzzle || lo === null || hi === null || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const r = await api.getBlindfoldReveal(puzzle.puzzle_id, stakeText(lo), stakeText(hi));
      setReveal(r);
      setResults((cur) => addResult(storage(), cur, r));
    } catch (e) {
      setActionError(describeError(e, "the stored figure").message);
    } finally {
      setBusy(false);
    }
  }

  async function liftMask() {
    if (!puzzle || busy) return;
    setBusy(true);
    try {
      setLifted(await api.getBlindfoldName(puzzle.puzzle_id));
    } catch (e) {
      setActionError(describeError(e, "the name").message);
    } finally {
      setBusy(false);
    }
  }

  const setSlider = (which: "low" | "high", step: number) => {
    if (!domain) return;
    const text = stakeText(Number(fractionToValue(step / SLIDER_STEPS, domain.min, domain.max).toPrecision(4)));
    (which === "low" ? setLowText : setHighText)(text);
    setTouched(true);
  };
  const sliderValue = (n: number | null, fallback: number) =>
    domain && n !== null ? Math.round(valueToFraction(n, domain.min, domain.max) * SLIDER_STEPS) : fallback;

  const Panel = gameMode ? NightPanel : Card;
  const forget = () => {
    clearResults(storage());
    setResults([]);
    setAttempt((n) => n + 1);
  };

  return (
    <div>
      <PageHeader
        title="Blindfold Years"
        subtitle="A hidden company, four years of numbers. Where will its owner earnings land next?"
        actions={
          <Link to="/fortress" className="inline-flex min-h-[44px] items-center text-sm text-accent hover:underline">
            Back to the Fortress
          </Link>
        }
      />
      {error && <LoadError message={error.message} retryable={error.retryable} onRetry={() => setAttempt((n) => n + 1)} />}
      {!error && !data && <p className="text-sm text-ink-muted">Walking down to the river…</p>}
      {data && (
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">{data.caption}</p>

          {!puzzle && (
            <>
              <EmptyState>{data.empty_reason ?? "No puzzle is on offer."}</EmptyState>
              {results.length > 0 && (
                <Panel>
                  <Tallies results={results} data={data} onForget={forget} />
                </Panel>
              )}
            </>
          )}

          {puzzle && domain && (
            <>
              {gameMode && (
                <BlindfoldScene
                  points={points}
                  min={domain.min}
                  max={domain.max}
                  low={lo}
                  high={hi}
                  actual={reveal ? Number(reveal.actual) : null}
                />
              )}

              <Panel>
                <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="section-title !mb-0">Mystery company</h2>
                  <span className="text-xs text-ink-faint">
                    {puzzle.sector ?? "Sector not set"} · {data.remaining} of {data.pool_size} left
                  </span>
                </div>
                <FiguresTable puzzle={puzzle} />
                {!reveal && (
                  <div className="mt-3 text-xs text-ink-muted">
                    {lifted ? (
                      <p>
                        It is {lifted.name} ({lifted.ticker}). Peeking makes it easier.
                      </p>
                    ) : (
                      <button type="button" className="inline-flex min-h-[44px] items-center text-accent hover:underline" disabled={busy} onClick={liftMask}>
                        Peek at the name (makes it easier)
                      </button>
                    )}
                  </div>
                )}
              </Panel>

              {!reveal && (
                <Panel>
                  <h2 className="section-title">Plant your stakes</h2>
                  <p className="mb-3 text-xs text-ink-muted">
                    Owner earnings next year: plant a low and a high stake you are {data.confidence_pct}% sure it lands between. Same units as the table.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {(
                      [
                        ["low", "Low", lowText, setLowText, lowN],
                        ["high", "High", highText, setHighText, highN],
                      ] as const
                    ).map(([which, label, text, setText, n]) => (
                      <div key={which} className="space-y-1">
                        <label htmlFor={`bf-${which}`} className="block text-sm font-medium text-ink">
                          {label}
                        </label>
                        <input
                          id={`bf-${which}`}
                          inputMode="decimal"
                          value={text}
                          onChange={(e) => {
                            setText(e.target.value);
                            setTouched(true);
                          }}
                          className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm tabular-nums"
                          aria-describedby={`bf-${which}-read`}
                        />
                        <input
                          type="range"
                          min={0}
                          max={SLIDER_STEPS}
                          step={1}
                          aria-label={`${label} slider`}
                          value={sliderValue(n, which === "low" ? Math.round(SLIDER_STEPS * DEFAULT_LOW) : Math.round(SLIDER_STEPS * DEFAULT_HIGH))}
                          onChange={(e) => setSlider(which, Number(e.target.value))}
                          className="h-6 w-full"
                        />
                        <p id={`bf-${which}-read`} className="text-xs text-ink-faint">
                          {n !== null ? formatFigure(String(n), "money") : "not set"}
                        </p>
                      </div>
                    ))}
                  </div>
                  {actionError && <p className="mt-2 text-xs text-negative">{actionError}</p>}
                  <div className="mt-3">
                    <Button disabled={!stakesReady || !touched || busy} onClick={doReveal}>
                      {busy ? "Checking…" : "Reveal the answer"}
                    </Button>
                  </div>
                </Panel>
              )}

              {reveal && (
                <Panel>
                  <RevealPanel reveal={reveal} hasNext={data.remaining > 1} onNext={() => setAttempt((n) => n + 1)} />
                </Panel>
              )}

              {results.length > 0 && (
                <Panel>
                  <Tallies results={results} data={data} onForget={forget} />
                </Panel>
              )}
            </>
          )}

          <GameFooter rules={`Blindfold ${data.version}. A company needs four full years on file plus the next one. Years with gaps or data warnings are never offered.`} />
        </div>
      )}
    </div>
  );
}
