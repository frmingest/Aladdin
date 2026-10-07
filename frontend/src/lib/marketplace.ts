import type {
  AnalysisRun,
  HoldingMetrics,
  HoldingThesis,
  HoldingValuation,
  MoatRating,
  VerdictRating,
  WatchlistRow,
  WatchlistStatus,
} from "./types";

/**
 * The Marketplace (game mode, F33 G9, 2026-10-01): a street of stores, one per
 * watchlist company, and a deep-dive page inside each store.
 *
 * Everything here is a reading aid over values the app already stored: the
 * watchlist snapshot, the DCF / justified-P/B / look-through scenarios, the
 * deterministic ratios, the stored analyst verdict and the thesis monitor.
 * It computes no financial figure of its own except two plain arithmetic
 * reads of a stored number (the price that would leave a 25% cushion, and
 * where today's price sits against the stored scenarios). It calls no
 * provider or model, writes nothing, and never tells the reader to buy or
 * sell: it reports which gates are open, ajar, closed or unknown, and why.
 * Unknown stays unknown: a missing figure is never counted as good or bad.
 *
 * The thresholds below are shown to the reader on the page ("How the gates
 * are read"), so every gate can be checked. They are version 1; a change to
 * them is a new version, not an in-place edit (CLAUDE.md Rule 3).
 */

export const MARKET_RULES_VERSION = "market-v1";

export const MARKET_RULES = {
  /** Base-case margin of safety (fraction) at or above which the price gate is open. */
  priceOpenMos: 0.25,
  /** Net debt / EBITDA: at or below = open, up to ajarMax = ajar, above = closed. */
  debtOpenMax: 2.5,
  debtAjarMax: 4,
  /** EBIT / interest below this drops the walls gate one step. */
  interestCoverMin: 3,
  /** ROIC (companies): at or above = open; at or above ajar = ajar; below = closed. */
  roicOpen: 0.15,
  roicAjar: 0.08,
  /** ROE (banks and insurers, where ROIC does not apply). */
  roeOpen: 0.1,
  roeAjar: 0.06,
  /** Analysis age in days (same cut-offs as the Fortress freshness). */
  analysisFreshDays: 90,
  analysisStaleDays: 180,
} as const;

export type GateStatus = "open" | "ajar" | "closed" | "unknown" | "na";
export type GateId =
  | "moat"
  | "walls"
  | "earnings"
  | "price"
  | "yourprice"
  | "verdict"
  | "thesis"
  | "evidence";
export type GateSource = "rule" | "model" | "you";

export interface Gate {
  id: GateId;
  title: string;
  /** What the gate asks, in the game's words. */
  question: string;
  status: GateStatus;
  /** One plain sentence on what was found. */
  reading: string;
  /** Stored values the reading was made from. */
  facts: string[];
  /** rule = fixed rule over stored numbers; model = written by the analysis model; you = your own input. */
  source: GateSource;
  /** Business-quality gate: a closed one means "pass for now" whatever the price. */
  business: boolean;
}

export const GATE_STATUS_LABEL: Record<GateStatus, string> = {
  open: "Open",
  ajar: "Ajar",
  closed: "Closed",
  unknown: "Unknown",
  na: "Not applicable",
};

