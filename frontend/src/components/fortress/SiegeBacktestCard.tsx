import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { describeError } from "../../lib/errors";
import {
  BACKTEST_LIMITS,
  VERDICT_LABEL,
  barScale,
  barWidth,
  bookLines,
  episodeLine,
  gapWords,
  holdingBacktestLine,
  pct,
  summaryLine,
} from "../../lib/siegeBacktest";
import type { SiegeBacktest, SiegeBacktestHolding } from "../../lib/types";
import { Card, LoadError } from "../ui";

/** C1: the Siege page checked against the benchmark's worst stored fall. For each tower a filled bar shows what
 * the holding really lost and a tick shows what the page's method would have said; the gap is written out, so
 * colour never carries the meaning. Read-only; a check on the page, not a forecast. */

function Row({ h, scale }: { h: SiegeBacktestHolding; scale: number }) {
  const actual = barWidth(h.actual, scale);
  const predicted = barWidth(h.predicted, scale);
  return (
    <li className="border-b border-border-subtle py-3">
      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,14rem)_1fr_auto] sm:items-center">
        <div className="min-w-0">
          <Link to={`/holdings/${h.holding_id}`} className="font-medium text-ink hover:underline">
            {h.name}
          </Link>
          <p className="truncate text-xs text-ink-faint">{h.weight_pct ? `${Number(h.weight_pct).toFixed(1)}% of the book` : h.ticker}</p>
        </div>
        <div className="min-w-0">
          {h.tested ? (
            <div
              className="relative h-2.5 w-full overflow-hidden rounded-full bg-border-subtle"
              role="img"
              aria-label={`Actual fall ${pct(h.actual)}, the page would have said ${pct(h.predicted)}`}
            >
              <div className="h-full rounded-full bg-ink-muted/70" style={{ width: `${actual}%` }} />
              <div className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `calc(${predicted}% - 1px)` }} />
            </div>
          ) : null}
          <p className="mt-1 text-xs text-ink-muted">
            <span className="font-medium text-ink">{VERDICT_LABEL[h.verdict]}</span>
            {h.tested ? ` · ${gapWords(h.error)}` : ""}
          </p>
          <p className="text-xs text-ink-faint">{holdingBacktestLine(h)}</p>
          {h.caution && <p className="text-xs text-ink-faint">{h.caution}</p>}
        </div>
        <div className="tabular text-right text-sm">
          <p className={h.tested ? "font-semibold text-ink" : "text-ink-faint"}>{h.tested ? pct(h.actual) : "?"}</p>
          <p className="text-xs text-ink-faint">{h.tested ? `page: ${pct(h.predicted)}` : "not tested"}</p>
        </div>
      </div>
    </li>
  );
}

export default function SiegeBacktestCard() {
  const [bt, setBt] = useState<SiegeBacktest | null>(null);
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let live = true;
    api
      .getSiegeBacktest()
      .then((r) => {
        if (live) {
          setBt(r);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (live) setError(describeError(e, "the back-test"));
      });
    return () => {
      live = false;
    };
  }, [retry]);

  if (error) return <LoadError message={error.message} retryable={error.retryable} onRetry={() => setRetry((n) => n + 1)} />;
  if (!bt) return null;

  const tested = bt.holdings.filter((h) => h.tested);
  const untested = bt.holdings.filter((h) => !h.tested);
  const scale = barScale(tested);

  return (
    <Card>
      <h2 className="section-title">Looking back: would the page have been right?</h2>
      {bt.status !== "ok" || !bt.episode ? (
        <p className="text-sm text-ink-muted">{bt.status_reason}</p>
      ) : (
        <>
          <p className="text-sm text-ink-muted">{episodeLine(bt.episode, bt.benchmark_ticker)}</p>
          {!bt.episode.significant && (
            <p className="mt-1 text-xs text-ink-faint">A small fall: the gaps below are mostly noise rather than a real test.</p>
          )}
          <p className="mt-2 text-sm text-ink">{summaryLine(bt)}</p>

          {tested.length > 0 && (
            <>
              <p className="mt-3 text-xs text-ink-faint">
                The bar is what the holding really lost; the tick is what the page's method would have said. Each beta was measured without the days of this fall.
              </p>
              <ul>{tested.map((h) => <Row key={h.holding_id} h={h} scale={scale} />)}</ul>
            </>
          )}

          {untested.length > 0 && (
            <div className="mt-3 text-sm text-ink-muted">
              <p className="font-medium text-ink">Not tested ({untested.length}): left out, not guessed.</p>
              <ul className="mt-1 space-y-1 text-xs">
                {untested.map((h) => (
                  <li key={h.holding_id}>
                    <Link to={`/holdings/${h.holding_id}`} className="text-accent hover:underline">
                      {h.name}
                    </Link>
                    {h.reason ? `: ${h.reason}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 border-t border-border-subtle pt-3">
            <h3 className="text-sm font-medium text-ink">The book, replayed</h3>
            {bt.book ? (
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-ink-muted">
                {bookLines(bt.book).map((l) => <li key={l}>{l}</li>)}
                <li>{`Built from ${bt.book.holdings_used} holdings, ${(Number(bt.book.value_share) * 100).toFixed(0)}% of the portfolio value, at today's weights.`}</li>
              </ul>
            ) : (
              <p className="mt-1 text-xs text-ink-muted">{bt.book_reason}</p>
            )}
          </div>
        </>
      )}
      <p className="mt-3 text-xs text-ink-faint">{BACKTEST_LIMITS}</p>
      {bt.notes
        .filter((n) => !n.startsWith("This checks the Siege page"))
        .map((n) => (
          <p key={n} className="mt-1 text-xs text-ink-faint">{n}</p>
        ))}
    </Card>
  );
}
