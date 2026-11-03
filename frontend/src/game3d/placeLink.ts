/**
 * Places as links (S22 PR 2): `/game3d?at=town`. A reload keeps you where you were, and QA can open any place directly.
 * Pure: it reads and writes a query string only. A broken link means the courtyard, never an error.
 */
import { AREAS, sameArea } from "./areas";
import type { AreaRef } from "./areas";

const KEY = "at";

/** The link value for a place: `courtyard`, `town`, `townhall`, `records` or `holding:<holdingId>`. */
export function placeToken(ref: AreaRef): string {
  return ref.id === "holding" ? `holding:${ref.holdingId}` : ref.id;
}

/** The place a token names, or the courtyard when it names nothing we know. */
export function parsePlace(token: string | null | undefined): AreaRef {
  if (!token) return { id: "courtyard" };
  // `library:<id>` was the name before S25 (F1): an old link still opens that holding's land, silently.
  for (const prefix of ["holding:", "library:"]) {
    if (token.startsWith(prefix)) {
      const holdingId = token.slice(prefix.length);
      return holdingId ? { id: "holding", holdingId } : { id: "courtyard" };
    }
  }
  if (token === "holding" || token === "library") return { id: "courtyard" };
  return token in AREAS ? ({ id: token } as AreaRef) : { id: "courtyard" };
}

/** The place in a query string such as `?at=town`. */
export function placeFromSearch(search: string): AreaRef {
  return parsePlace(new URLSearchParams(search).get(KEY));
}

/** The query string for a place; the courtyard has none, so the plain address stays plain. Other parameters stay. */
export function searchFor(ref: AreaRef, search = ""): string {
  const p = new URLSearchParams(search);
  if (sameArea(ref, { id: "courtyard" })) p.delete(KEY);
  else p.set(KEY, placeToken(ref));
  const out = p.toString();
  return out ? `?${out}` : "";
}
