import { glossaryEntries } from "./glossary";
import { METRIC_LABELS } from "./types";
import type { GameState } from "./types";

/**
 * The Codex (game mode G36, Sprint 28): the glossary terms that already appear on YOUR realm are
 * shown as plates; the rest wait, with a note on when they will appear. Purely a reading aid: the
 * text is the glossary's own, nothing is granted for unlocking a plate, and a plate stays unlocked
 * on this browser once it has appeared (per browser, like the opened scrolls: decision D4).
 */

export const CODEX_VERSION = "codex-v1";
export const CODEX_KEY = "aladdin-codex-seen";

interface CodexTerm {
  id: string;
  /** Short note shown on a plate that has not appeared yet. */
  hint: string;
  appears: (s: GameState) => boolean;
}

const hasLand = (s: GameState) => s.towers.some((t) => t.margin_of_safety_pct !== null);

export const CODEX_TERMS: ReadonlyArray<CodexTerm> = [
  { id: "marginOfSafety", hint: "when a tower has a stored margin of safety", appears: hasLand },
  { id: "bearBaseBull", hint: "when a tower has a stored valuation range", appears: hasLand },
  { id: "dcf", hint: "when a tower has a stored valuation", appears: hasLand },
  { id: "verdict", hint: "when a tower has an analyst verdict", appears: (s) => s.towers.some((t) => t.verdict_rating !== null) },
  {
    id: "thesisTripwire",
    hint: "when a tower has an analysed thesis",
    appears: (s) =>
      s.towers.some((t) => t.thesis === "intact" || t.thesis === "review" || t.thesis === "breached" || t.tripwires_fired > 0),
  },
  { id: "correlation", hint: "when two towers share a wall", appears: (s) => s.towers.some((t) => t.shared_wall_with.length > 0) },
  {
    id: "concentrationCluster",
    hint: "when two towers share a wall",
    appears: (s) => s.towers.some((t) => t.shared_wall_with.length > 0),
  },
  { id: "stressScenario", hint: "when the Siege has a stored stress result", appears: (s) => s.siege?.portfolio_shock_pct != null },
  { id: "macroRegime", hint: "when the weather shows a macro regime", appears: (s) => Boolean(s.siege?.regime) },
];

export interface CodexPlate {
  id: string;
  title: string;
  text: string;
  hint: string;
  unlocked: boolean;
}

/** Plates in A to Z order. A plate is unlocked when it appears now or was seen before on this browser. */
export function codexPlates(state: GameState | null, seen: ReadonlySet<string>): CodexPlate[] {
  const entries = new Map(glossaryEntries(METRIC_LABELS).map((e) => [e.id, e]));
  const plates: CodexPlate[] = [];
  for (const term of CODEX_TERMS) {
    const entry = entries.get(term.id);
    if (!entry) continue;
    plates.push({
      id: term.id,
      title: entry.title,
      text: entry.text,
      hint: term.hint,
      unlocked: seen.has(term.id) || (state !== null && term.appears(state)),
    });
  }
  return plates.sort((a, b) => a.title.localeCompare(b.title));
}

/** Ids that should be remembered after this render. */
export function seenAfter(plates: CodexPlate[], seen: ReadonlySet<string>): Set<string> {
  const next = new Set(seen);
  for (const p of plates) if (p.unlocked) next.add(p.id);
  return next;
}

export function loadSeen(storage: Pick<Storage, "getItem"> | null = safeStorage()): Set<string> {
  try {
    const raw = storage?.getItem(CODEX_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function saveSeen(seen: Set<string>, storage: Pick<Storage, "setItem"> | null = safeStorage()): void {
  try {
    storage?.setItem(CODEX_KEY, JSON.stringify([...seen]));
  } catch {
    /* storage unavailable: the plates simply are not remembered */
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
