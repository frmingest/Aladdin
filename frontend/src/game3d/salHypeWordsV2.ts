import { addedLine, captureLine, type AddedFacts, type CaptureSummary } from "../lib/salesRep";
import { partnerLine, type HypeReading, type MissingItem, type PartnerKey } from "../lib/hype";

/**
 * Game-voice layer for Sal's booth and the Hype Booth in /game3d (text pass 4c). The flat Marketplace keeps the V1
 * wording in `lib/salesRep.ts` and `lib/hype.ts` (untouched); the dialogs take `voice="game"` and /game3d passes it.
 * Only the lines that sounded like a system are changed: "stored", "filings", "worker", a server flag name and
 * "unknown error" become the glossary words (fog, reports, your PC). Sal's stall-barker lines are already game voice
 * and stay as they are. Numbers and rules are unchanged: nothing says what to do with money.
 */

export const PARTNER_LINES_V2: Record<PartnerKey, string> = {
  nothing: "I can't weigh a company the app has never seen. No price, no reports, no analysis. A tip is not evidence. Fetch the reports, run the analysis, then ask me again.",
  unknown: "Too much is in fog to weigh it. The missing pieces are listed below. Until they are filled, the loudest pitch counts for nothing.",
  pass: partnerLine("pass"),
  wait: partnerLine("wait"),
  promising: "It survives a first look, with doubts. That is a reason to read the reports, not a signal. Settle the ajar gates first.",
  ready: partnerLine("ready"),
};

export const NOTHING_HEADLINE_V2 = "Can't judge yet: this ticker is all fog.";
export const CANT_READ_V2 = "Can't read that right now. Try again.";
export const PARTNER_BUSY_V2 = "The Partner is checking the shelves…";
export const NOT_ANALYSED_YET_V2 = "The analysis is queued and runs later on your PC. Until it has, this stays Can't judge yet.";
export const QUEUE_FAILED_V2 = "The analysis was not queued. It may need reports first; try again from the Analysis queue page once they are in.";
export const SWITCHED_OFF_V2 = "The report runners are switched off on this server. Turn them on and ask me again, or upload reports by hand on the holding page.";
export const RUNNERS_TRIPPED_V2 = "The runners tripped on the way. Nothing was lost; ask me to try again.";

const MISSING_V2: Record<MissingItem["id"], { label: string; fixText?: string }> = {
  price: { label: "No price yet", fixText: "The price is fetched once the stall is open." },
  filings: { label: "No reports yet" },
  valuation: { label: "No worth estimate yet", fixText: "A worth estimate needs reports first." },
  analysis: { label: "No analysis yet", fixText: "Queue the analysis; it runs later on your PC." },
};

export function missingV2(m: MissingItem): MissingItem {
  const v = MISSING_V2[m.id];
  const reasonAt = m.label.indexOf(": ");
  const reason = m.id === "valuation" && reasonAt > 0 ? m.label.slice(reasonAt) : "";
  return { ...m, label: `${v.label}${reason}`, fixText: v.fixText ?? m.fixText.replace(/annual report/g, "report") };
}

/** The Partner's reading with the game words; same gates, same verdict, same key. */
export function readingV2(r: HypeReading): HypeReading {
  return {
    ...r,
    partner: PARTNER_LINES_V2[r.key],
    headline: r.key === "nothing" ? NOTHING_HEADLINE_V2 : r.headline,
    missing: r.missing.map(missingV2),
  };
}

const reports = (t: string): string => t.replace(/\bfilings\b/g, "reports").replace(/\bfiling\b/g, "report");

export const addedLineV2 = (f: AddedFacts, seed = 0): string => reports(addedLine(f, seed));

export function captureLineV2(s: CaptureSummary): string {
  if (s.outcome === "switched_off") return SWITCHED_OFF_V2;
  if (s.outcome === "failed") return RUNNERS_TRIPPED_V2;
  return reports(captureLine(s));
}

/** Words the player must not see on the page face in /game3d for these two booths. */
export const BOOTH_BANNED = [/\bstored\b/i, /\bfilings?\b/i, /\bworker\b/i, /NEWSWEB_/, /unknown error/i];
