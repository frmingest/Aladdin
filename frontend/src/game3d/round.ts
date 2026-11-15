/**
 * Today's round, step 3 of the Morning Round (#412). Pure data and maths, no React and no three.js.
 *
 * The round is the marks (`marks.ts`) written as a short list: at most seven stops, most urgent first (smoke, bell, raven,
 * stall, notice), one line each in game voice. A stop is ticked only when the player did the thing at the spot (read the
 * raven, pressed "I have looked" on the wire, opened the thesis, looked at the stall); the page records that, walking past
 * never does. "Since last visit" is kept in this browser only (no database), like the Guide quests.
 *
 * The rule that must not break (marks spec section 3): "All quiet" is said ONLY when every source in `marks.sources` is
 * "read" and nothing is open. An unread source says so ("The watch did not report in"), never calm. A first visit has no
 * "since". Nothing here reads the clock or computes a financial value: `nowMs` is passed in.
 */
import { splitRavens } from "../lib/ravens";
import type { Ravens, Standing } from "../lib/types";
import type { HoldingMarks, MarkKind, MarkSource, SourceState } from "./marks";
import { ROUND_MAX_WORDS, ROUND_WORDS, UNREAD_LINE, WEEKDAYS, quietLine } from "./roundWordsV1";
import type { TowerView } from "./stateToWorld";

export const MAX_STOPS = 7;
/** Most ticked ids kept in the browser. */
export const MAX_DONE = 200;

export type StopKind = "smoke" | "bell" | "raven" | "stall" | "notice";
/** Most urgent first. The five kinds of the marks, in the order the round lists them. */
export const STOP_ORDER: readonly StopKind[] = ["smoke", "bell", "raven", "stall", "notice"];

export interface Stop {
  id: string;
  kind: StopKind;
  holdingId: string | null;
  /** The id of the fact (raven id, wire id, frame day) so a new fact is a new stop. Null for a standing condition. */
  factId: string | null;
  text: string;
  /** The holding has no room in the yard: still a stop, but there is no walk target. */
  offYard: boolean;
  done: boolean;
}

export interface RoundFacts {
  towers: readonly TowerView[];
  marks: HoldingMarks;
  /** Holding id to the id of its newest unseen recent raven (`ravenFactIds`). */
  ravenFacts: ReadonlyMap<string, string>;
  /** Holding id to the lowest id of its unseen fired wires (`wireFactIds`). */
  wireFacts: ReadonlyMap<string, string>;
  /** Stalls in your range with a fresh price. */
  lit: readonly { holdingId: string; ticker: string }[];
  /** Holding id to a name, for facts about a company with no tower. */
  names?: ReadonlyMap<string, string>;
  noticeSheets: number;
  /** The Night Watch's newest frame day; the notice is a new fact when it changes. */
  noticeDay: string | null;
}

export interface RoundMemory {
  done: ReadonlySet<string>;
  /** When you were last here, or null on a first visit. */
  since: number | null;
  nowMs: number;
}

export interface Round {
  stops: Stop[];
  /** Stops past the seventh. */
  more: number;
  moreLine: string | null;
  /** Stops not yet done (all of them, including past the seventh). */
  open: number;
  /** True only for the quiet day: every source read and nothing at all to do. */
  quiet: boolean;
  /** The one line under the list: the quiet line, the round-done line, or the first unread source. Null when there is none. */
  line: string | null;
}

export const stopId = (kind: StopKind, holdingId: string | null, factId: string | null): string =>
  `${kind}:${holdingId ?? ""}:${factId ?? ""}`;

// --- Fact ids -----------------------------------------------------------------------------------------------------------
/** Holding id to the id of its newest unseen raven that landed in the last 48 h. Empty when the ravens were not read. */
export function ravenFactIds(ravens: Ravens | null | undefined, seen: Set<string>): Map<string, string> {
  const out = new Map<string, string>();
  if (!ravens) return out;
  for (const r of splitRavens(ravens.ravens, seen, ravens.as_of, "all").recent) if (!out.has(r.holding_id)) out.set(r.holding_id, r.id);
  return out;
}

/** Holding id to the lowest id of its unseen wires. Wires with no holding id make no stop here (nothing to point at). */
export function wireFactIds(standing: Standing | null | undefined, failed: boolean): Map<string, string> {
  const out = new Map<string, string>();
  if (!standing || failed || !standing.wires) return out;
  for (const w of standing.wires) {
    if (!w.holding_id) continue;
    const cur = out.get(w.holding_id);
    if (cur === undefined || w.tripwire_id < cur) out.set(w.holding_id, w.tripwire_id);
  }
  return out;
}

// --- Words ----------------------------------------------------------------------------------------------------------------
const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** The line, kept to six words: the name if it fits, else the ticker, else the plainest fallback. */
function fit(make: (n: string) => string, name: string, ticker: string | null): string {
  const a = make(name.trim());
  if (wordCount(a) <= ROUND_MAX_WORDS) return a;
  const b = ticker ? make(ticker.trim()) : a;
  return wordCount(b) <= ROUND_MAX_WORDS ? b : make(name.trim().split(/\s+/)[0] ?? name);
}

