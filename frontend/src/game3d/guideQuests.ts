/**
 * The Guide: five small quests that walk a new player through the courtyard (game3d, 2026-11-11).
 * Pure data and maths, no three.js and no React.
 *
 *   1 Meet the advisors   you talk to both Barren and Marlie
 *   2 Visit Sal's counter Barren sends you; you open Sal's counter
 *   3 Stock a stall       you pick a company off Sal's shelves (a stall now exists)
 *   4 See the weather     Marlie sends you; you walk into the Weather Tower
 *   5 Write your first why Barren sends you; one holding gets a why (the journal has it)
 *
 * Rules kept from the other quests: no XP, no reward, no streak, no buy or sell wording. "Level" is only how many of the
 * five are done in a row. Two steps read real facts (a stall exists, a why exists); the three "you went there" steps are
 * the only thing saved, and only in this browser. Unknown stays unknown: while a fact cannot be read the step stays open.
 *
 * "Replay" keeps what is on the street and in the journal, and asks for one more of each, so a person who already has
 * data can walk the guide again.
 */
import { BOOTHS } from "./boothPlan";
import { DESK } from "./desk";
import { NPCS } from "./npcs";
import type { NpcId } from "./npcs";
import { BUILDINGS, doorSpot } from "./townPlan";

export type GuideStepId = "meet" | "sal" | "stall" | "weather" | "why";

export const GUIDE_STEPS: readonly GuideStepId[] = ["meet", "sal", "stall", "weather", "why"];

/** Who hands a step over (mark over their head). "meet" and "stall" have no advisor giver: see `giverOf`. */
const ADVISOR_GIVER: Partial<Record<GuideStepId, NpcId>> = { sal: "oracle", weather: "partner", why: "oracle" };

export type GuideGiver = NpcId | "sal";

/** Who stands with the mark over their head for this step: Sal for the stall quest, an advisor otherwise. */
export function giverOf(step: GuideStepId): GuideGiver | null {
  if (step === "stall") return "sal";
  return ADVISOR_GIVER[step] ?? null;
}

/** What is saved, per browser. Nothing here is a fact about the portfolio. */
export interface GuideSaved {
  /** Advisors you have talked to. */
  met: NpcId[];
  /** Steps whose giver you have talked to (lights the place marker). */
  taken: GuideStepId[];
  salVisited: boolean;
  weatherVisited: boolean;
  /** Set by "replay": stalls and whys must rise above these numbers to count. Null: any one counts. */
  baseline: { stalls: number; whys: number } | null;
}

export const EMPTY_GUIDE: GuideSaved = { met: [], taken: [], salVisited: false, weatherVisited: false, baseline: null };

/** The two real facts. Null means unknown (loading, unreadable, or the sample fortress). */
export interface GuideFacts {
  stalls: number | null;
  whys: number | null;
}

export interface GuideStatus {
  /** How many of the five are done in a row, 0 to 5. */
  level: number;
  done: Record<GuideStepId, boolean>;
  /** The first step not done, or null when all five are. */
  current: GuideStepId | null;
}

export function stepDone(saved: GuideSaved, facts: GuideFacts, step: GuideStepId): boolean {
  switch (step) {
    case "meet":
      return saved.met.includes("oracle") && saved.met.includes("partner");
    case "sal":
      return saved.salVisited;
    case "stall":
      return facts.stalls !== null && facts.stalls > (saved.baseline?.stalls ?? 0);
    case "weather":
      return saved.weatherVisited;
    case "why":
      return facts.whys !== null && facts.whys > (saved.baseline?.whys ?? 0);
  }
}

export function guideStatus(saved: GuideSaved, facts: GuideFacts): GuideStatus {
  const done = {} as Record<GuideStepId, boolean>;
  let level = 0;
  let counting = true;
  for (const s of GUIDE_STEPS) {
    done[s] = stepDone(saved, facts, s);
    if (counting && done[s]) level += 1;
    else counting = false;
  }
  return { level, done, current: GUIDE_STEPS[level] ?? null };
}

/**
 * You talked to an advisor. They count as met, and if they are the giver of the step that is now current, that step is
 * taken. (The second advisor you meet may complete step 1 and hand over step 2 in the same talk.)
 */
export function onGuideTalk(saved: GuideSaved, facts: GuideFacts, npc: NpcId): GuideSaved {
  let next = saved;
  if (!next.met.includes(npc)) next = { ...next, met: [...next.met, npc] };
  const cur = guideStatus(next, facts).current;
  if (cur && giverOf(cur) === npc && !next.taken.includes(cur)) next = { ...next, taken: [...next.taken, cur] };
  return next;
}

