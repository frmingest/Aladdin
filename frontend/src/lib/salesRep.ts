import type { NewswebAnnualReports, WatchlistRow } from "./types";

/**
 * Sal, the Sales Rep (game mode, Marketplace). An invented, loud market-stall
 * barker who opens new stalls on the street (adds a company to the watchlist)
 * and sends runners to Oslo Børs Newsweb to haul back the company's reports.
 *
 * Everything here is pure: ticker checks, wording and the Newsweb outcome. The
 * dialogue component only draws it. Rules kept from the rest of game mode:
 * nothing is bought or sold, no points or streaks, and Sal never tells you
 * what to do with money (a test enforces his wording). He is not a real person
 * and is not modelled on a real person's name, likeness or catchphrases.
 */

// ---------------------------------------------------------------------------
// Tickers (Yahoo Finance symbols)

export interface Exchange {
  suffix: string;
  name: string;
  /** Trading currency, or null when the suffix is ambiguous (London quotes in pence). */
  currency: string | null;
}

const EXCHANGES: Record<string, Exchange> = {
  OL: { suffix: "OL", name: "Oslo Børs", currency: "NOK" },
  ST: { suffix: "ST", name: "Nasdaq Stockholm", currency: "SEK" },
  CO: { suffix: "CO", name: "Nasdaq Copenhagen", currency: "DKK" },
  HE: { suffix: "HE", name: "Nasdaq Helsinki", currency: "EUR" },
  DE: { suffix: "DE", name: "Xetra (Frankfurt)", currency: "EUR" },
  PA: { suffix: "PA", name: "Euronext Paris", currency: "EUR" },
  AS: { suffix: "AS", name: "Euronext Amsterdam", currency: "EUR" },
  L: { suffix: "L", name: "London", currency: null },
};

export const CURRENCIES = ["NOK", "USD", "EUR", "SEK", "DKK", "GBP", "CHF", "CAD"] as const;

const TICKER_SHAPE = /^[A-Z0-9^][A-Z0-9.=-]{0,14}$/;

