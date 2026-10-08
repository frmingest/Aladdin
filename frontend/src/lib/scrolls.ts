import type { DocumentSummary } from "./types";

/**
 * The Scrolls library (game mode G30): how a holding's documents are shelved and which of them open
 * as a parchment scroll. View-only helpers: nothing here reads or writes a stored value, and
 * opening a scroll earns nothing.
 */

export type ShelfId = "annual" | "quarterly" | "misc";

export const SHELVES: ReadonlyArray<{ id: ShelfId; title: string; empty: string }> = [
  { id: "annual", title: "Annual reports", empty: "No annual report on this shelf yet." },
  { id: "quarterly", title: "Quarterly and half-year reports", empty: "No quarterly or half-year report on this shelf yet." },
  { id: "misc", title: "Miscellaneous", empty: "Nothing else is stored." },
];

/** Annual reports on one shelf, quarterly and half-year (stored as `quarterly_report`) on another, the rest together. */
export function shelfOf(type: string): ShelfId {
  if (type === "annual_report") return "annual";
  if (type === "quarterly_report") return "quarterly";
  return "misc";
}

/** When the report came out: Newsweb's own date when known, otherwise the upload time. */
export function scrollDate(doc: Pick<DocumentSummary, "uploaded_at" | "quality_flags">): string {
  const source = doc.quality_flags?.["newsweb_source"];
  if (source && typeof source === "object") {
    const published = (source as Record<string, unknown>)["published_at"];
    if (typeof published === "string" && published) return published;
  }
  return doc.uploaded_at;
}

export interface Shelf {
  id: ShelfId;
  title: string;
  empty: string;
  documents: DocumentSummary[];
}

/** Every shelf, always in the same order (empty ones included), newest scroll first on each. */
export function groupScrolls(documents: DocumentSummary[]): Shelf[] {
  return SHELVES.map((shelf) => ({
    ...shelf,
    documents: documents
      .filter((d) => shelfOf(d.type) === shelf.id)
      .sort((a, b) => scrollDate(b).localeCompare(scrollDate(a))),
  }));
}

/**
 * What a scroll is called on its face: the stored reporting period when there is one, otherwise a
 * year / quarter read from the file name ("Q2 2026", "FY2025", "2025"), otherwise the first 20
 * characters of the file name. Never "undated".
 */
export function scrollLabel(
  doc: Pick<DocumentSummary, "original_filename" | "reporting_period" | "uploaded_at" | "quality_flags">,
): string {
  if (doc.reporting_period) return doc.reporting_period;
  const name = doc.original_filename.replace(/\.[A-Za-z0-9]{2,5}$/, "");
  const year = name.match(/(?:^|[^0-9])((?:19|20)\d{2})(?![0-9])/)?.[1];
  const quarter = name.match(/(?:^|[^A-Za-z0-9])(?:Q([1-4])|([1-4])Q|([1-4])(?:st|nd|rd|th)[ _-]?quarter)(?![0-9])/i);
  const q = quarter?.[1] ?? quarter?.[2] ?? quarter?.[3];
  const half = /(?:^|[^A-Za-z0-9])(?:H([12])|half[ _-]?year)/i.test(name);
  if (q && year) return `Q${q} ${year}`;
  if (half && year) return `H1/H2 ${year}`.replace("H1/H2", "Half-year");
  if (year) return /annual/i.test(name) ? `FY${year}` : year;
  const text = name.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() || doc.original_filename;
  return text.length > 20 ? `${text.slice(0, 20).trimEnd()}…` : text;
}

/** A plain label for the file format on a scroll's tag. */
export function formatTag(filename: string): string {
  const name = filename.toLowerCase();
  if (name.endsWith(".pdf")) return "PDF";
  if (name.endsWith(".xhtml") || name.endsWith(".html") || name.endsWith(".htm")) return "XHTML";
  if (name.endsWith(".xlsx") || name.endsWith(".csv")) return "Table";
  if (name.endsWith(".pptx")) return "Slides";
  return "File";
}

/**
 * Which reader a document opens in, with game mode on.
 *
 * An annual report in .xhtml keeps the original side-by-side reader (the filing next to the figures
 * stored from its tags, press a figure to jump to that exact number): that view is the point of an
 * ESEF file. Everything else opens as a scroll. A caller that does not know the document type (the
 * eye next to a figure in Metrics) gets the side-by-side reader for an XHTML filing too, because it
 * can only have come from one with tagged figures.
 */
export function readsAsScroll(doc: { original_filename: string; type?: string }): boolean {
  const isHtml = formatTag(doc.original_filename) === "XHTML";
  if (!isHtml) return true;
  if (doc.type === undefined) return false;
  return doc.type !== "annual_report";
}

/* "Opened" is a per-browser reading convenience (decision D4, 2026-10-08): it says a scroll was opened,
   not that it was understood, it never leaves this browser, and it earns nothing. */

export const OPENED_KEY = "aladdin-scrolls-opened";
export const MAX_OPENED = 1000;

export function loadOpened(storage: Pick<Storage, "getItem"> | null = safeStorage()): Set<string> {
  try {
    const raw = storage?.getItem(OPENED_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((v): v is string => typeof v === "string")) : new Set();
  } catch {
    return new Set();
  }
}

export function saveOpened(opened: Set<string>, storage: Pick<Storage, "setItem"> | null = safeStorage()): void {
  try {
    storage?.setItem(OPENED_KEY, JSON.stringify([...opened].slice(-MAX_OPENED)));
  } catch {
    /* blocked storage: the seals simply are not remembered */
  }
}

export function withOpened(opened: Set<string>, id: string): Set<string> {
  const next = new Set(opened);
  next.delete(id);
  next.add(id); // newest last, so the cap keeps the most recent
  return next;
}

/** How many scrolls on the shelves still have their seal. */
export function unopenedCount(documents: DocumentSummary[], opened: Set<string>): number {
  return documents.filter((d) => !opened.has(d.id)).length;
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