// --- Building the round -----------------------------------------------------------------------------------------------
export function buildRound(facts: RoundFacts, memory: RoundMemory, carry: readonly Stop[] = []): Round {
  const towerOf = new Map(facts.towers.map((t) => [t.holdingId, t]));
  const nameOf = (id: string): { name: string; ticker: string | null } => {
    const t = towerOf.get(id);
    if (t) return { name: t.name, ticker: t.ticker };
    return { name: facts.names?.get(id) ?? ROUND_WORDS.someone, ticker: null };
  };
  const offYardOf = (id: string) => facts.marks.byHolding.get(id)?.yard !== true;
  const made: Stop[] = [];
  const add = (kind: StopKind, holdingId: string | null, factId: string | null, text: string, offYard: boolean) => {
    const id = stopId(kind, holdingId, factId);
    made.push({ id, kind, holdingId, factId, text, offYard, done: memory.done.has(id) });
  };

  // Marks on holdings: from the marks (so the round and the world can never disagree), then facts with no tower.
  const ids = new Set<string>([...facts.marks.byHolding.keys(), ...facts.marks.offYard.map((o) => o.holdingId)]);
  for (const id of [...ids].sort()) {
    const m = facts.marks.byHolding.get(id);
    const stray = facts.marks.offYard.find((o) => o.holdingId === id);
    const has = (k: MarkKind) => (m ? m[k as "raven" | "smoke" | "bell"] : stray?.kinds.includes(k)) === true;
    const { name, ticker } = nameOf(id);
    const off = offYardOf(id);
    if (has("smoke")) add("smoke", id, facts.wireFacts.get(id) ?? null, fit(ROUND_WORDS.smoke, name, ticker), off);
    if (has("bell")) add("bell", id, null, fit(ROUND_WORDS.bell, name, ticker), off);
    if (has("raven")) add("raven", id, facts.ravenFacts.get(id) ?? null, fit(ROUND_WORDS.raven, name, ticker), off);
  }
  for (const s of [...facts.lit].sort((a, b) => a.holdingId.localeCompare(b.holdingId))) {
    add("stall", s.holdingId, null, fit(ROUND_WORDS.lamp, s.ticker, null), false);
  }
  if (facts.noticeSheets > 0) add("notice", null, facts.noticeDay, ROUND_WORDS.notice, false);

  // A stop you dealt with this visit whose fact has since left (a wire you looked at): keep it ticked, never open.
  const have = new Set(made.map((s) => s.id));
  for (const c of carry) if (c.done && !have.has(c.id)) made.push({ ...c, done: true });

  const rank = (s: Stop) => STOP_ORDER.indexOf(s.kind);
  const all = made
    .map((s, i) => ({ s, i }))
    .sort((a, b) => Number(a.s.done) - Number(b.s.done) || rank(a.s) - rank(b.s) || a.i - b.i)
    .map((x) => x.s);
  const open = all.filter((s) => !s.done).length;
  const more = Math.max(0, all.length - MAX_STOPS);

  const unread = (Object.keys(UNREAD_LINE) as MarkSource[]).filter((k) => facts.marks.sources[k] === ("unread" as SourceState));
  const quiet = unread.length === 0 && all.length === 0 && facts.towers.length > 0;
  let line: string | null = null;
  if (quiet) {
    const sameDay = memory.since !== null && localDay(memory.since) === localDay(memory.nowMs);
    line = quietLine(memory.since === null ? null : sinceWords(memory.since, memory.nowMs), sameDay);
  } else if (unread.length > 0) {
    line = UNREAD_LINE[unread[0]];
  } else if (all.length > 0 && open === 0) {
    line = ROUND_WORDS.allDone;
  }
  return { stops: all.slice(0, MAX_STOPS), more, moreLine: more > 0 ? ROUND_WORDS.more(more) : null, open, quiet, line };
}

const localDay = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/** "Tuesday" for the last six days, "last week" past that. The weekday is the player's own local day. */
function sinceWords(since: number, nowMs: number): string {
  if (nowMs - since > 6 * 86_400_000) return "last week";
  return WEEKDAYS[new Date(since).getDay()];
}

// --- Remembering (this browser only) ------------------------------------------------------------------------------------
export const ROUND_STORAGE_KEY = "aladdin.game3d.round.v1";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export interface RoundSaved {
  lastVisit: number | null;
  /** Stop ids dealt with. */
  done: string[];
}

export const EMPTY_ROUND: RoundSaved = { lastVisit: null, done: [] };

/** Reads what was saved; anything missing, damaged or from somewhere else is a fresh start. */
export function loadRound(storage: StorageLike | null): RoundSaved {
  try {
    const raw = storage?.getItem(ROUND_STORAGE_KEY);
    if (!raw) return EMPTY_ROUND;
    const j = JSON.parse(raw) as Partial<RoundSaved> | null;
    if (!j || typeof j !== "object") return EMPTY_ROUND;
    return {
      lastVisit: typeof j.lastVisit === "number" && Number.isFinite(j.lastVisit) ? j.lastVisit : null,
      done: Array.isArray(j.done) ? j.done.filter((d): d is string => typeof d === "string").slice(-MAX_DONE) : [],
    };
  } catch {
    return EMPTY_ROUND;
  }
}

export function saveRound(storage: StorageLike | null, saved: RoundSaved): void {
  try {
    storage?.setItem(ROUND_STORAGE_KEY, JSON.stringify(saved));
  } catch {
    /* private mode or full: the round simply does not remember */
  }
}

const SOURCE_OF: Record<StopKind, MarkSource> = { smoke: "wires", bell: "thesis", raven: "ravens", stall: "stalls", notice: "watch" };

/**
 * What to keep. A standing condition (bell, stall) or a notice that is gone while its source was read is no longer true, so
 * its tick goes: if it comes back it is new. Raven and wire ids are unique facts, so they stay (capped, newest kept).
 */
export function pruneDone(done: readonly string[], stops: readonly Stop[], sources: Record<MarkSource, SourceState>): string[] {
  const here = new Set(stops.map((s) => s.id));
  const kept = done.filter((id) => {
    const kind = id.split(":")[0] as StopKind;
    if (kind === "raven" || kind === "smoke") return true;
    if (here.has(id)) return true;
    return sources[SOURCE_OF[kind]] !== "read";
  });
  return kept.slice(-MAX_DONE);
}