export function normalizeTicker(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

/** Common ways people write an Oslo Børs symbol that Yahoo does not use: EQNR.OSL, EQNR.NO,
 * EQNR-OL, EQNR:OL, OSE:EQNR, OSL:EQNR. Returns the Yahoo form (EQNR.OL), or null when the
 * text does not look like one of those (a correct EQNR.OL is also null). */
export function suggestOsloTicker(raw: string): string | null {
  const t = normalizeTicker(raw);
  if (/\.OL$/.test(t)) return null;
  const trailing = /^([A-Z0-9]{1,10}(?:-[A-Z])?)[.:-](OSL|NO|OSE|OL)$/.exec(t);
  if (trailing) return `${trailing[1]}.OL`;
  const leading = /^(OSE|OSL|OL):([A-Z0-9]{1,10})$/.exec(t);
  if (leading) return `${leading[2]}.OL`;
  return null;
}

export type TickerHintKind =
  | "empty" // nothing typed yet: the general Oslo tip
  | "invalid" // characters Yahoo symbols do not use
  | "fix_oslo" // looks like an Oslo symbol written the wrong way
  | "oslo" // .OL
  | "no_suffix" // bare symbol: Yahoo reads it as a US listing
  | "other_exchange"; // a suffix that is not Oslo

export interface TickerCheck {
  ticker: string;
  kind: TickerHintKind;
  valid: boolean;
  oslo: boolean;
  exchange: Exchange | null;
  /** Currency the symbol implies, if any (null = pick one). */
  currency: string | null;
  /** The corrected symbol when kind is "fix_oslo". */
  suggestion: string | null;
}

export function checkTicker(raw: string): TickerCheck {
  const ticker = normalizeTicker(raw);
  const base: TickerCheck = { ticker, kind: "empty", valid: false, oslo: false, exchange: null, currency: null, suggestion: null };
  if (ticker === "") return base;
  const suggestion = suggestOsloTicker(ticker);
  if (suggestion) return { ...base, kind: "fix_oslo", suggestion };
  if (!TICKER_SHAPE.test(ticker)) return { ...base, kind: "invalid" };
  const dot = ticker.lastIndexOf(".");
  const suffix = dot > 0 ? ticker.slice(dot + 1) : "";
  const exchange = suffix ? (EXCHANGES[suffix] ?? null) : null;
  if (exchange?.suffix === "OL") return { ...base, kind: "oslo", valid: true, oslo: true, exchange, currency: "NOK" };
  if (exchange) return { ...base, kind: "other_exchange", valid: true, exchange, currency: exchange.currency };
  // A dot with an unknown suffix is still a real Yahoo shape (0700.HK, BRK-B): allow it, no currency guess.
  if (suffix) return { ...base, kind: "other_exchange", valid: true };
  return { ...base, kind: "no_suffix", valid: true, currency: "USD" };
}

export const OSLO_TIP =
  "For Oslo Børs, use the Yahoo Finance symbol: the ticker plus .OL, for example EQNR.OL, DNB.OL or ORK.OL. Look the symbol up on finance.yahoo.com first.";

export function hintText(check: TickerCheck): string {
  switch (check.kind) {
    case "empty":
      return OSLO_TIP;
    case "invalid":
      return "That has characters Yahoo symbols do not use. Letters, digits, dots and dashes only, like EQNR.OL.";
    case "fix_oslo":
      return `Yahoo writes Oslo Børs symbols with .OL on the end. Did you mean ${check.suggestion}?`;
    case "oslo":
      return "Oslo Børs, in NOK. Newsweb can fetch this company's reports.";
    case "no_suffix":
      return "No exchange suffix, so Yahoo reads this as a US listing. For an Oslo Børs company, put .OL on the end (EQNR.OL).";
    case "other_exchange":
      return `${check.exchange ? `${check.exchange.name}. ` : ""}I can stock the shelf, but Newsweb only covers Oslo Børs, so no report runners for this one.`;
  }
}

// ---------------------------------------------------------------------------
// Sal's lines. Original wording; stall-barker energy, never advice.

export type Mood = "pitch" | "cheer" | "think" | "oops";

const pick = <T,>(items: readonly T[], seed: number): T => items[Math.abs(Math.trunc(seed)) % items.length]!;

export const BOOTH_LINES = [
  "Psst! Got a ticker burning a hole in your notebook? Hand it over and I'll hammer up a stall for it.",
  "Step right up! One ticker, one name, one fresh stall on the street. Quick as a coin drop.",
  "The street never sleeps and neither do I. Name a company and I'll open its shutters.",
  "Fresh stalls, warm lanterns! Tell Sal who's missing from the market.",
] as const;

export const boothLine = (seed: number): string => pick(BOOTH_LINES, seed);

export const INTRO_LINES = [
  "Welcome to my booth! Give me a Yahoo ticker and the company's name and I'll open a stall for it faster than you can blink.",
  "Sal's the name, stalls are the game! Ticker and name, that's all I need. I'll do the hammering.",
  "Right on time! Who are we putting on the street today?",
] as const;

export const introLine = (seed: number): string => pick(INTRO_LINES, seed);

export const DEMO_LINE =
  "Hold your horses, boss. Demo mode is on, so this whole street is painted scenery and I'm not allowed to open real stalls. Switch demo mode off in Settings and come back!";

export const ADDING_LINES = [
  "Hammer, nails, lantern… one stall coming up!",
  "Stocking the shelf. Nobody touch the awning!",
] as const;

export const addingLine = (seed: number): string => pick(ADDING_LINES, seed);

export interface AddedFacts {
  name: string;
  ticker: string;
  owned: boolean;
  /** True/false when the price check ran, null when it did not. */
  hasPrice: boolean | null;
  oslo: boolean;
}

export function addedMood(f: AddedFacts): Mood {
  return f.hasPrice === false ? "think" : "cheer";
}

export function addedLine(f: AddedFacts, seed = 0): string {
  const open = pick(
    [
      `KA-CHING! The ${f.name} stall is open for business!`,
      `Shutters up! ${f.name} has a stall on the street!`,
      `Done and dusted! ${f.name} is on the shelf!`,
    ],
    seed,
  );
  const parts = [open];
  if (f.owned) parts.push("And look at that, you already hold it in your fortress. Now it has a stall too.");
  if (f.hasPrice === false) {
    parts.push(
      `One snag: Yahoo shows no price for ${f.ticker}. Could be a typo or a symbol Yahoo does not carry, so check it on finance.yahoo.com. The stall stays open meanwhile.`,
    );
  } else if (f.hasPrice === true) {
    parts.push("The tape shows a price, so the symbol checks out.");
  }
  if (f.oslo) {
    parts.push(
      "Now, shall I send my runners to Newsweb to haul back every annual and half-year report they've published? Free, no key, and it's how the store gets real numbers.",
    );
  } else {
    parts.push("Newsweb only covers Oslo Børs, so no report runners for this one. You can still step inside the store, or upload a filing on its holding page.");
  }
  return parts.join(" ");
}

export const DUPLICATE_LINE = (name: string): string => `Ha! ${name} already has a stall. Sal doesn't build twice. Go on in and have a look.`;

export const FAILED_ADD_LINE = (detail: string): string => `Whoa, the hammer slipped: ${detail} Fix it up and try again, I'll wait.`;

export const CAPTURE_START_LINES = [
  "Runners, to the Oslo Børs news desk! Fetch every annual report, every half-year report!",
  "Whistle blown, satchels packed. The runners are off to Newsweb!",
] as const;

export const captureStartLine = (seed: number): string => pick(CAPTURE_START_LINES, seed);

export const CAPTURE_PROGRESS_LINES = [
  "Elbowing through the Newsweb crowd…",
  "Annual reports are heavy. The runners are huffing.",
  "Checking each announcement for a proper attachment…",
  "Half-year reports are mostly plain PDFs, so they come back as reading material only, no new numbers.",
  "Stamping the receipts and filing them on the shelf…",
  "Still running! A big company means a big stack.",
  "Sorting the loot by year…",
] as const;

export const captureProgressLine = (tick: number): string => pick(CAPTURE_PROGRESS_LINES, tick);

// ---------------------------------------------------------------------------
// Newsweb outcome

export type CaptureOutcome =
  | "captured" // something new was stored
  | "up_to_date" // reports were already on file, nothing new
  | "empty" // the calls worked but there are no reports
  | "not_found" // Newsweb has nothing for this issuer sign
  | "not_oslo" // the backend says this is not an Oslo Børs issuer
  | "switched_off" // NEWSWEB_FILING_PROVIDER is off
  | "failed"; // anything else

export interface CaptureSummary {
  outcome: CaptureOutcome;
  annualCount: number;
  halfYearCount: number;
  newlyImported: number;
  alreadyOnFile: number;
  /** Plain-language notes for failed or unusable reports, or a failed call. */
  notes: string[];
  /** The raw message when the whole run failed. */
  detail: string | null;
}

type Settled = PromiseSettledResult<NewswebAnnualReports>;

function classifyError(message: string): CaptureOutcome {
  const m = message.toLowerCase();
  if (m.includes("switched off")) return "switched_off";
  if (m.includes("oslo børs issuers only") || m.includes("oslo bors issuers only")) return "not_oslo";
  if (m.includes("found on newsweb") || m.includes("no issuer sign")) return "not_found";
  return "failed";
}

const reasonText = (r: PromiseRejectedResult): string => (r.reason instanceof Error ? r.reason.message : String(r.reason));

const PRIORITY: CaptureOutcome[] = ["switched_off", "not_oslo", "not_found", "failed"];

/** Folds the annual-report and half-year-report imports (run together, as on the holding page)
 * into one result Sal can talk about. A call that fails while the other works is a note, not a
 * failed run: a company with annual reports but no half-year report is normal. */
export function summariseCapture(annual: Settled, interim: Settled): CaptureSummary {
  const out: CaptureSummary = { outcome: "empty", annualCount: 0, halfYearCount: 0, newlyImported: 0, alreadyOnFile: 0, notes: [], detail: null };
  const note = (label: string, s: Settled) => {
    if (s.status !== "fulfilled") return;
    out.newlyImported += s.value.newly_imported_this_run;
    out.alreadyOnFile += s.value.already_on_file_this_run.length;
    for (const f of s.value.failed_this_run) out.notes.push(`${label}: ${f}`);
    if (s.value.no_esef_file_this_run.length > 0) {
      out.notes.push(`${label}: no usable attachment on Newsweb for ${s.value.no_esef_file_this_run.join(", ")}`);
    }
  };
  note("Annual", annual);
  note("Half-year", interim);
  if (annual.status === "fulfilled") out.annualCount = annual.value.reports.length;
  if (interim.status === "fulfilled") out.halfYearCount = interim.value.reports.length;

  const worked = annual.status === "fulfilled" || interim.status === "fulfilled";
  if (!worked) {
    const errs = [annual, interim].filter((s): s is PromiseRejectedResult => s.status === "rejected").map(reasonText);
    const kinds = errs.map(classifyError);
    out.outcome = PRIORITY.find((k) => kinds.includes(k)) ?? "failed";
    out.detail = errs[kinds.indexOf(out.outcome)] ?? errs[0] ?? null;
    return out;
  }
  if (annual.status === "rejected") out.notes.push(`Annual: ${reasonText(annual)}`);
  if (interim.status === "rejected") out.notes.push(`Half-year: ${reasonText(interim)}`);
  const total = out.annualCount + out.halfYearCount;
  out.outcome = total === 0 ? "empty" : out.newlyImported > 0 ? "captured" : "up_to_date";
  return out;
}

export function captureMood(o: CaptureOutcome): Mood {
  return o === "captured" || o === "up_to_date" ? "cheer" : o === "failed" || o === "switched_off" ? "oops" : "think";
}

export function captureLine(s: CaptureSummary): string {
  const reports = (n: number, kind: string) => `${n} ${kind} report${n === 1 ? "" : "s"}`;
  switch (s.outcome) {
    case "captured":
      return `The runners are back, satchels bulging! ${reports(s.annualCount, "annual")} and ${reports(s.halfYearCount, "half-year")} are on the shelf, ${s.newlyImported} of them new today. Annual reports feed the numbers in the store; half-year reports are reading material only.`;
    case "up_to_date":
      return `The runners checked every desk and came back with nothing new. All ${s.annualCount + s.halfYearCount} reports were already on the shelf.`;
    case "empty":
      return "The runners found the desk open but no reports for this company in the window. Newer listings and funds often have none yet.";
    case "not_found":
      return "The runners knocked on every door and Newsweb has never heard of this issuer. The usual cause is a symbol that is not an Oslo Børs one. Check the ticker, or upload the filings by hand on the holding page.";
    case "not_oslo":
      return "Newsweb only deals with Oslo Børs issuers, and this one doesn't look like one. You can upload filings by hand on the holding page.";
    case "switched_off":
      return "The Newsweb runners are switched off on this server (NEWSWEB_FILING_PROVIDER). Turn them on and ask me again, or upload filings by hand on the holding page.";
    case "failed":
      return `The runners tripped on the way: ${s.detail ?? "unknown error"}. Nothing was lost; ask me to try again.`;
  }
}

/** Everything Sal can say, for the wording test. */
export function allSalLines(): string[] {
  const facts: AddedFacts[] = [
    { name: "Acme", ticker: "ACME.OL", owned: true, hasPrice: true, oslo: true },
    { name: "Acme", ticker: "ACME", owned: false, hasPrice: false, oslo: false },
    { name: "Acme", ticker: "ACME.OL", owned: false, hasPrice: null, oslo: true },
  ];
  const summaries: CaptureSummary[] = (["captured", "up_to_date", "empty", "not_found", "not_oslo", "switched_off", "failed"] as const).map((outcome) => ({
    outcome,
    annualCount: 3,
    halfYearCount: 2,
    newlyImported: 1,
    alreadyOnFile: 1,
    notes: [],
    detail: "boom",
  }));
  return [
    ...BOOTH_LINES,
    ...INTRO_LINES,
    DEMO_LINE,
    ...ADDING_LINES,
    ...facts.flatMap((f) => [0, 1, 2].map((s) => addedLine(f, s))),
    DUPLICATE_LINE("Acme"),
    FAILED_ADD_LINE("nope."),
    ...CAPTURE_START_LINES,
    ...CAPTURE_PROGRESS_LINES,
    ...summaries.map(captureLine),
    OSLO_TIP,
    ...(["empty", "invalid", "fix_oslo", "oslo", "no_suffix", "other_exchange"] as const).map((kind) =>
      hintText({ ticker: "X", kind, valid: true, oslo: false, exchange: EXCHANGES.DE!, currency: null, suggestion: "X.OL" }),
    ),
  ];
}

/** Did Yahoo give the new watchlist row a price? null when the row could not be found. */
export function rowHasPrice(row: WatchlistRow | undefined): boolean | null {
  if (!row) return null;
  return row.price !== null && row.status !== "no_price";
}