const num = (v: string | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const pctText = (fraction: number): string => `${(fraction * 100).toFixed(Math.abs(fraction) >= 0.1 ? 0 : 1)}%`;
const x2 = (n: number): string => `${n.toFixed(2)}×`;

// ---------------------------------------------------------------------------
// Individual gates (exported so the street can show the ones a watchlist row already carries).

export function moatGate(rating: MoatRating | null): Gate {
  const base = {
    id: "moat" as const,
    title: "Moat",
    question: "Is there a wide ditch between this business and its rivals?",
    source: "model" as const,
    business: true,
  };
  if (rating === "Wide") return { ...base, status: "open", reading: "The analysis found a wide moat.", facts: ["Moat: Wide"] };
  if (rating === "Narrow") return { ...base, status: "ajar", reading: "The analysis found a narrow moat: some protection, not a lot.", facts: ["Moat: Narrow"] };
  if (rating === "None") return { ...base, status: "closed", reading: "The analysis found no durable moat.", facts: ["Moat: None"] };
  return { ...base, status: "unknown", reading: "No analysis on file, so the moat is not surveyed.", facts: [] };
}

export interface ScenarioPoint {
  label: string;
  value: number;
  /** Fraction, positive = price below this value. */
  mos: number | null;
}

/** The stored bear / base / bull values, whichever method produced them. */
export function scenarioPoints(v: HoldingValuation | null): ScenarioPoint[] {
  if (!v || v.valuation_status === "implausible" || v.valuation_status === "unavailable") return [];
  const pts: ScenarioPoint[] = [];
  if (v.valuation_method === "financials_price_to_book" && v.financials) {
    for (const s of v.financials.scenarios) {
      const value = num(s.value_per_share);
      if (value !== null) pts.push({ label: s.label, value, mos: num(s.margin_of_safety) });
    }
  } else if (v.valuation_method === "fund_look_through_pe" && v.fund_look_through) {
    for (const s of v.fund_look_through.scenarios) {
      const value = num(s.value_per_unit);
      if (value !== null) pts.push({ label: s.label, value, mos: num(s.margin_of_safety) });
    }
  } else if (v.dcf) {
    for (const s of v.dcf.scenarios) {
      const value = num(s.intrinsic_value_per_share);
      if (value !== null) pts.push({ label: s.label, value, mos: num(s.margin_of_safety) });
    }
  }
  return pts.sort((a, b) => a.value - b.value);
}

const pick = (pts: ScenarioPoint[], word: string): ScenarioPoint | null =>
  pts.find((p) => p.label.toLowerCase().includes(word)) ?? null;

/** The base case: the one labelled base, else the middle one. */
export function baseScenario(pts: ScenarioPoint[]): ScenarioPoint | null {
  if (pts.length === 0) return null;
  return pick(pts, "base") ?? pts[Math.floor((pts.length - 1) / 2)];
}

export function priceGate(valuation: HoldingValuation | null, row: WatchlistRow | null): Gate {
  const base = {
    id: "price" as const,
    title: "Fair price",
    question: "Is the price low enough against what the business looks worth?",
    source: "rule" as const,
    business: false,
  };
  if (valuation && (valuation.valuation_status === "implausible" || valuation.valuation_status === "unavailable")) {
    return {
      ...base,
      status: "unknown",
      reading:
        valuation.valuation_status === "implausible"
          ? "The valuation was computed, then withheld as not credible against the price. No number is shown."
          : "No valuation could be made from the stored data.",
      facts: valuation.valuation_status_reason ? [valuation.valuation_status_reason] : [],
    };
  }
  const pts = scenarioPoints(valuation);
  const b = baseScenario(pts);
  let mos = b ? b.mos : null;
  if (mos === null && !valuation) mos = num(row?.margin_of_safety_base);
  if (mos === null) {
    return { ...base, status: "unknown", reading: "No margin of safety is stored yet for this company.", facts: [] };
  }
  const facts = [`Base-case margin of safety: ${pctText(mos)}`];
  if (mos >= MARKET_RULES.priceOpenMos) {
    return { ...base, status: "open", reading: `Priced ${pctText(mos)} under the base case: a real cushion.`, facts };
  }
  if (mos > 0) {
    return { ...base, status: "ajar", reading: `Priced ${pctText(mos)} under the base case: below value, but a thin cushion.`, facts };
  }
  return { ...base, status: "closed", reading: `Priced at or above the base case (${pctText(mos)}): no cushion.`, facts };
}

const YOUR_PRICE: Record<WatchlistStatus, { status: GateStatus; reading: string }> = {
  buy_zone: { status: "open", reading: "Today's price is at or below the price you named." },
  near: { status: "ajar", reading: "Today's price is within 10% above the price you named." },
  above: { status: "closed", reading: "Today's price is more than 10% above the price you named." },
  no_target: { status: "unknown", reading: "You have not named a price for this store yet." },
  no_price: { status: "unknown", reading: "No current price is stored." },
  currency_mismatch: { status: "unknown", reading: "Your price and the quote are in different currencies, so they are not compared." },
};

export function yourPriceGate(row: WatchlistRow | null): Gate {
  const base = {
    id: "yourprice" as const,
    title: "Your price",
    question: "Is it at or below the price you said you would pay?",
    source: "you" as const,
    business: false,
  };
  if (!row) return { ...base, status: "na", reading: "Not on your watchlist.", facts: [] };
  const m = YOUR_PRICE[row.status];
  const facts: string[] = [];
  if (row.buy_below_price) facts.push(`Your price: ${row.buy_below_price} ${row.buy_below_currency ?? ""}`.trim());
  const d = num(row.distance_to_buy_pct);
  if (d !== null) facts.push(`Price vs yours: ${d > 0 ? "+" : ""}${d.toFixed(0)}%`);
  return { ...base, status: m.status, reading: m.reading, facts };
}

export function verdictGate(rating: VerdictRating | null): Gate {
  const base = {
    id: "verdict" as const,
    title: "Analyst's word",
    question: "What did the Buffett/Munger analysis conclude?",
    source: "model" as const,
    business: true,
  };
  if (rating === "Strong Buy" || rating === "Buy") {
    return { ...base, status: "open", reading: `The stored analysis rates it "${rating}". That is the model's reading of the evidence, not a computed figure.`, facts: [`Stored verdict: ${rating}`] };
  }
  if (rating === "Hold") {
    return { ...base, status: "ajar", reading: 'The stored analysis rates it "Hold": decent, not compelling.', facts: ["Stored verdict: Hold"] };
  }
  if (rating === "Sell" || rating === "Avoid") {
    return { ...base, status: "closed", reading: `The stored analysis rates it "${rating}".`, facts: [`Stored verdict: ${rating}`] };
  }
  return { ...base, status: "unknown", reading: "No analysis has been run for this company yet.", facts: [] };
}

export function evidenceGate(ageDays: number | null): Gate {
  const base = {
    id: "evidence" as const,
    title: "Freshness",
    question: "Is the analysis recent enough to lean on?",
    source: "rule" as const,
    business: false,
  };
  if (ageDays === null) return { ...base, status: "unknown", reading: "No analysis date on file.", facts: [] };
  const facts = [`Analysis age: ${ageDays} days`];
  if (ageDays <= MARKET_RULES.analysisFreshDays) return { ...base, status: "open", reading: `The analysis is ${ageDays} days old: fresh.`, facts };
  if (ageDays <= MARKET_RULES.analysisStaleDays) return { ...base, status: "ajar", reading: `The analysis is ${ageDays} days old: ageing. Prices and filings may have moved.`, facts };
  return { ...base, status: "closed", reading: `The analysis is ${ageDays} days old: stale. Re-run it before leaning on it.`, facts };
}

export function thesisGate(status: HoldingThesis["status"] | null): Gate {
  const base = {
    id: "thesis" as const,
    title: "Tripwires",
    question: "Is the thesis still standing, with no alarm rung?",
    source: "rule" as const,
    business: true,
  };
  if (status === "intact") return { ...base, status: "open", reading: "No tripwire has fired and nothing flags the thesis.", facts: ["Thesis: intact"] };
  if (status === "review") return { ...base, status: "ajar", reading: "Something changed since the analysis: the thesis is flagged for review.", facts: ["Thesis: review"] };
  if (status === "tripwire_fired") return { ...base, status: "closed", reading: "A tripwire has fired on this company.", facts: ["Thesis: tripwire fired"] };
  return { ...base, status: "unknown", reading: "No thesis rules to check yet (no analysis).", facts: [] };
}

export function wallsGate(
  instrumentType: string,
  valuation: HoldingValuation | null,
  metrics: HoldingMetrics | null,
): Gate {
  const base = {
    id: "walls" as const,
    title: "Walls",
    question: "Can the balance sheet take a bad year?",
    source: "rule" as const,
    business: true,
  };
  if (instrumentType !== "stock") {
    return { ...base, status: "na", reading: "A fund or ETC has no balance sheet of its own; its holdings are valued by look-through.", facts: [] };
  }
  if (valuation?.valuation_method === "financials_price_to_book") {
    return { ...base, status: "na", reading: "A bank or insurer is levered by design; it is read through return on equity and book value, not net debt.", facts: [] };
  }
  const c = metrics?.computed ?? {};
  const netDebt = num(c.net_debt);
  const lever = num(c.net_debt_to_ebitda);
  const cover = num(c.interest_coverage);
  const facts: string[] = [];
  if (netDebt !== null) facts.push(`Net debt: ${netDebt <= 0 ? "net cash" : "positive"}`);
  if (lever !== null) facts.push(`Net debt / EBITDA: ${x2(lever)}`);
  if (cover !== null) facts.push(`Interest cover: ${x2(cover)}`);
  let status: GateStatus;
  let reading: string;
  if (netDebt !== null && netDebt <= 0) {
    status = "open";
    reading = "More cash than debt: the walls are thick.";
  } else if (lever !== null) {
    if (lever <= MARKET_RULES.debtOpenMax) {
      status = "open";
      reading = `Net debt is ${x2(lever)} a year of EBITDA: comfortable.`;
    } else if (lever <= MARKET_RULES.debtAjarMax) {
      status = "ajar";
      reading = `Net debt is ${x2(lever)} a year of EBITDA: heavy.`;
    } else {
      status = "closed";
      reading = `Net debt is ${x2(lever)} a year of EBITDA: the walls are rotting.`;
    }
  } else if (netDebt !== null && (metrics?.skipped?.net_debt_to_ebitda ?? "").startsWith("not meaningful")) {
    // Debt exists but EBITDA is not positive: a result, not a gap.
    status = "closed";
    reading = "There is net debt and no positive EBITDA to carry it.";
  } else {
    return { ...base, status: "unknown", reading: "No balance-sheet ratios are stored: upload a filing to survey the walls.", facts };
  }
  if (cover !== null && cover < MARKET_RULES.interestCoverMin && status !== "closed") {
    status = status === "open" ? "ajar" : "closed";
    reading += ` Interest is covered only ${x2(cover)}, which lowers the gate one step.`;
  }
  return { ...base, status, reading, facts };
}

export function earningsGate(
  instrumentType: string,
  valuation: HoldingValuation | null,
  metrics: HoldingMetrics | null,
): Gate {
  const base = {
    id: "earnings" as const,
    title: "Earning power",
    question: "Does the business turn capital into profit at a high rate?",
    source: "rule" as const,
    business: true,
  };
  if (instrumentType !== "stock") {
    return { ...base, status: "na", reading: "A fund earns through its holdings; see the look-through valuation.", facts: [] };
  }
  const bank = valuation?.valuation_method === "financials_price_to_book";
  const key = bank ? "roe" : "roic";
  const v = num(metrics?.computed?.[key]);
  const open = bank ? MARKET_RULES.roeOpen : MARKET_RULES.roicOpen;
  const ajar = bank ? MARKET_RULES.roeAjar : MARKET_RULES.roicAjar;
  const label = bank ? "Return on equity" : "Return on invested capital";
  if (v === null) {
    return { ...base, status: "unknown", reading: `${label} is not stored: upload a filing to measure it.`, facts: [] };
  }
  const facts = [`${label}: ${pctText(v)}`];
  if (v >= open) return { ...base, status: "open", reading: `${label} of ${pctText(v)}: a strong engine.`, facts };
  if (v >= ajar) return { ...base, status: "ajar", reading: `${label} of ${pctText(v)}: respectable, not exceptional.`, facts };
  return { ...base, status: "closed", reading: `${label} of ${pctText(v)}: the business earns little on the capital it uses.`, facts };
}

// ---------------------------------------------------------------------------
// The whole store.

export interface StoreInput {
  instrumentType: string;
  row: WatchlistRow | null;
  valuation: HoldingValuation | null;
  analysis: AnalysisRun | null;
  thesis: HoldingThesis | null;
  metrics: HoldingMetrics | null;
  /** Milliseconds since epoch; injected so tests are deterministic. */
  now?: number;
}

export function analysisAgeDays(analysis: AnalysisRun | null, fallbackIso: string | null, now = Date.now()): number | null {
  const iso = analysis?.completed_at ?? analysis?.blind_completed_at ?? analysis?.started_at ?? fallbackIso;
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now - t) / 86_400_000));
}

