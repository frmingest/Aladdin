import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { storePath } from "../../lib/marketplace";
import {
  CURRENCIES,
  DEMO_LINE,
  DUPLICATE_LINE,
  FAILED_ADD_LINE,
  addedLine,
  addedMood,
  addingLine,
  captureLine,
  captureMood,
  captureProgressLine,
  captureStartLine,
  checkTicker,
  hintText,
  introLine,
  rowHasPrice,
  summariseCapture,
  type CaptureSummary,
  type Mood,
} from "../../lib/salesRep";
import type { Watchlist, WatchlistRow } from "../../lib/types";
import { CoinBurst, RunnerStrip, SalesRep } from "./SalesRepArt";

/**
 * Sal's booth as a pop-up (game mode, Marketplace). One short conversation:
 *   form → adding → added (price check) → [Newsweb runners → done]
 * The only writes are the ones the Watchlist page already makes: add a company to the watchlist,
 * and fetch its reports from Oslo Børs Newsweb. Nothing is bought or sold. Sal's words are in
 * lib/salesRep.ts; this file only draws and sequences them.
 */

type Phase = "form" | "adding" | "added" | "duplicate" | "capturing" | "done";

const reducedMotion = (): boolean => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Types a line out like a speech bubble. Instant under reduced motion; press the bubble to finish. */
function useTypewriter(text: string): { shown: string; finish: () => void } {
  const [n, setN] = useState(() => (reducedMotion() ? text.length : 0));
  useEffect(() => {
    if (reducedMotion()) {
      setN(text.length);
      return;
    }
    setN(0);
    const id = window.setInterval(() => {
      setN((v) => {
        if (v >= text.length) {
          window.clearInterval(id);
          return v;
        }
        return v + 2;
      });
    }, 16);
    return () => window.clearInterval(id);
  }, [text]);
  return { shown: text.slice(0, n), finish: () => setN(text.length) };
}

function Bubble({ text, mood }: { text: string; mood: Mood }) {
  const { shown, finish } = useTypewriter(text);
  return (
    <div className={`market-bubble sal-bubble sal-bubble-${mood}`} onClick={finish} role="presentation">
      {/* The full line is announced once; the typed copy is for the eyes. */}
      <p className="sr-only" aria-live="polite">
        {text}
      </p>
      <p aria-hidden className="text-[0.95rem] leading-relaxed">
        {shown}
        {shown.length < text.length && <span className="sal-caret">▍</span>}
      </p>
    </div>
  );
}

const hintTone = (kind: string): string => (kind === "oslo" ? "text-[#7fe0a0]" : kind === "fix_oslo" || kind === "invalid" || kind === "no_suffix" ? "text-[#f2c98a]" : "text-[#cdbb97]");

