/**
 * Scroll reader (game mode G28, Phase A). Pure helpers: the opening/closing sequence of the
 * parchment scroll that wraps the existing report reader, and the words on its seal.
 *
 * View-only. Nothing here reads or writes a stored value, and nothing is awarded for opening a
 * report. The sequence never blocks reading: any key skips it, and with reduced motion the
 * reader starts open.
 */

export type ScrollPhase = "sealed" | "cracking" | "unrolling" | "open" | "rolling";

/** Durations in milliseconds. The file keeps loading during all of them. */
export const SCROLL_MS = {
  sealedHold: 350,
  crack: 150,
  unroll: 700,
  roll: 400,
} as const;

/** Where the sequence starts: straight at `open` when motion is reduced. */
export function initialPhase(reducedMotion: boolean): ScrollPhase {
  return reducedMotion ? "open" : "sealed";
}

/** The next step of the sequence. `open` goes to `rolling` (closing); `rolling` is the end. */
export function nextPhase(phase: ScrollPhase): ScrollPhase {
  switch (phase) {
    case "sealed":
      return "cracking";
    case "cracking":
      return "unrolling";
    case "unrolling":
      return "open";
    case "open":
      return "rolling";
    case "rolling":
      return "rolling";
  }
}

/** How long to wait before moving on by itself; null = wait for the person (or the end). */
export function phaseDelay(phase: ScrollPhase): number | null {
  switch (phase) {
    case "sealed":
      return SCROLL_MS.sealedHold;
    case "cracking":
      return SCROLL_MS.crack;
    case "unrolling":
      return SCROLL_MS.unroll;
    case "open":
    case "rolling":
      return null;
  }
}

/** Any key (or a click on the page) while the scroll is still opening shows the report at once. */
export function skipToOpen(phase: ScrollPhase): ScrollPhase {
  return phase === "sealed" || phase === "cracking" || phase === "unrolling" ? "open" : phase;
}

/** True while the seal is still on the page. */
export function sealVisible(phase: ScrollPhase): boolean {
  return phase === "sealed" || phase === "cracking";
}

/** True while the report cannot be read yet (the paper is not fully unrolled). */
export function isOpening(phase: ScrollPhase): boolean {
  return phase === "sealed" || phase === "cracking" || phase === "unrolling";
}

/** Whole sequence length, for tests and for the close timer. */
export function openingTotalMs(): number {
  return SCROLL_MS.sealedHold + SCROLL_MS.crack + SCROLL_MS.unroll;
}

const KIND_LABEL: Record<string, string> = {
  annual_report: "Annual report",
  quarterly_report: "Interim report",
  interim_report: "Interim report",
  half_year_report: "Half-year report",
  presentation: "Presentation",
};

/** The two lines on the seal: what kind of document and which period it belongs to. */
export function scrollHeading(doc: {
  original_filename: string;
  type?: string;
  reporting_period?: string | null;
}): { kicker: string; title: string } {
  const typeLabel = doc.type ? (KIND_LABEL[doc.type] ?? doc.type.replace(/_/g, " ")) : "Report";
  const kicker = [typeLabel, doc.reporting_period].filter(Boolean).join(" · ");
  const title = doc.original_filename.replace(/\.[A-Za-z0-9]{2,5}$/, "").replace(/[_-]+/g, " ").trim();
  return { kicker, title: title || doc.original_filename };
}

/**
 * Parchment tint (the page is multiplied onto the paper). Right for white HTML filings. A PDF is
 * shown by the browser's own viewer, whose grey surround would darken, so it starts untinted and
 * the person can switch it on.
 */
export function defaultTint(kind: "pdf" | "html" | "download"): boolean {
  return kind === "html";
}