export function analystVerdict(analysis: AnalysisRun | null, row: WatchlistRow | null): VerdictRating | null {
  return analysis?.reconciliation?.verdict?.rating ?? analysis?.blind_pass?.verdict?.rating ?? row?.verdict_rating ?? null;
}

export function analystMoat(analysis: AnalysisRun | null, row: WatchlistRow | null): MoatRating | null {
  const blind = analysis?.blind_pass;
  const moat = blind && "moat" in blind ? blind.moat.overall_rating : null; // bond funds and metals have no moat
  return moat ?? row?.moat_rating ?? null;
}

export function buildGates(input: StoreInput): Gate[] {
  const { instrumentType, row, valuation, analysis, thesis, metrics, now } = input;
  return [
    moatGate(analystMoat(analysis, row)),
    wallsGate(instrumentType, valuation, metrics),
    earningsGate(instrumentType, valuation, metrics),
    priceGate(valuation, row),
    yourPriceGate(row),
    verdictGate(analystVerdict(analysis, row)),
    thesisGate(thesis ? thesis.status : null),
    evidenceGate(analysisAgeDays(analysis, row?.analyzed_at ?? null, now)),
  ];
}

export type StoreLevel = "ready" | "promising" | "wait" | "pass" | "unknown";

export const STORE_LEVEL_LABEL: Record<StoreLevel, string> = {
  ready: "Gates open",
  promising: "Promising, doubts remain",
  wait: "Wait for the price",
  pass: "Pass for now",
  unknown: "Cannot judge yet",
};