export default function SalesRepDialog({
  demoMode,
  rows,
  onClose,
  onAdded,
}: {
  demoMode: boolean;
  /** The street as loaded, to catch a ticker that already has a stall. */
  rows: WatchlistRow[];
  onClose: () => void;
  /** Called with the freshly priced watchlist so the street can update without a second load. */
  onAdded: (list: Watchlist) => void;
}) {
  const [phase, setPhase] = useState<Phase>("form");
  const [tickerRaw, setTickerRaw] = useState("");
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("NOK");
  const [currencyTouched, setCurrencyTouched] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<WatchlistRow | null>(null);
  const [hasPrice, setHasPrice] = useState<boolean | null>(null);
  const [priceChecking, setPriceChecking] = useState(false);
  const [summary, setSummary] = useState<CaptureSummary | null>(null);
  const [tick, setTick] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [burstKey, setBurstKey] = useState(0);
  const [seed] = useState(() => Math.floor(Math.random() * 1000));
  const mounted = useRef(true);
  const dupRow = useRef<WatchlistRow | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const check = useMemo(() => checkTicker(tickerRaw), [tickerRaw]);

  // The symbol decides the currency until the user picks one themselves.
  useEffect(() => {
    if (!currencyTouched && check.kind !== "empty" && check.kind !== "invalid" && check.kind !== "fix_oslo") {
      setCurrency(check.currency ?? "");
    }
  }, [check.currency, check.kind, currencyTouched]);

  const busy = phase === "adding";
  const close = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  // Banter and a stopwatch while the runners are out.
  useEffect(() => {
    if (phase !== "capturing") return;
    const started = Date.now();
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
      setElapsed(Math.round((Date.now() - started) / 1000));
    }, 3500);
    const clock = window.setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => {
      window.clearInterval(id);
      window.clearInterval(clock);
    };
  }, [phase]);

  const canSubmit = !demoMode && check.valid && name.trim().length > 0 && currency.trim().length === 3;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setFormError(null);
    const existing = rows.find((r) => r.ticker.toUpperCase() === check.ticker);
    if (existing) {
      dupRow.current = existing;
      setCreated(existing);
      setPhase("duplicate");
      return;
    }
    setPhase("adding");
    try {
      const row = await api.addToWatchlist({ ticker: check.ticker, name: name.trim(), trading_currency: currency.trim().toUpperCase() });
      if (!mounted.current) return;
      setCreated(row);
      setHasPrice(null);
      setBurstKey((k) => k + 1);
      setPhase("added");
      setPriceChecking(true);
      api
        .getWatchlist()
        .then((list) => {
          if (!mounted.current) return;
          onAdded(list);
          setHasPrice(rowHasPrice(list.rows.find((r) => r.holding_id === row.holding_id)));
        })
        .catch(() => undefined)
        .finally(() => mounted.current && setPriceChecking(false));
    } catch (err) {
      if (!mounted.current) return;
      if (err instanceof ApiError && err.status === 409) {
        setCreated(null);
        dupRow.current = null;
        setPhase("duplicate");
        return;
      }
      setFormError(err instanceof ApiError ? err.message : "Could not reach the server.");
      setPhase("form");
    }
  }

  async function sendRunners() {
    if (!created) return;
    setSummary(null);
    setTick(0);
    setElapsed(0);
    setPhase("capturing");
    const [annual, interim] = await Promise.allSettled([api.importNewswebAnnualReports(created.holding_id), api.importNewswebInterimReports(created.holding_id)]);
    if (!mounted.current) return;
    const s = summariseCapture(annual, interim);
    setSummary(s);
    if (s.outcome === "captured") setBurstKey((k) => k + 1);
    setPhase("done");
  }

  function another() {
    setTickerRaw("");
    setName("");
    setCurrencyTouched(false);
    setCurrency("NOK");
    setCreated(null);
    setSummary(null);
    setHasPrice(null);
    setFormError(null);
    setPhase("form");
  }

  // What Sal says, and how he looks while saying it.
  let mood: Mood = "pitch";
  let line = introLine(seed);
  if (phase === "form") {
    if (demoMode) {
      line = DEMO_LINE;
      mood = "think";
    } else if (formError) {
      line = FAILED_ADD_LINE(formError);
      mood = "oops";
    }
  } else if (phase === "adding") {
    mood = "think";
    line = addingLine(seed);
  } else if (phase === "added" && created) {
    const facts = { name: created.name, ticker: created.ticker, owned: created.owned, hasPrice, oslo: checkTicker(created.ticker).oslo };
    mood = addedMood(facts);
    line = addedLine(facts, seed);
  } else if (phase === "duplicate") {
    mood = "think";
    line = DUPLICATE_LINE(dupRow.current?.name ?? (check.ticker || "That company"));
  } else if (phase === "capturing") {
    mood = "pitch";
    line = tick === 0 ? captureStartLine(seed) : captureProgressLine(tick - 1);
  } else if (phase === "done" && summary) {
    mood = captureMood(summary.outcome);
    line = captureLine(summary);
  }

  const storeTo = created ? storePath(created.holding_id) : null;
  const oslo = created ? checkTicker(created.ticker).oslo : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <button type="button" aria-label="Close Sal's booth" className="absolute inset-0 bg-black/70" onClick={close} tabIndex={-1} />
      <div role="dialog" aria-modal="true" aria-label="Sal's booth" className="sal-panel relative w-full max-w-2xl">
        <div className="sal-panel-head">
          <span className="font-display text-sm tracking-wide text-[#f2d16b]">SAL&rsquo;S BOOTH · NEW STALLS &amp; NEWS RUNS</span>
          <button type="button" aria-label="Close" onClick={close} disabled={busy} className="sal-x">
            ✕
          </button>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-[150px_1fr] sm:gap-5 sm:p-5">
          <div className="relative mx-auto w-[120px] sm:w-[150px]">
            <div className="sal-figure">
              <SalesRep mood={mood} size={150} className="h-auto w-full" />
            </div>
            {burstKey > 0 && (phase === "added" || phase === "done") && <CoinBurst key={burstKey} />}
          </div>

          <div className="min-w-0 space-y-3">
            <Bubble key={`${phase}-${mood}-${tick}`} text={line} mood={mood} />

            {phase === "form" && (
              <form onSubmit={submit} className="space-y-3" aria-label="Open a new stall">
                <label className="sal-label">
                  Ticker (Yahoo Finance symbol)
                  <input
                    className="sal-input uppercase"
                    value={tickerRaw}
                    onChange={(e) => setTickerRaw(e.target.value)}
                    placeholder="EQNR.OL"
                    autoFocus
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={demoMode}
                    aria-describedby="sal-ticker-hint"
                  />
                </label>
                <p id="sal-ticker-hint" className={`text-xs leading-snug ${hintTone(check.kind)}`}>
                  {hintText(check)}{" "}
                  {check.kind === "fix_oslo" && check.suggestion && (
                    <button type="button" className="sal-link font-semibold" onClick={() => setTickerRaw(check.suggestion!)}>
                      Use {check.suggestion}
                    </button>
                  )}{" "}
                  <a className="sal-link" href="https://finance.yahoo.com/lookup" target="_blank" rel="noopener noreferrer">
                    Look it up on Yahoo Finance ↗
                  </a>
                </p>

                <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
                  <label className="sal-label">
                    Company name
                    <input className="sal-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Equinor ASA" maxLength={120} autoComplete="off" disabled={demoMode} />
                  </label>
                  <label className="sal-label">
                    Currency
                    <select
                      className="sal-input"
                      value={currency}
                      onChange={(e) => {
                        setCurrency(e.target.value);
                        setCurrencyTouched(true);
                      }}
                      disabled={demoMode}
                    >
                      <option value="">Pick…</option>
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button type="submit" className="sal-btn" disabled={!canSubmit}>
                    Open the stall
                  </button>
                  <button type="button" className="sal-btn-ghost" onClick={close}>
                    Not today
                  </button>
                  {!demoMode && check.kind === "fix_oslo" && <span className="text-xs text-[#f2c98a]">Fix the symbol first.</span>}
                </div>
              </form>
            )}

            {phase === "adding" && (
              <p className="sal-status" role="status">
                <span className="sal-spin" aria-hidden /> Building the stall…
              </p>
            )}

            {phase === "added" && (
              <div className="space-y-3">
                {priceChecking && (
                  <p className="sal-status" role="status">
                    <span className="sal-spin" aria-hidden /> Checking the ticker tape for a price…
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {oslo && (
                    <button type="button" className="sal-btn" onClick={sendRunners} autoFocus>
                      Send the runners to Newsweb!
                    </button>
                  )}
                  {storeTo && (
                    <Link to={storeTo} className={oslo ? "sal-btn-ghost" : "sal-btn"} onClick={onClose}>
                      Enter the store
                    </Link>
                  )}
                  <button type="button" className="sal-btn-ghost" onClick={another}>
                    {oslo ? "Later. Another stall" : "Another stall"}
                  </button>
                </div>
              </div>
            )}

            {phase === "duplicate" && (
              <div className="flex flex-wrap gap-2">
                {storeTo && (
                  <Link to={storeTo} className="sal-btn" onClick={onClose} autoFocus>
                    Enter the store
                  </Link>
                )}
                <button type="button" className="sal-btn-ghost" onClick={another}>
                  Try another ticker
                </button>
              </div>
            )}

            {phase === "capturing" && (
              <div className="space-y-2" role="status">
                <RunnerStrip />
                <div className="sal-bar" aria-hidden>
                  <span />
                </div>
                <p className="text-xs text-[#cdbb97]">
                  {elapsed}s out. Big companies take a minute or two. You can close this: the runners keep going and the reports land on the holding page.
                </p>
              </div>
            )}

            {phase === "done" && summary && (
              <div className="space-y-3">
                {(summary.outcome === "captured" || summary.outcome === "up_to_date") && (
                  <dl className="flex flex-wrap gap-2 text-xs" aria-label="What the runners brought back">
                    {[
                      ["Annual reports", summary.annualCount],
                      ["Half-year reports", summary.halfYearCount],
                      ["New today", summary.newlyImported],
                    ].map(([k, v]) => (
                      <div key={k as string} className="sal-chip">
                        <dt>{k}</dt>
                        <dd className="tabular">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {summary.notes.length > 0 && (
                  <ul className="space-y-0.5 text-xs text-[#f2c98a]">
                    {summary.notes.slice(0, 4).map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap gap-2">
                  {storeTo && (
                    <Link to={storeTo} className="sal-btn" onClick={onClose} autoFocus>
                      Enter the store
                    </Link>
                  )}
                  {created && (
                    <Link to={`/holdings/${created.holding_id}`} className="sal-btn-ghost" onClick={onClose}>
                      Open the holding page
                    </Link>
                  )}
                  {summary.outcome === "failed" && (
                    <button type="button" className="sal-btn-ghost" onClick={sendRunners}>
                      Send them again
                    </button>
                  )}
                  <button type="button" className="sal-btn-ghost" onClick={another}>
                    Another stall
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="border-t border-[#3b2a16] px-4 py-2 text-[0.7rem] leading-snug text-[#a8977a] sm:px-5">
          Sal is an invented character, not a real person. He opens stalls and fetches filings; he never tells you what to buy or sell, and nothing here trades anything. Newsweb reports are free and need no key.
        </p>
      </div>
    </div>
  );
}