export const markSalVisited = (s: GuideSaved): GuideSaved => (s.salVisited ? s : { ...s, salVisited: true });
export const markWeatherVisited = (s: GuideSaved): GuideSaved => (s.weatherVisited ? s : { ...s, weatherVisited: true });

/** Start the guide again, counting only what is added from now on. */
export function replayGuide(facts: GuideFacts): GuideSaved {
  return { ...EMPTY_GUIDE, baseline: { stalls: facts.stalls ?? 0, whys: facts.whys ?? 0 } };
}

/* ------------------------------------------------------------------------- */
/* Saving (this browser only).                                                */
/* ------------------------------------------------------------------------- */

export const GUIDE_STORAGE_KEY = "aladdin.game3d.guide.v1";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const isNpc = (v: unknown): v is NpcId => v === "oracle" || v === "partner";
const isStep = (v: unknown): v is GuideStepId => typeof v === "string" && (GUIDE_STEPS as readonly string[]).includes(v);

/** Reads what was saved; anything missing, damaged or from somewhere else is ignored (a fresh start). */
export function loadGuide(storage: StorageLike | null): GuideSaved {
  try {
    const raw = storage?.getItem(GUIDE_STORAGE_KEY);
    if (!raw) return EMPTY_GUIDE;
    const j = JSON.parse(raw) as Partial<GuideSaved> | null;
    if (!j || typeof j !== "object") return EMPTY_GUIDE;
    const b = j.baseline;
    const baseline =
      b && typeof b === "object" && Number.isFinite(b.stalls) && Number.isFinite(b.whys)
        ? { stalls: Math.max(0, Math.floor(b.stalls)), whys: Math.max(0, Math.floor(b.whys)) }
        : null;
    return {
      met: Array.isArray(j.met) ? j.met.filter(isNpc) : [],
      taken: Array.isArray(j.taken) ? j.taken.filter(isStep) : [],
      salVisited: j.salVisited === true,
      weatherVisited: j.weatherVisited === true,
      baseline,
    };
  } catch {
    return EMPTY_GUIDE;
  }
}

export function saveGuide(storage: StorageLike | null, saved: GuideSaved): void {
  try {
    storage?.setItem(GUIDE_STORAGE_KEY, JSON.stringify(saved));
  } catch {
    /* private mode or full: the guide simply does not remember */
  }
}

/* ------------------------------------------------------------------------- */
/* Where the marks float.                                                      */
/* ------------------------------------------------------------------------- */

export interface GuideMark {
  key: string;
  x: number;
  y: number;
  z: number;
  /** Bigger for far places, so a marker still reads from the gate. */
  size: number;
}

const SAL = BOOTHS.find((b) => b.id === "sal") ?? BOOTHS[0];
const WEATHER = BUILDINGS.find((b) => b.id === "weather") ?? BUILDINGS[0];

/** Over an advisor's head, above their name tag. */
function overNpc(id: NpcId): GuideMark {
  const n = NPCS.find((p) => p.id === id) ?? NPCS[0];
  return { key: `head-${id}`, x: n.x, y: n.height + 1.4, z: n.z, size: 1 };
}

/** Over Sal's roof. */
const overSal = (): GuideMark => ({ key: "sal", x: SAL.x, y: 4.1, z: SAL.z, size: 1 });

/**
 * The marks to show right now: a head mark over whoever hands the current step over, and, once that step is taken, a place
 * mark over where it leads. Nothing when all five are done.
 */
export function guideMarks(status: GuideStatus, saved: GuideSaved): GuideMark[] {
  const cur = status.current;
  if (!cur) return [];
  const taken = saved.taken.includes(cur);
  switch (cur) {
    case "meet":
      return NPCS.filter((n) => !saved.met.includes(n.id)).map((n) => overNpc(n.id));
    case "sal":
      return taken ? [overSal()] : [overNpc("oracle")];
    case "stall":
      return [overSal()];
    case "weather": {
      if (!taken) return [overNpc("partner")];
      const d = doorSpot(WEATHER);
      return [{ key: "weather", x: d.x, y: 5, z: d.z, size: 2.4 }];
    }
    case "why":
      return taken ? [{ key: "desk", x: DESK.x, y: 2.7, z: DESK.z, size: 1 }] : [overNpc("oracle")];
  }
}