/** The merchant's line for each level. Original wording; nothing is quoted. */
export const MERCHANT_LINE: Record<StoreLevel, string> = {
  ready: "Every gate I can check stands open. That earns the goods a serious, unhurried look, and your own homework still comes first.",
  promising: "Good bones, and a few doubts. Settle the ajar gates before you trust this one.",
  wait: "Fine goods, wrong price. The shelf will still be here when the tag comes down.",
  pass: "A gate that matters is shut. Not here, not at this price, not for now.",
  unknown: "I cannot weigh what I have not seen. Fill the missing gates and ask me again.",
};

export interface StoreVerdict {
  level: StoreLevel;
  headline: string;
  gates: Gate[];
  counts: { open: number; ajar: number; closed: number; unknown: number };
  /** Plain reasons, most important first. */
  reasons: string[];
  rulesVersion: string;
}

const countStatus = (gates: Gate[], s: GateStatus) => gates.filter((g) => g.status === s).length;

export function judgeStore(gates: Gate[]): StoreVerdict {
  const live = gates.filter((g) => g.status !== "na");
  const counts = {
    open: countStatus(live, "open"),
    ajar: countStatus(live, "ajar"),
    closed: countStatus(live, "closed"),
    unknown: countStatus(live, "unknown"),
  };
  const byId = (id: GateId) => gates.find((g) => g.id === id);
  const status = (id: GateId): GateStatus => byId(id)?.status ?? "na";
  const business = live.filter((g) => g.business);
  const businessClosed = business.filter((g) => g.status === "closed");
  const businessAjar = business.filter((g) => g.status === "ajar");

  let level: StoreLevel;
  let headline: string;
  if (businessClosed.length > 0) {
    level = "pass";
    headline = `A gate that matters is closed: ${businessClosed.map((g) => g.title.toLowerCase()).join(", ")}.`;
  } else if (status("price") === "closed" || status("yourprice") === "closed") {
    level = "wait";
    headline =
      status("price") === "closed"
        ? "The business gates hold, but the price leaves no cushion."
        : "The business gates hold, but today's price is above the price you named.";
  } else if (status("moat") === "unknown" || status("price") === "unknown" || counts.unknown >= 4) {
    level = "unknown";
    const missing = live.filter((g) => g.status === "unknown").map((g) => g.title.toLowerCase());
    headline = `Not enough is known to weigh it: ${missing.join(", ")}.`;
  } else if (counts.closed === 0 && businessAjar.length === 0 && status("price") === "open") {
    level = "ready";
    headline = "Every gate that can be checked is open or fresh enough.";
  } else {
    level = "promising";
    const doubts = live.filter((g) => g.status === "ajar" || g.status === "closed").map((g) => g.title.toLowerCase());
    headline = `No deal-breaker, but doubts remain: ${doubts.join(", ")}.`;
  }

  const rank: Record<GateStatus, number> = { closed: 0, ajar: 1, unknown: 2, open: 3, na: 4 };
  const reasons = [...live]
    .filter((g) => g.status !== "open")
    .sort((a, b) => rank[a.status] - rank[b.status])
    .slice(0, 4)
    .map((g) => `${g.title}: ${g.reading}`);
  if (reasons.length === 0) reasons.push("No gate is closed, ajar or unknown.");

  return { level, headline, gates, counts, reasons, rulesVersion: MARKET_RULES_VERSION };
}

