/**
 * The Morning Round, step 2: the marks (#412). Pure data and maths, no three.js and no React.
 *
 * Five stored facts, one shape each, standing where the fact belongs. The rule that must not break: a source that did not
 * report gives NO mark and sets its flag to "unread". An absent mark never means "quiet". This file never writes "quiet",
 * "all clear" or "nothing to do"; step 3 may say "All quiet" only when every source is "read" and empty (`sources`).
 *
 * Nothing here computes a financial value: it only maps flags the backend already decided (a raven landed, a wire fired
 * and is unseen, thesis is "review", the price is in your range, the Night Watch listed changes) to shapes. Nothing reads
 * the clock: `nowMs` is passed in, so the same facts always give the same marks.
 */
import { splitRavens } from "../lib/ravens";
import type { NightWatch, NightWatchState, Ravens, Standing, WatchlistRow } from "../lib/types";
import { MARK_WORDS } from "./marksWordsV1";
import type { Spot } from "./layout";
import type { TowerView } from "./stateToWorld";

// --- Decided defaults (Faiz's two questions; defaults kept, change here and nowhere else) ----------------------------
/** A price counts as fresh for this many calendar days (a weekend plus a holiday). Older: the stall stays dark. */
export const PRICE_FRESH_DAYS = 5;
/** The bell rings for thesis "review" only. One meaning per mark; a look-back that is owed may ring it later. */
export const BELL_THESIS = "review" as const;
/** The Night Watch notice counts while its newest frame is no older than this. */
export const NOTICE_FRESH_DAYS = 2;
/** At most this many sheets on the Watch Post. */
export const NOTICE_MAX_SHEETS = 3;

export type MarkKind = "raven" | "smoke" | "bell" | "lamp" | "notice";
export type MarkSource = "ravens" | "wires" | "thesis" | "stalls" | "watch";
export type SourceState = "read" | "unread";

export interface MarkSpec {
  kind: MarkKind;
  where: string;
  /** The silhouette id. Five marks, five different shapes: colour only helps. */
  shape: string;
  motion: string;
  /** What the mark looks like when its source did not report. */
  unknown: "absent";
}

/** fact -> {kind, where, shape, motion, unknown}, the table of the spec as data. */
export const MARK_SPECS: Record<MarkKind, MarkSpec> = {
  raven: { kind: "raven", where: "over the building", shape: "bird-wings-out", motion: "circles", unknown: "absent" },
  smoke: { kind: "smoke", where: "behind the roof", shape: "tall-thin-column", motion: "rises", unknown: "absent" },
  bell: { kind: "bell", where: "beside the door", shape: "bell-on-post", motion: "swings", unknown: "absent" },
  lamp: { kind: "lamp", where: "on the stall", shape: "hanging-lamp", motion: "flickers", unknown: "absent" },
  notice: { kind: "notice", where: "on the watch post", shape: "pinned-sheets", motion: "none", unknown: "absent" },
};

const DAY_MS = 86_400_000;

/** Whole calendar days (UTC) from `iso` to `nowMs`. NaN when `iso` is missing or junk: unknown, never "fresh". */
export function daysOld(iso: string | null | undefined, nowMs: number): number {
  if (!iso) return NaN;
  const t = Date.parse(iso);
  if (Number.isNaN(t) || !Number.isFinite(nowMs)) return NaN;
  return Math.floor(nowMs / DAY_MS) - Math.floor(t / DAY_MS);
}

// --- Lit stall ------------------------------------------------------------------------------------------------------
/** Stalls in your range (`buy_zone`, the price you wrote down) with a price no older than PRICE_FRESH_DAYS. */
export function litStalls(rows: readonly WatchlistRow[] | null | undefined, nowMs: number): Set<string> {
  const lit = new Set<string>();
  for (const r of rows ?? []) {
    if (r.status !== "buy_zone") continue;
    const age = daysOld(r.price_as_of, nowMs);
    if (Number.isNaN(age) || age > PRICE_FRESH_DAYS || age < -1) continue;
    lit.add(r.holding_id);
  }
  return lit;
}

/** The lamp under the arch lights only when at least one stall is lit. */
export function archLit(lit: ReadonlySet<string>): boolean {
  return lit.size > 0;
}

/**
 * The watchlist source is "read" only when it answered and every row says something sure about its price. A row with no
 * target, no price, a mismatched currency or a stale price is not known to be out of range, so no calm can be drawn.
 */
export function stallsRead(rows: readonly WatchlistRow[] | null | undefined, nowMs: number): boolean {
  if (!rows) return false;
  return rows.every((r) => {
    if (r.status === "no_target" || r.status === "no_price" || r.status === "currency_mismatch") return false;
    const age = daysOld(r.price_as_of, nowMs);
    return !Number.isNaN(age) && age <= PRICE_FRESH_DAYS && age >= -1;
  });
}

