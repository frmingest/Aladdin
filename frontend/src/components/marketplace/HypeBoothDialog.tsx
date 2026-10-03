import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { loadStore, type StoreData } from "../../lib/marketStore";
import {
  HEARD_FROM,
  HYPE_DEMO_LINE,
  NOT_ANALYSED_YET,
  heardNote,
  hypeIntroLine,
  pitchLine,
  readTip,
  withHeardNote,
  type HeardFrom,
  type HypeReading,
} from "../../lib/hype";
import { storePath, STORE_LEVEL_LABEL } from "../../lib/marketplace";
import { CURRENCIES, checkTicker, hintText, normalizeTicker, summariseCapture, type CaptureSummary } from "../../lib/salesRep";
import type { Watchlist, WatchlistRow } from "../../lib/types";
import { Portrait } from "../fortress/AdvisorsCard";
import { Pip } from "./MarketArt";
import { SalesRep } from "./SalesRepArt";
import { Bubble } from "./SalesRepDialog";

/**
 * The Hype Booth (game mode, G12) as a pop-up. A tip comes in; Sal pitches it; the Partner reads it through the
 * Marketplace's eight gates (`market-v1`). A ticker the app has never seen is honestly "Cannot judge yet", with
 * the missing pieces listed and one press that opens the stall, fetches Oslo Børs reports and queues the analysis.
 *
 *   form → pitch (reading what is stored) → verdict → [working → done]
 *
 * Writes are only ones the app already has: add to the watchlist, Newsweb fetch, queue an analysis, and the
 * watchlist notes. Nothing is bought or sold, and nothing scores or rewards. Wording lives in lib/hype.ts.
 */

type Phase = "form" | "pitch" | "verdict" | "working" | "done";
type Step = "pending" | "running" | "ok" | "skipped" | "failed";

const errMsg = (e: unknown, fallback: string): string => (e instanceof ApiError ? e.message : fallback);