// ---------------------------------------------------------------------------
// "What would change my mind": the next concrete step for each gate that is not open.

export function nextSteps(gates: Gate[], valuation: HoldingValuation | null): string[] {
  const out: string[] = [];
  const st = (id: GateId) => gates.find((g) => g.id === id)?.status;
  if (st("moat") === "unknown" || st("verdict") === "unknown") out.push("Run the analysis on the company page so the moat and verdict can be read.");
  if (st("walls") === "unknown" || st("earnings") === "unknown") out.push("Upload the latest annual report (.xhtml) so the walls and earning power can be measured.");
  if (st("price") === "unknown") out.push("Refresh the valuation, or check why it was withheld (the price gate shows the reason).");
  if (st("yourprice") === "unknown") out.push("Name your price below: the price at which you would be happy to own it.");
  if (st("evidence") === "closed" || st("evidence") === "ajar") out.push("Re-run the analysis: it is getting old.");
  if (st("thesis") === "closed" || st("thesis") === "ajar") out.push("Open the thesis on the company page and read what fired or changed.");
  const cushion = cushionPrice(valuation);
  if ((st("price") === "closed" || st("price") === "ajar") && cushion !== null) {
    out.push(`The base case leaves a ${pctText(MARKET_RULES.priceOpenMos)} cushion at about ${cushion.toFixed(2)} ${valuation?.valuation_currency ?? ""}.`.trim());
  }
  return out;
}

