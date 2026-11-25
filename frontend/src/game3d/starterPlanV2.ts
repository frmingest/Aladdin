/**
 * The starter level's rules, version 2 (2026-11-25; #477, build step 2 is #494). Pure: no three.js, no React, no network.
 * Spec: `docs/game/game3d-starter-level-spec-2026-11-22.md` sections 3 and 4.
 *
 * Why a new version: build step 1's `starterPlanV1.ts` is on main and has been shown. Beats 3 and 4 change two of its rules
 * (what the goal strip says once the tower stands, and which saved picks a load keeps), so they live here and V1 is left as
 * it was (CLAUDE.md rule 3). Everything V1 got right that does not change is imported from it, not copied.
 *
 * What it adds: the two check beats (knock on the walls, fill the moat), each with three choices, the "two misses" rule and
 * the Book of Wisdom's unlock-once rule. It saves under the same key (`aladdin.game3d.starter.v1`) in the same shape: the
 * run's picks just gain the choices tried at each check. Nothing about the practice ever goes to the server.
 */
import { PIP, practiceTiers } from "./practiceCompanyV1";
import type { PracticeWall } from "./practiceCompanyV1";
import { BEATS, FRESH_RUN, PAGES, STARTER_KEY, saveStarter as saveStarterV1 } from "./starterPlanV1";
import type { Beat, PageId, StarterSaved as StarterSavedV1 } from "./starterPlanV1";

export { ARRIVAL_MS, BEATS, PAGES, PICKED_LINE_MS, STARTER_KEY } from "./starterPlanV1";
export type { Beat, PageId } from "./starterPlanV1";

/** The two checks this build plays. Each beat's choices are listed in the order the card shows them. */
export const WALL_CHOICES = ["granite", "timber", "rotted"] as const;
export const MOAT_CHOICES = ["recipe", "sign", "cheap"] as const;
export type WallChoice = (typeof WALL_CHOICES)[number];
export type MoatChoice = (typeof MOAT_CHOICES)[number];
export type CheckBeat = "walls" | "moat";

/** The moat choice that is the real reason Pip's has a moat (its secret recipe). The other two anyone can copy. */
const MOAT_RIGHT_FOR: Record<typeof PIP.moat, MoatChoice> = { narrow: "recipe" };

/**
 * Each check: its choices, the right one, the page it unlocks and the beat after it. The right answers are not typed in by
 * hand: the walls come from the real v1 rule over Pip's numbers (`practiceTiers`), the moat from Pip's own reason, so the
 * practice can never mark an answer right that the real fortress would not give.
 */
export const CHECKS = {
  walls: { choices: WALL_CHOICES, right: practiceTiers().wall as WallChoice, page: "walls", next: "moat" },
  moat: { choices: MOAT_CHOICES, right: MOAT_RIGHT_FOR[PIP.moat], page: "moat", next: "price" },
} as const satisfies Record<CheckBeat, { choices: readonly string[]; right: string; page: PageId; next: Beat }>;

/** A wrong pick costs a try; after this many the right answer is shown and the beat moves on without its page. */
export const MAX_MISSES = 2;

export interface StarterRun {
  beat: Beat;
  /** What the player picked: the company, then the choices tried at each check, in order. */
  picks: { company?: "pip"; walls?: WallChoice[]; moat?: MoatChoice[] };
}

export interface StarterSaved extends Omit<StarterSavedV1, "run"> {
  run: StarterRun;
}

export function emptyStarter(): StarterSaved {
  return { pages: [], finished: false, skipped: false, run: { ...FRESH_RUN, picks: {} } };
}

const isBeat = (v: unknown): v is Beat => typeof v === "string" && (BEATS as readonly string[]).includes(v);
const isPage = (v: unknown): v is PageId => typeof v === "string" && (PAGES as readonly string[]).includes(v);
const beatIndex = (b: Beat): number => BEATS.indexOf(b);

/** The tries at one check, kept only if each is a real choice, each at most once, and they stop at the first right one. */
function cleanTries<C extends string>(raw: unknown, choices: readonly C[], right: C): C[] {
  if (!Array.isArray(raw)) return [];
  const out: C[] = [];
  for (const v of raw) {
    if (typeof v !== "string" || !(choices as readonly string[]).includes(v) || out.includes(v as C)) continue;
    out.push(v as C);
    if (v === right || out.length >= MAX_MISSES) break;
  }
  return out;
}