export default function HypeBoothDialog({
  demoMode,
  rows,
  onClose,
  onAdded,
}: {
  demoMode: boolean;
  /** The street as loaded, to recognise a ticker that already has a stall. */
  rows: WatchlistRow[];
  onClose: () => void;
  onAdded: (list: Watchlist) => void;
}) {
  const [phase, setPhase] = useState<Phase>("form");
  const [tickerRaw, setTickerRaw] = useState("");
  const [heard, setHeard] = useState<HeardFrom>("a friend");
  const [detail, setDetail] = useState("");
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("NOK");
  const [currencyTouched, setCurrencyTouched] = useState(false);
  const [reading, setReading] = useState<HypeReading | null>(null);
  const [data, setData] = useState<StoreData | null>(null);
  const [holdingId, setHoldingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [steps, setSteps] = useState<{ add: Step; reports: Step; queue: Step }>({ add: "pending", reports: "pending", queue: "pending" });
  const [notes, setNotes] = useState<string[]>([]);
  const [summary, setSummary] = useState<CaptureSummary | null>(null);
  const [noteSaved, setNoteSaved] = useState(false);
  const [seed] = useState(() => Math.floor(Math.random() * 1000));
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const check = useMemo(() => checkTicker(tickerRaw), [tickerRaw]);

  useEffect(() => {
    if (!currencyTouched && check.kind !== "empty" && check.kind !== "invalid" && check.kind !== "fix_oslo") setCurrency(check.currency ?? "");
  }, [check.currency, check.kind, currencyTouched]);

  const busy = phase === "working";
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

  const ticker = check.ticker;
  const today = () => new Date().toISOString();

  /** Find the ticker among the street's stalls, then among all holdings; load the stored picture if found. */
  async function reread(): Promise<{ data: StoreData | null; id: string | null }> {
    let id = rows.find((r) => r.ticker.toUpperCase() === ticker)?.holding_id ?? null;
    if (id === null) {
      try {
        id = (await api.listHoldings()).find((h) => h.ticker.toUpperCase() === ticker)?.id ?? null;
      } catch {
        id = null;
      }
    }
    if (id === null) return { data: null, id: null };
    return { data: await loadStore(id), id };
  }

  async function pitch(e: React.FormEvent) {
    e.preventDefault();
    if (demoMode || !check.valid) return;
    setLoadError(null);
    setReading(null);
    setPhase("pitch");
    try {
      const found = await reread();
      if (!mounted.current) return;
      setData(found.data);
      setHoldingId(found.id);
      setReading(readTip(found.data, check.oslo));
    } catch (err) {
      if (!mounted.current) return;
      setLoadError(errMsg(err, "Could not read what is stored."));
    }
  }

  async function saveNote() {
    const entry = rows.find((r) => r.holding_id === holdingId) ?? data?.row;
    if (!entry) return;
    try {
      await api.updateWatchlistEntry(entry.id, { notes: withHeardNote(entry.notes, heardNote(heard, detail, today())) });
      if (mounted.current) setNoteSaved(true);
    } catch (err) {
      if (mounted.current) setNotes((n) => [...n, `Could not save the tip note: ${errMsg(err, "failed")}`]);
    }
  }

  async function openStallAndRun() {
    if (demoMode || !name.trim() || currency.trim().length !== 3) return;
    setNotes([]);
    setSummary(null);
    setSteps({ add: "running", reports: "pending", queue: "pending" });
    setPhase("working");
    const patch = (s: Partial<typeof steps>) => mounted.current && setSteps((v) => ({ ...v, ...s }));

    let id: string;
    try {
      const row = await api.addToWatchlist({
        ticker,
        name: name.trim(),
        trading_currency: currency.trim().toUpperCase(),
        notes: heardNote(heard, detail, today()),
      });
      id = row.holding_id;
      setHoldingId(id);
      patch({ add: "ok" });
      api.getWatchlist().then((l) => mounted.current && onAdded(l)).catch(() => undefined);
    } catch (err) {
      patch({ add: "failed", reports: "skipped", queue: "skipped" });
      if (mounted.current) {
        setNotes([err instanceof ApiError && err.status === 409 ? "That ticker already has a stall. Ask again to read it." : `Could not open the stall: ${errMsg(err, "could not reach the server.")}`]);
        setPhase("done");
      }
      return;
    }

    if (check.oslo) {
      patch({ reports: "running" });
      const [annual, interim] = await Promise.allSettled([api.importNewswebAnnualReports(id), api.importNewswebInterimReports(id)]);
      const s = summariseCapture(annual, interim);
      if (mounted.current) setSummary(s);
      patch({ reports: s.outcome === "failed" ? "failed" : "ok" });
    } else {
      patch({ reports: "skipped" });
      if (mounted.current) setNotes((n) => [...n, "Newsweb only covers Oslo Børs companies. Upload an annual report on the holding page to give the gates something to read."]);
    }

    patch({ queue: "running" });
    try {
      await api.queueAnalysis(id);
      patch({ queue: "ok" });
    } catch (err) {
      patch({ queue: "failed" });
      if (mounted.current) setNotes((n) => [...n, `The analysis was not queued: ${errMsg(err, "failed")} It may need filings first; try again from the Analysis queue page once reports are in.`]);
    }
    if (mounted.current) setPhase("done");
  }

  async function askAgain() {
    setPhase("pitch");
    setLoadError(null);
    try {
      const found = await reread();
      if (!mounted.current) return;
      setData(found.data);
      setHoldingId(found.id);
      setReading(readTip(found.data, check.oslo));
      setPhase("verdict");
    } catch (err) {
      if (mounted.current) setLoadError(errMsg(err, "Could not read what is stored."));
    }
  }

  function another() {
    setTickerRaw("");
    setName("");
    setDetail("");
    setCurrencyTouched(false);
    setCurrency("NOK");
    setReading(null);
    setData(null);
    setHoldingId(null);
    setSummary(null);
    setNotes([]);
    setNoteSaved(false);
    setPhase("form");
  }

  const pitchText = pitchLine(ticker, seed);
  const known = reading !== null && reading.key !== "nothing";
  const storeTo = holdingId ? storePath(holdingId) : null;
  const existingRow = holdingId ? (rows.find((r) => r.holding_id === holdingId) ?? data?.row ?? null) : null;

  let salLine = hypeIntroLine(seed);
  if (phase === "form" && demoMode) salLine = HYPE_DEMO_LINE;
  if (phase === "pitch" || phase === "verdict") salLine = pitchText;
  if (phase === "working") salLine = "Doors open, runners out! Hold your hat!";
  if (phase === "done") salLine = "That's the best I can do today. The rest takes patience, and patience is not my department.";

  const stepIcon = (s: Step) => (s === "ok" ? "✔" : s === "failed" ? "✖" : s === "skipped" ? "–" : s === "running" ? "…" : "·");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <button type="button" aria-label="Close the Hype Booth" className="absolute inset-0 bg-black/70" onClick={close} tabIndex={-1} />
      <div role="dialog" aria-modal="true" aria-label="The Hype Booth" className="sal-panel relative max-h-[92vh] w-full max-w-2xl overflow-y-auto">
        <div className="sal-panel-head">
          <span className="font-display text-sm tracking-wide text-[#f2d16b]">THE HYPE BOOTH · TIPS, TESTED</span>
          <button type="button" aria-label="Close" onClick={close} disabled={busy} className="sal-x">
            ✕
          </button>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-[130px_1fr] sm:gap-5 sm:p-5">
          <div className="mx-auto w-[100px] sm:w-[130px]">
            <div className="sal-figure">
              <SalesRep mood={phase === "verdict" && reading && reading.key !== "ready" ? "think" : "pitch"} size={130} className="h-auto w-full" />
            </div>
          </div>

          <div className="min-w-0 space-y-3">
            <Bubble key={`${phase}-${salLine}`} text={salLine} mood="pitch" />

            {phase === "form" && (
              <form onSubmit={pitch} className="space-y-3" aria-label="Bring a tip">
                <label className="sal-label">
                  Ticker (Yahoo Finance symbol)
                  <input
                    className="sal-input uppercase"
                    value={tickerRaw}
                    onChange={(e) => setTickerRaw(normalizeTicker(e.target.value))}
                    placeholder="EQNR.OL"
                    autoFocus
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={demoMode}
                    aria-describedby="hype-ticker-hint"
                  />
                </label>
                <p id="hype-ticker-hint" className="text-xs leading-snug text-[#cdbb97]">
                  {hintText(check)}{" "}
                  {check.kind === "fix_oslo" && check.suggestion && (
                    <button type="button" className="sal-link font-semibold" onClick={() => setTickerRaw(check.suggestion!)}>
                      Use {check.suggestion}
                    </button>
                  )}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="sal-label">
                    Who whispered it?
                    <select className="sal-input" value={heard} onChange={(e) => setHeard(e.target.value as HeardFrom)} disabled={demoMode}>
                      {HEARD_FROM.map((h) => (
                        <option key={h} value={h}>
                          {h[0]!.toUpperCase() + h.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="sal-label">
                    Name or place (optional)
                    <input className="sal-input" value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={60} placeholder="Ola, r/investing…" autoComplete="off" disabled={demoMode} />
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button type="submit" className="sal-btn" disabled={demoMode || !check.valid}>
                    Pitch it!
                  </button>
                  <button type="button" className="sal-btn-ghost" onClick={close}>
                    Not today
                  </button>
                </div>
              </form>
            )}

            {phase === "pitch" && (
              <div className="space-y-3">
                {loadError ? (
                  <>
                    <p className="text-sm text-[#f2c98a]" role="alert">{loadError}</p>
                    <button type="button" className="sal-btn-ghost" onClick={another}>Back</button>
                  </>
                ) : reading === null ? (
                  <p className="sal-status" role="status">
                    <span className="sal-spin" aria-hidden /> The Partner is going through what is stored…
                  </p>
                ) : (
                  <button type="button" className="sal-btn" onClick={() => setPhase("verdict")} autoFocus>
                    Now ask the Partner
                  </button>
                )}
              </div>
            )}

            {phase === "verdict" && reading && (
              <div className="space-y-3">
                <div className="flex gap-3 rounded-lg border border-[#6b5328] bg-[#16110a] p-3">
                  <Portrait who="partner" />
                  <div className="min-w-0 space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#f2d16b]">
                      The Partner · {reading.verdict ? STORE_LEVEL_LABEL[reading.verdict.level] : "Cannot judge yet"}
                    </p>
                    <p className="text-sm leading-relaxed text-[#f3e4bf]">{reading.partner}</p>
                    <p className="text-xs text-[#cdbb97]">{reading.headline}</p>
                  </div>
                </div>

                {reading.gates.length > 0 && (
                  <ul className="grid gap-1.5 sm:grid-cols-2" aria-label="The eight gates">
                    {reading.gates.map((g) => (
                      <li key={g.id} className="flex items-start gap-2 text-xs text-[#cdbb97]">
                        <Pip gate={g} size={18} />
                        <span className="min-w-0">
                          <span className="font-semibold text-[#f3e4bf]">{g.title}.</span> {g.reading}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {reading.missing.length > 0 && (
                  <div className="rounded-lg border border-[#6b5328] p-3 text-xs text-[#cdbb97]">
                    <p className="mb-1 font-semibold text-[#f2c98a]">What is missing</p>
                    <ul className="list-disc space-y-0.5 pl-4">
                      {reading.missing.map((m) => (
                        <li key={m.id}>
                          {m.label}. <span className="text-[#a8977a]">{m.fixText}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!known && (
                  <div className="grid gap-3 sm:grid-cols-[1fr_110px]" aria-label="Open the stall">
                    <label className="sal-label">
                      Company name
                      <input className="sal-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Equinor ASA" maxLength={120} autoComplete="off" disabled={demoMode} />
                    </label>
                    <label className="sal-label">
                      Currency
                      <select className="sal-input" value={currency} onChange={(e) => { setCurrency(e.target.value); setCurrencyTouched(true); }} disabled={demoMode}>
                        <option value="">Pick…</option>
                        {CURRENCIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {!known && (
                    <button type="button" className="sal-btn" onClick={openStallAndRun} disabled={demoMode || !name.trim() || currency.trim().length !== 3}>
                      {check.oslo ? "Open the stall, fetch reports, queue the analysis" : "Open the stall and queue the analysis"}
                    </button>
                  )}
                  {known && storeTo && (
                    <Link to={storeTo} className="sal-btn" onClick={onClose}>
                      Enter the store
                    </Link>
                  )}
                  {known && existingRow && !noteSaved && !demoMode && (
                    <button type="button" className="sal-btn-ghost" onClick={saveNote}>
                      Keep the tip note
                    </button>
                  )}
                  {noteSaved && <span className="self-center text-xs text-[#7fe0a0]">Tip note saved on the watchlist entry.</span>}
                  <button type="button" className="sal-btn-ghost" onClick={another}>
                    Another tip
                  </button>
                </div>
                {!known && <p className="text-[0.7rem] text-[#a8977a]">The press makes the same three calls as the Marketplace and the Analysis queue already do, and writes your tip source into the watchlist notes. Nothing is bought or sold.</p>}
              </div>
            )}

            {(phase === "working" || phase === "done") && (
              <div className="space-y-3">
                <ul className="space-y-1 text-sm text-[#f3e4bf]" aria-label="Progress" role="status">
                  <li>{stepIcon(steps.add)} Open the stall</li>
                  <li>{stepIcon(steps.reports)} Fetch the reports from Newsweb</li>
                  <li>{stepIcon(steps.queue)} Queue the analysis</li>
                </ul>
                {summary && (summary.outcome === "captured" || summary.outcome === "up_to_date") && (
                  <p className="text-xs text-[#cdbb97]">
                    Reports on file: {summary.annualCount} annual, {summary.halfYearCount} half-year ({summary.newlyImported} new).
                  </p>
                )}
                {summary && summary.notes.slice(0, 3).map((n) => <p key={n} className="text-xs text-[#f2c98a]">{n}</p>)}
                {notes.map((n) => <p key={n} className="text-xs text-[#f2c98a]">{n}</p>)}
                {phase === "done" && (
                  <>
                    <p className="text-sm text-[#f3e4bf]">{NOT_ANALYSED_YET}</p>
                    <div className="flex flex-wrap gap-2">
                      {storeTo && <Link to={storeTo} className="sal-btn" onClick={onClose}>Enter the store</Link>}
                      <Link to="/analysis-queue" className="sal-btn-ghost" onClick={onClose}>Watch the queue</Link>
                      <button type="button" className="sal-btn-ghost" onClick={askAgain}>Ask the Partner again</button>
                      <button type="button" className="sal-btn-ghost" onClick={another}>Another tip</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <p className="border-t border-[#3b2a16] px-4 py-2 text-[0.7rem] leading-snug text-[#a8977a] sm:px-5">
          Sal and the Partner are invented characters, not real people and not quotations from anyone. They read what the app has stored through fixed rules; they never tell you what to buy or sell, and nothing here trades anything.
        </p>
      </div>
    </div>
  );
}