/** The price at which the base case would leave a 25% cushion: value × (1 − 25%). */
export function cushionPrice(valuation: HoldingValuation | null): number | null {
  const b = baseScenario(scenarioPoints(valuation));
  return b ? b.value * (1 - MARKET_RULES.priceOpenMos) : null;
}

// ---------------------------------------------------------------------------
// The price board: where today's price sits against the stored scenarios.

export type LadderZone = "bargain" | "discount" | "fair" | "dear" | "belowBase" | "aboveBase";

export const ZONE_LABEL: Record<LadderZone, string> = {
  bargain: "Under the bear case",
  discount: "Between bear and base",
  fair: "Between base and bull",
  dear: "Above the bull case",
  belowBase: "Below the base case",
  aboveBase: "Above the base case",
};

export interface LadderMarker {
  kind: "bear" | "base" | "bull" | "cushion" | "price" | "yours";
  label: string;
  value: number;
}

export interface Ladder {
  currency: string | null;
  min: number;
  max: number;
  markers: LadderMarker[];
  zone: LadderZone | null;
  /** Why a marker is missing (shown under the board). */
  notes: string[];
}

export function buildLadder(valuation: HoldingValuation | null, row: WatchlistRow | null): Ladder | null {
  const pts = scenarioPoints(valuation);
  if (pts.length === 0 || !valuation) return null;
  const currency = valuation.valuation_currency;
  const markers: LadderMarker[] = [];
  // Use the scenarios' own labels. Only when none is labelled bear / base / bull
  // (an unusual method) fall back to lowest / middle / highest, and only with 3 or more.
  let bear = pick(pts, "bear");
  let bull = pick(pts, "bull");
  let base = pick(pts, "base");
  if (!bear && !bull && !base) {
    if (pts.length >= 3) {
      bear = pts[0];
      base = pts[Math.floor((pts.length - 1) / 2)];
      bull = pts[pts.length - 1];
    } else {
      base = pts[0];
    }
  }
  if (bear) markers.push({ kind: "bear", label: "Bear", value: bear.value });
  if (base) markers.push({ kind: "base", label: "Base", value: base.value });
  if (bull) markers.push({ kind: "bull", label: "Bull", value: bull.value });
  const cushion = cushionPrice(valuation);
  if (cushion !== null) markers.push({ kind: "cushion", label: "25% cushion", value: cushion });
  const price = num(valuation.current_price_per_share);
  const notes: string[] = [];
  if (price !== null) markers.push({ kind: "price", label: "Price today", value: price });
  else notes.push("No current price is stored, so today's price is not drawn.");
  const yours = num(row?.buy_below_price);
  if (yours !== null) {
    if (!row?.buy_below_currency || !currency || row.buy_below_currency === currency) {
      markers.push({ kind: "yours", label: "Your price", value: yours });
    } else {
      notes.push(`Your price is in ${row.buy_below_currency} and the valuation in ${currency}, so it is not drawn.`);
    }
  }
  const values = markers.map((m) => m.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo || hi || 1) * 0.12;
  let zone: LadderZone | null = null;
  if (price !== null) {
    if (bear && base && bull) {
      zone = price < bear.value ? "bargain" : price < base.value ? "discount" : price <= bull.value ? "fair" : "dear";
    } else if (base && !bear && !bull) {
      zone = price < base.value ? "belowBase" : "aboveBase";
    }
  }
  return { currency, min: Math.max(0, lo - pad), max: hi + pad, markers, zone, notes };
}

