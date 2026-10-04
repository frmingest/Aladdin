import { buildGates, judgeStore, nextSteps, type Gate, type StoreLevel, type StoreVerdict } from "./marketplace";
import type { StoreData } from "./marketStore";

/**
 * The Hype Booth (game mode, G12). A friend, Reddit or a newsletter gives you a ticker. Sal pitches it
 * loudly; the Partner (the blunt sceptic from the advisors) lets the air out if it deserves that. The gates
 * themselves are the Marketplace's own (`market-v1`): this file adds the tip's wording, what is missing, and
 * what one press can fetch. Pure, so it is unit-tested.
 *
 * Rules kept: read-only apart from writes the app already has (add to the watchlist, Newsweb fetch, queue an
 * analysis); a ticker the app knows nothing about is "Cannot judge yet", never a guess; nothing says buy or
 * sell; no points, streaks or rewards; Sal and the Partner are invented and not quotations from anyone.
 */

export const HEARD_FROM = ["a friend", "Reddit", "a newsletter", "social media", "a podcast", "somewhere else"] as const;
export type HeardFrom = (typeof HEARD_FROM)[number];

/** The note kept on the watchlist entry (the existing notes field), so tips can be compared with outcomes later. */
export function heardNote(source: HeardFrom, detail: string, isoDate: string): string {
  const who = detail.trim();
  return `Heard from ${source}${who ? ` (${who})` : ""} on ${isoDate.slice(0, 10)}.`;
}

/** Append to existing notes without losing them. */
export function withHeardNote(existing: string | null, note: string): string {
  const trimmed = (existing ?? "").trim();
  if (trimmed.includes(note)) return trimmed;
  return trimmed ? `${trimmed}\n${note}` : note;
}

const pick = <T,>(items: readonly T[], seed: number): T => items[Math.abs(Math.trunc(seed)) % items.length]!;

export const PITCH_LINES = [
  (t: string) => `Psst! Step right up! ${t}! Everybody is whispering about ${t}! The line at the door is around the block!`,
  (t: string) => `Ladies, gentlemen, and quiet people at the back: ${t}! Hot off the grapevine! I have heard about it from at least one person!`,
  (t: string) => `Ding ding ding! ${t}! The talk of the street! Nobody has checked it, but wow, the talk!`,
  (t: string) => `Can you feel that? The air is buzzing! ${t}! Somebody's cousin swears by it!`,
] as const;
export const pitchLine = (ticker: string, seed: number): string => pick(PITCH_LINES, seed)(ticker || "this one");

export const HYPE_INTRO_LINES = [
  "Got a hot tip burning a hole in your pocket? Tell me the ticker and who whispered it. I'll shout it from the roof and then we'll see if it holds.",
  "Every street has a rumour. Give me the ticker and where you heard it, and we'll find out if the rumour has any walls.",
  "A tip is a story, not a fact. Read me the ticker and I'll tell the story. Then the Partner checks it.",
] as const;
export const hypeIntroLine = (seed: number): string => pick(HYPE_INTRO_LINES, seed);

export const HYPE_DEMO_LINE = "Demo mode is on, so the booth is painted scenery. Switch it off in Settings and bring me a real tip.";

export type PartnerKey = StoreLevel | "nothing";

/** The Partner's reading. Original wording; none of it is a quotation and none says what to do with money. */
export const PARTNER_LINES: Record<PartnerKey, string> = {
  nothing:
    "I cannot judge a company this app knows nothing about. No price, no filings, no analysis. A tip is not evidence. Fetch the reports, run the analysis, then ask me again.",
  unknown: "Too little is stored to weigh it. The missing pieces are listed below. Until they are filled, the loudest pitch counts for nothing.",
  pass: "The tip does not survive the gates. Something that matters is shut. The noise does not change that.",
  wait: "Maybe a fine business, but the price leaves no cushion. The tip says nothing about price, and price is the half that decides.",
  promising: "It survives a first look, with doubts. That is a reason to read the filings, not a signal. Settle the ajar gates first.",
  ready: "The gates that can be checked are open. That earns a serious, unhurried look. It is a reason to study it, not a signal, and the homework is still yours.",
};

