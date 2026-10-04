import type { Raven, RavenDirection } from "./types";

/**
 * Pure helpers for the Ravens (game mode G15, Sprint 24). "Seen" is a per-browser view preference
 * kept in guarded localStorage (like the theme and the game-mode switch): it never touches the
 * backend and never changes a stored value. A raven is information, never a verdict.
 */

export const SEEN_KEY = "aladdin-ravens-seen";
export const MAX_SEEN = 500;

export const DIRECTION_LABEL: Record<RavenDirection, string> = {
  better: "Better",
  worse: "Worse",
  steady: "Steady",
  unknown: "Not comparable",
};

export const DIRECTION_CLASS: Record<RavenDirection, string> = {
  better: "text-positive",
  worse: "text-negative",
  steady: "text-ink-muted",
  unknown: "text-ink-faint",
};

/** Read the ids already seen. Never throws: blocked storage or junk reads as nothing seen. */
export function loadSeen(storage: Pick<Storage, "getItem"> | null = safeStorage()): Set<string> {
  try {
    const raw = storage?.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((v): v is string => typeof v === "string")) : new Set();
  } catch {
    return new Set();
  }
}

/** Save the seen ids, keeping the newest MAX_SEEN. Never throws. */
export function saveSeen(seen: Set<string>, storage: Pick<Storage, "setItem"> | null = safeStorage()): void {
  try {
    storage?.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-MAX_SEEN)));
  } catch {
    /* private window or full storage: the ravens simply show as new next time */
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function unseen(ravens: Raven[], seen: Set<string>): Raven[] {
  return ravens.filter((r) => !seen.has(r.id));
}

/** Holdings with a raven that has not been seen: the towers a raven sits on. */
export function ravenHoldingIds(ravens: Raven[], seen: Set<string>): Set<string> {
  return new Set(unseen(ravens, seen).map((r) => r.holding_id));
}

export function markSeen(seen: Set<string>, ids: string[]): Set<string> {
  const next = new Set(seen);
  ids.forEach((id) => next.add(id));
  return next;
}

export function ageText(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export function ravenHeading(r: Raven): string {
  if (r.kind === "text_only") return `${r.name}: a report was captured`;
  return r.period ? `${r.name}: ${r.period} captured` : `${r.name}: a report was captured`;
}

/** One line for a closed raven: counts for a figures raven, the summary otherwise. */
export function ravenOneLine(r: Raven): string {
  if (r.kind === "figures" && r.lines.length > 0) {
    return `${r.better} better, ${r.worse} worse of ${r.lines.length} measures${r.previous_period ? ` against ${r.previous_period}` : ""}.`;
  }
  return r.summary;
}