/** Is this check over: right, or two misses? */
export function checkDone(run: StarterRun, beat: CheckBeat): boolean {
  const tries: readonly string[] = run.picks[beat] ?? [];
  return tries.includes(CHECKS[beat].right) || tries.length >= MAX_MISSES;
}

/** The choices still on the card: a choice you already tried is taken off, so a second try never repeats the first. */
export function choicesLeft(run: StarterRun, beat: "walls"): WallChoice[];
export function choicesLeft(run: StarterRun, beat: "moat"): MoatChoice[];
export function choicesLeft(run: StarterRun, beat: CheckBeat): string[] {
  const tried: readonly string[] = run.picks[beat] ?? [];
  return (CHECKS[beat].choices as readonly string[]).filter((c) => !tried.includes(c));
}

/** The wrong choice tried last at this check, if the check is still open (its hint is on the card). */
export function lastMiss(run: StarterRun, beat: CheckBeat): string | null {
  if (checkDone(run, beat)) return null;
  const tries: readonly string[] = run.picks[beat] ?? [];
  return tries.length > 0 ? tries[tries.length - 1] : null;
}

/** Reads a stored value; anything damaged is dropped, so a broken save is a fresh start, never an error. */
export function parseStarter(raw: string | null): StarterSaved {
  if (!raw) return emptyStarter();
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return emptyStarter();
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return emptyStarter();
  const o = v as Record<string, unknown>;
  const run = (o.run && typeof o.run === "object" ? o.run : {}) as Record<string, unknown>;
  const picks = (run.picks && typeof run.picks === "object" ? run.picks : {}) as Record<string, unknown>;
  const out: StarterSaved = {
    pages: Array.isArray(o.pages) ? [...new Set(o.pages.filter(isPage))] : [],
    finished: o.finished === true,
    skipped: o.skipped === true,
    run: { beat: isBeat(run.beat) ? run.beat : "arrive", picks: {} },
  };
  if (o.status === "new" || o.status === "veteran") out.status = o.status;
  if (picks.company === "pip") out.run.picks.company = "pip";
  const walls = cleanTries(picks.walls, WALL_CHOICES, CHECKS.walls.right);
  const moat = cleanTries(picks.moat, MOAT_CHOICES, CHECKS.moat.right);
  if (walls.length) out.run.picks.walls = walls;
  if (moat.length) out.run.picks.moat = moat;
  return settle(out);
}

/**
 * Makes a run drawable honestly: no beat past the pick without a company, no beat past a check that is not done, and a done
 * check always moves on. A run that breaks one of these goes back to the first step it can stand on, never forward.
 */
function settle(s: StarterSaved): StarterSaved {
  const r = s.run;
  if (r.picks.company !== "pip") return r.beat === "arrive" || r.beat === "pick" ? { ...s, run: { beat: r.beat, picks: {} } } : { ...s, run: { ...FRESH_RUN, picks: {} } };
  // Past the pick: walk the checks in order and stop at the first one still open.
  const picks = { ...r.picks };
  let beat: Beat = r.beat === "arrive" || r.beat === "pick" ? "walls" : r.beat;
  for (const check of ["walls", "moat"] as const) {
    const done = checkDone({ beat, picks }, check);
    if (!done) {
      if (beatIndex(beat) > beatIndex(check)) beat = check;
      if (beat === check) {
        // Anything picked at a later check cannot have happened yet.
        if (check === "walls") delete picks.moat;
        return { ...s, run: { beat, picks } };
      }
    } else if (beat === check) {
      beat = CHECKS[check].next;
    }
  }
  // This build plays up to the price beat: a later beat saved by hand reads as the price beat.
  if (beatIndex(beat) > beatIndex("price")) beat = "price";
  return { ...s, run: { beat, picks } };
}

export function loadStarter(storage: Pick<Storage, "getItem"> | null): StarterSaved {
  try {
    return parseStarter(storage?.getItem(STARTER_KEY) ?? null);
  } catch {
    return emptyStarter();
  }
}

/** Writes the one key (V1's writer: same key, same shape). Blocked storage is not an error. */
export function saveStarter(storage: Pick<Storage, "setItem"> | null, saved: StarterSaved): boolean {
  return saveStarterV1(storage, saved);
}

/** Beat 1 is over: the arrival plate goes and Sal's card opens. */
export function arrived(s: StarterSaved): StarterSaved {
  return s.run.beat === "arrive" ? { ...s, run: { ...s.run, beat: "pick" } } : s;
}