export const partnerLine = (key: PartnerKey): string => PARTNER_LINES[key];

export type MissingId = "price" | "filings" | "valuation" | "analysis";
export type MissingFix = "warmup" | "newsweb" | "upload" | "queue";

export interface MissingItem {
  id: MissingId;
  label: string;
  /** What fills it. */
  fix: MissingFix;
  fixText: string;
}

/** What the app does not have yet for this company. `data` is null when the ticker is not known at all. */
export function missingForJudgement(data: StoreData | null, oslo: boolean): MissingItem[] {
  const filings: MissingItem = oslo
    ? { id: "filings", label: "No annual or half-year reports stored", fix: "newsweb", fixText: "Fetch the reports from Oslo Børs Newsweb (free)." }
    : { id: "filings", label: "No filings stored", fix: "upload", fixText: "Upload an annual report on the holding page." };
  const valuation: MissingItem = { id: "valuation", label: "No usable valuation", fix: "newsweb", fixText: "A valuation needs filings first." };
  const price: MissingItem = { id: "price", label: "No price stored", fix: "warmup", fixText: "The price is fetched once the stall is open." };
  const analysis: MissingItem = { id: "analysis", label: "No analysis yet", fix: "queue", fixText: "Queue the analysis; it runs later on your PC worker." };

  if (data === null) return [price, filings, valuation, analysis];

  const out: MissingItem[] = [];
  const hasPrice = data.row?.price != null || data.valuation?.current_price_per_share != null;
  if (!hasPrice) out.push(price);
  if (data.metrics === null) out.push(filings);
  const v = data.valuation;
  if (v === null || v.valuation_status === "unavailable" || v.valuation_status === "implausible") {
    const reason = v?.unavailable_reasons?.[0];
    out.push({ ...valuation, label: reason ? `No usable valuation: ${reason}` : valuation.label, fix: data.metrics === null ? valuation.fix : "queue" });
  }
  if (data.analysis === null) out.push(analysis);
  return out;
}

export interface HypeReading {
  /** `nothing` when the app has never seen the ticker. */
  key: PartnerKey;
  headline: string;
  partner: string;
  gates: Gate[];
  verdict: StoreVerdict | null;
  missing: MissingItem[];
  steps: string[];
  rulesVersion: string;
}

/** Read a tip. `data` is the stored picture of the company, or null when the ticker is not on the street or in the
 * fortress. Same gates and same verdict rules as the store page, so the two never disagree. */
export function readTip(data: StoreData | null, oslo: boolean, now?: number): HypeReading {
  const missing = missingForJudgement(data, oslo);
  if (data === null) {
    return {
      key: "nothing",
      headline: "Cannot judge yet: the app has nothing stored for this ticker.",
      partner: partnerLine("nothing"),
      gates: [],
      verdict: null,
      missing,
      steps: ["Open the stall, fetch the reports and queue the analysis, then ask again."],
      rulesVersion: "market-v1",
    };
  }
  const gates = buildGates({
    instrumentType: data.holding?.asset_class_raw ?? data.row?.instrument_type ?? "stock",
    row: data.row,
    valuation: data.valuation,
    analysis: data.analysis,
    thesis: data.thesis,
    metrics: data.metrics,
    now,
  });
  const verdict = judgeStore(gates);
  return {
    key: verdict.level,
    headline: verdict.headline,
    partner: partnerLine(verdict.level),
    gates,
    verdict,
    missing,
    steps: nextSteps(gates, data.valuation),
    rulesVersion: verdict.rulesVersion,
  };
}

/** Every fixed sentence, so a test can check the wording rules. */
export function allHypeLines(): string[] {
  return [
    ...PITCH_LINES.map((f) => f("TICK")),
    ...HYPE_INTRO_LINES,
    HYPE_DEMO_LINE,
    ...Object.values(PARTNER_LINES),
    "Nothing is analysed yet: the analysis runs later on your PC worker, so this stays Cannot judge yet until it has.",
  ];
}

/** The honest after-the-press sentence. */
export const NOT_ANALYSED_YET = "Nothing is analysed yet: the analysis runs later on your PC worker, so this stays Cannot judge yet until it has.";