// --- Notice ---------------------------------------------------------------------------------------------------------
/** 0..3 sheets: the Night Watch reported in, its newest frame is fresh, and it lists changes. Never "quiet" when 0. */
export function noticeSheets(watch: NightWatch | null | undefined, nowMs: number): 0 | 1 | 2 | 3 {
  if (!watch || watch.watch_state !== "ok") return 0;
  const age = daysOld(watch.last_frame_day, nowMs);
  if (Number.isNaN(age) || age > NOTICE_FRESH_DAYS) return 0;
  const n = watch.changes_since_last_frame?.length ?? 0;
  return Math.min(NOTICE_MAX_SHEETS, Math.max(0, n)) as 0 | 1 | 2 | 3;
}

// --- Source readers for the page (null = not read) -----------------------------------------------------------------
/** Holdings with a raven that landed in the last 48 hours and is not marked seen. Null when the ravens were not read. */
export function recentRavenIds(ravens: Ravens | null | undefined, seen: Set<string>): Set<string> | null {
  if (!ravens) return null;
  return new Set(splitRavens(ravens.ravens, seen, ravens.as_of, "all").recent.map((r) => r.holding_id));
}

/** Holdings with a fired wire not yet looked at, and how many wires could not be matched to a holding. */
export function unseenWireIds(
  standing: Standing | null | undefined,
  failed: boolean,
): { ids: Set<string> | null; unmatched: number } {
  if (!standing || failed || !standing.wires) return { ids: null, unmatched: 0 };
  const ids = new Set<string>();
  let unmatched = 0;
  for (const w of standing.wires) {
    if (w.holding_id) ids.add(w.holding_id);
    else unmatched += 1;
  }
  return { ids, unmatched };
}

// --- Per-holding marks ----------------------------------------------------------------------------------------------
export interface MarkFacts {
  recentRavenHoldingIds: ReadonlySet<string> | null;
  unseenWireHoldingIds: ReadonlySet<string> | null;
  /** Wires that fired but carry no holding id (older server): no smoke is drawn for them, and the source stays unread. */
  wiresUnmatched?: number;
  watchState?: NightWatchState | null;
  /** From `stallsRead`. */
  stallsRead?: boolean;
}

export interface HoldingMark {
  raven: boolean;
  smoke: boolean;
  bell: boolean;
  /** Stands in the yard. Off-yard holdings keep their facts for the Plain view but have no building to carry a mark. */
  yard: boolean;
}

export interface OffYard {
  holdingId: string;
  kinds: MarkKind[];
}

export interface HoldingMarks {
  byHolding: Map<string, HoldingMark>;
  sources: Record<MarkSource, SourceState>;
  offYard: OffYard[];
}

const ANALYSED = new Set(["intact", "review", "breached"]);

export function holdingMarks(towers: readonly TowerView[], facts: MarkFacts): HoldingMarks {
  const byHolding = new Map<string, HoldingMark>();
  const known = new Set<string>();
  const offYard: OffYard[] = [];
  for (const t of towers) {
    known.add(t.holdingId);
    const mark: HoldingMark = {
      raven: facts.recentRavenHoldingIds?.has(t.holdingId) ?? false,
      smoke: facts.unseenWireHoldingIds?.has(t.holdingId) ?? false,
      bell: t.facts.thesis === BELL_THESIS,
      yard: t.plot !== undefined,
    };
    byHolding.set(t.holdingId, mark);
    if (!mark.yard) {
      const kinds = kindsOf(mark);
      if (kinds.length > 0) offYard.push({ holdingId: t.holdingId, kinds });
    }
  }
  // Facts about a holding with no tower at all (a watchlist-only company): no building, so words only.
  const strays = new Map<string, MarkKind[]>();
  facts.recentRavenHoldingIds?.forEach((id) => !known.has(id) && strays.set(id, [...(strays.get(id) ?? []), "raven"]));
  facts.unseenWireHoldingIds?.forEach((id) => !known.has(id) && strays.set(id, [...(strays.get(id) ?? []), "smoke"]));
  strays.forEach((kinds, holdingId) => offYard.push({ holdingId, kinds }));
  offYard.sort((a, b) => a.holdingId.localeCompare(b.holdingId));

  const sources: Record<MarkSource, SourceState> = {
    ravens: facts.recentRavenHoldingIds !== null ? "read" : "unread",
    wires:
      facts.unseenWireHoldingIds !== null && (facts.wiresUnmatched ?? 0) === 0 && facts.watchState !== "never" && facts.watchState !== "old"
        ? "read"
        : "unread",
    thesis: towers.length > 0 && towers.every((t) => ANALYSED.has(t.facts.thesis)) ? "read" : "unread",
    stalls: facts.stallsRead ? "read" : "unread",
    watch: facts.watchState === "ok" ? "read" : "unread",
  };
  return { byHolding, sources, offYard };
}

export function kindsOf(m: Pick<HoldingMark, "raven" | "smoke" | "bell">): MarkKind[] {
  const out: MarkKind[] = [];
  if (m.raven) out.push("raven");
  if (m.smoke) out.push("smoke");
  if (m.bell) out.push("bell");
  return out;
}

/** True when any source did not report. The Plain view says so once; a mark never implies the rest is quiet. */
export function anyUnread(marks: HoldingMarks): boolean {
  return Object.values(marks.sources).some((s) => s === "unread");
}