/** Beat 2: picking Pip's Lemonade raises the tower. Picking again does nothing. */
export function pickCompany(s: StarterSaved): StarterSaved {
  if (s.run.beat !== "arrive" && s.run.beat !== "pick") return s;
  return { ...s, run: { beat: "walls", picks: { ...s.run.picks, company: "pip" } } };
}

export function towerStands(run: StarterRun): boolean {
  return run.picks.company === "pip";
}

export function counterWaiting(run: StarterRun): boolean {
  return run.beat === "arrive" || run.beat === "pick";
}

/** The check card waiting for an answer now, if any. */
export function checkWaiting(run: StarterRun): CheckBeat | null {
  return (run.beat === "walls" || run.beat === "moat") && towerStands(run) && !checkDone(run, run.beat) ? run.beat : null;
}

/** What happened when a choice was picked, for the card and the result plate. */
export type CheckOutcome =
  /** Not this beat's card, or a choice already tried: nothing happens. */
  | { kind: "ignored" }
  /** Wrong, with a try left: the hint shows and the card stays. */
  | { kind: "miss" }
  /**
   * The check is over: right (`right: true`), or the second miss showed the right answer. `page` says what the Book did:
   * `new` (unlocked now), `held` (already in the book: no plate, no cheer), `locked` (two misses: play again to earn it).
   */
  | { kind: "done"; right: boolean; page: "new" | "held" | "locked" };

/**
 * One pick at a check card. A right answer on the first or second try unlocks the beat's page, once; after two misses the
 * world still changes and the beat moves on, but the page stays locked. Pages only ever gain an id; nothing is counted.
 */
export function answerCheck(s: StarterSaved, beat: CheckBeat, choice: string): { saved: StarterSaved; outcome: CheckOutcome } {
  const check = CHECKS[beat];
  const tries: readonly string[] = s.run.picks[beat] ?? [];
  if (checkWaiting(s.run) !== beat || !(check.choices as readonly string[]).includes(choice) || tries.includes(choice)) {
    return { saved: s, outcome: { kind: "ignored" } };
  }
  const nextTries = [...tries, choice];
  const picks = { ...s.run.picks, [beat]: nextTries } as StarterRun["picks"];
  const right = choice === check.right;
  if (!right && nextTries.length < MAX_MISSES) return { saved: { ...s, run: { ...s.run, picks } }, outcome: { kind: "miss" } };
  const held = s.pages.includes(check.page);
  const earns = right && !held;
  const saved: StarterSaved = {
    ...s,
    pages: earns ? [...s.pages, check.page] : s.pages,
    run: { beat: check.next, picks },
  };
  return { saved, outcome: { kind: "done", right, page: held ? "held" : right ? "new" : "locked" } };
}

/** The walls the tower shows: fog until the walls check is over, then what the real rule makes of Pip's numbers. */
export function wallsOf(run: StarterRun): PracticeWall {
  return towerStands(run) && checkDone(run, "walls") ? practiceTiers().wall : "unsurveyed";
}

/** The moat: mist until the moat check is over, then Pip's narrow moat. */
export function moatOf(run: StarterRun): typeof PIP.moat | "unsurveyed" {
  return towerStands(run) && checkDone(run, "moat") ? PIP.moat : "unsurveyed";
}

/** The four fact cards on the plank by the tower stand once the tower does. */
export function factCardsShown(run: StarterRun): boolean {
  return towerStands(run);
}

/** The goal strip's line. */
export type Goal = "build" | "walls" | "moat" | "price";
export function goalOf(run: StarterRun): Goal {
  if (!towerStands(run)) return "build";
  if (!checkDone(run, "walls")) return "walls";
  if (!checkDone(run, "moat")) return "moat";
  return "price";
}

/** The Plain view's rows that have been looked at. The walls and the moat only once their check is over (no free answer). */
export function plainSeen(run: StarterRun): { company: boolean; pieces: boolean; leftOver: boolean; owes: boolean; walls: boolean; moat: boolean } {
  const picked = towerStands(run);
  return {
    company: picked,
    pieces: picked,
    leftOver: factCardsShown(run),
    owes: factCardsShown(run),
    walls: wallsOf(run) !== "unsurveyed",
    moat: moatOf(run) !== "unsurveyed",
  };
}

/** The Book is offered outside the yard (first Quests card) once the player has been in the yard far enough to build. */
export function bookOffered(s: StarterSaved): boolean {
  return towerStands(s.run) || s.pages.length > 0;
}

/** How long a check's result plate stays before the next station's card opens by itself. */
export const RESULT_MS = 5500;