// ---------------------------------------------------------------------------
// The street: what a watchlist row alone can say, with no extra requests.

export type ShopTone = "gold" | "amber" | "plain" | "mist";

export interface ShopFront {
  tone: ShopTone;
  tag: string;
}

/** The price tag in the shop window: your own buy price versus the quote. */
export function shopFront(row: WatchlistRow): ShopFront {
  switch (row.status) {
    case "buy_zone":
      return { tone: "gold", tag: "In your price range" };
    case "near":
      return { tone: "amber", tag: "Within 10% of your price" };
    case "above":
      return { tone: "plain", tag: "Above your price" };
    case "no_target":
      return { tone: "mist", tag: "No price named" };
    case "no_price":
      return { tone: "mist", tag: "No price on file" };
    case "currency_mismatch":
      return { tone: "mist", tag: "Currencies differ" };
  }
}

/** The five gates a watchlist row already carries, for the pips on the shop sign. */
export function shopPips(row: WatchlistRow): Gate[] {
  return [
    moatGate(row.moat_rating),
    priceGate(null, row),
    yourPriceGate(row),
    verdictGate(row.verdict_rating),
    evidenceGate(analysisAgeDays(null, row.analyzed_at)),
  ];
}

/** Street order: in-range first, then nearest to the price named, then the rest by name. */
export function orderStreet(rows: WatchlistRow[]): WatchlistRow[] {
  const rank: Record<WatchlistStatus, number> = { buy_zone: 0, near: 1, above: 2, no_target: 3, no_price: 4, currency_mismatch: 5 };
  return [...rows].sort((a, b) => {
    const r = rank[a.status] - rank[b.status];
    if (r !== 0) return r;
    const da = num(a.distance_to_buy_pct) ?? Infinity;
    const db = num(b.distance_to_buy_pct) ?? Infinity;
    if (da !== db) return da - db;
    return a.name.localeCompare(b.name);
  });
}

export const MARKET_PATH = "/fortress/marketplace";
export const storePath = (holdingId: string): string => `${MARKET_PATH}/${holdingId}`;