/**
 * The Plain view's "Marks" lines for one holding, in words: what stands, plus the lit stall when it is in range. When
 * something stands and any source is unread, "Not reported" is appended, so a raven never implies the rest is quiet. A
 * holding with nothing standing gets no line (the panel says "Not reported" once for everyone).
 */
export function plainMarkLines(t: TowerView, marks: HoldingMarks, lit?: ReadonlySet<string>): string[] {
  const m = marks.byHolding.get(t.holdingId);
  const lines: string[] = [];
  if (m?.raven) lines.push(MARK_WORDS.raven);
  if (m?.smoke) lines.push(MARK_WORDS.smoke);
  if (m?.bell) lines.push(MARK_WORDS.bell);
  if (lit?.has(t.holdingId)) lines.push(MARK_WORDS.lamp);
  if (lines.length > 0 && anyUnread(marks)) lines.push(MARK_WORDS.unread);
  return lines;
}

// --- Where each mark stands ------------------------------------------------------------------------------------------
/** Fixed heights, estimated from the building models and not measured: a look decides, nudge here. */
export const RAVEN_HEIGHT = 9;
export const RAVEN_MAX_RADIUS = 2.4;
export const SMOKE_BASE_HEIGHT = 4.2;
/** How far behind the middle of the plot the smoke rises, as a share of the footprint. */
export const SMOKE_BACK = 0.35;
/** The bell stands this far to the side of the door point. */
export const BELL_SIDE = 1.8;
/** The bell post keeps at least this far from every door point (its own too): it can never block a door. */
export const BELL_CLEAR = 1.5;

export interface MarkAnchor {
  raven: { x: number; y: number; z: number; r: number };
  smoke: { x: number; y: number; z: number };
  bell: { x: number; z: number; yaw: number };
}

/** From the plot only (position, footprint, door): a mark never says anything about size, wall or moat. Null off-yard. */
export function markAnchor(t: Pick<TowerView, "spot" | "plot">): MarkAnchor | null {
  const p = t.plot;
  if (!p) return null;
  const s: Spot = t.spot;
  const bx = s.x - p.door.x;
  const bz = s.z - p.door.z;
  const len = Math.hypot(bx, bz) || 1;
  const back = p.footprint * SMOKE_BACK;
  return {
    raven: { x: s.x, y: RAVEN_HEIGHT, z: s.z, r: Math.min(RAVEN_MAX_RADIUS, p.footprint * 0.5) },
    smoke: { x: s.x + (bx / len) * back, y: SMOKE_BASE_HEIGHT, z: s.z + (bz / len) * back },
    bell: {
      x: p.door.x + Math.cos(p.doorYaw) * BELL_SIDE,
      z: p.door.z - Math.sin(p.doorYaw) * BELL_SIDE,
      yaw: p.doorYaw,
    },
  };
}

/** What the layer draws: one entry per kind per marked yard holding. Fixed order, so the same facts draw the same marks. */
export interface PlacedMarks {
  ravens: { id: string; x: number; y: number; z: number; r: number }[];
  smoke: { id: string; x: number; y: number; z: number }[];
  bells: { id: string; x: number; z: number; yaw: number }[];
}

export function placeMarks(towers: readonly TowerView[], marks: HoldingMarks): PlacedMarks {
  const out: PlacedMarks = { ravens: [], smoke: [], bells: [] };
  for (const t of towers) {
    const m = marks.byHolding.get(t.holdingId);
    const a = m?.yard ? markAnchor(t) : null;
    if (!m || !a) continue;
    if (m.raven) out.ravens.push({ id: t.holdingId, ...a.raven });
    if (m.smoke) out.smoke.push({ id: t.holdingId, ...a.smoke });
    if (m.bell) out.bells.push({ id: t.holdingId, ...a.bell });
  }
  return out;
}

export const NO_MARKS: PlacedMarks = { ravens: [], smoke: [], bells: [] };

// --- Lamps ------------------------------------------------------------------------------------------------------------
/** A lamp hangs at head height, just in front of its stall (the front faces the lane). Estimated, not measured. */
export const STALL_LAMP_HEIGHT = 2.0;
export const STALL_LAMP_FRONT = 0.9;
/** The one lamp under the arch, in the arch's own frame (in front of the awning). */
export const ARCH_LAMP = { x: 0, y: 3.0, z: 0.3 } as const;

/** Where the lit stalls' lamps hang, in the Quarter's frame, in stall order. */
export function stallLamps(
  stalls: readonly { holdingId: string; x: number; z: number; yaw: number }[],
  lit: ReadonlySet<string>,
): { x: number; y: number; z: number }[] {
  return stalls
    .filter((s) => lit.has(s.holdingId))
    .map((s) => ({
      x: s.x + Math.sin(s.yaw) * STALL_LAMP_FRONT,
      y: STALL_LAMP_HEIGHT,
      z: s.z + Math.cos(s.yaw) * STALL_LAMP_FRONT,
    }));
}
