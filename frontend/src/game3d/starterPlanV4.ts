/**
 * The starter level's rules, version 4 (2026-11-27; #477, build step 4 is #496). Pure: no three.js, no React, no network.
 * Spec: `docs/game/game3d-starter-level-spec-2026-11-22.md` sections 3 (beats 6b, 7 and 8), 4 and 5.
 *
 * Why a new version: `starterPlanV3.ts` is on main and has been shown. It stops every run at "Pin your why" and its storm's
 * right answer is fixed to the first storm ("Only the price"). This build plays the starter to the end, so V3 is left as it
 * was (CLAUDE.md rule 3). V3's walls, moat and price checks are the same here: imported, not copied.
 *
 * What changes:
 * - **The storm's right answer depends on the run** (beat 6b). The first run always gets the clean storm (only the price
 *   fell). Every run after "Play again" gets the second storm: the fridge broke, Pip's borrowed 10 coins, so it owes 15 and the
 *   walls go granite to brick by the v1 rule. Its right answer is "It owes more now". Both are worked out from Pip's numbers
 *   before and after (`stormChange`), never typed in. "Worse" is judged by what Pip's makes in a year, not by its worth (the
 *   worth falls in the second storm because of the new loan, and the lemonade did not get worse).
 * - **Beat 7, pin your why:** one chip in "Why I own it", then one in "I'm wrong if". The second chip pins the sheet on the
 *   tower door and raises the flag whole. Any chip is fine: there is no wrong why. It unlocks the "Write it down" page.
 * - **Beat 8, the end:** reaching it sets `finished`, whatever the pages. With all five pages the banner unrolls and the
 *   cheer plays, once ever (`banner`: "now" for the run that earned it, "done" after). "Play again" starts a new run at Sal's
 *   counter with the second storm; pages stay, and a page already held gives no new plate.
 *
 * The saved shape is V3's under the same key (`aladdin.game3d.starter.v1`) plus three optional fields: `run.second` (this
 * run gets the second storm), `run.picks.why` (the two chips), and `banner`. Nothing about the practice ever goes to the
 * server: the chips are kept here only, never in the journal.
 */
import { PIP, practiceTiers } from "./practiceCompanyV1";
import type { PracticeLand, PracticeTiers, PracticeWall } from "./practiceCompanyV1";
import { MAX_MISSES } from "./starterPlanV2";
import type { MoatChoice, WallChoice } from "./starterPlanV2";
import { BEATS, FRESH_RUN, PAGES, STARTER_KEY, saveStarter as saveStarterV1 } from "./starterPlanV1";
import type { Beat, PageId, StarterSaved as StarterSavedV1 } from "./starterPlanV1";
import { CHECKS as CHECKS_V3, CHECK_ORDER } from "./starterPlanV3";
import type { CheckBeat, CheckOutcome, PriceChoice, StormChoice } from "./starterPlanV3";

export { ARRIVAL_MS, BEATS, PAGES, PICKED_LINE_MS, STARTER_KEY } from "./starterPlanV1";
export { MAX_MISSES, MOAT_CHOICES, RESULT_MS, WALL_CHOICES } from "./starterPlanV2";
export { CHECK_ORDER, PRICE_CHOICES, STORM_CHOICES, STORM_COMING_MS, STORM_FALL_MS } from "./starterPlanV3";
export type { Beat, PageId } from "./starterPlanV1";
export type { MoatChoice, WallChoice } from "./starterPlanV2";
export type { CheckBeat, CheckOutcome, PriceChoice, StormChoice } from "./starterPlanV3";

/** Beat 7's chips, one row at a time. Any chip in each row is fine: the lesson is writing a why with its "wrong if". */
export const WHY_CHIPS = ["money", "recipe", "price"] as const;
export const WRONG_CHIPS = ["customers", "owing", "copied"] as const;
export type WhyChip = (typeof WHY_CHIPS)[number];
export type WrongChip = (typeof WRONG_CHIPS)[number];

/** What a storm leaves of Pip's business: what it owes, its walls, and what it makes in a year. */
export interface StormCase {
  owes: number;
  wall: PracticeWall;
  earnings: number;
}

/** Pip's earnings do not move in either storm: the lemonade is the same lemonade. */
const EARNINGS = PIP.leftOver[PIP.leftOver.length - 1];
const caseOf = (t: PracticeTiers): StormCase => ({ owes: t.owes, wall: t.wall, earnings: EARNINGS });

/**
 * What a storm changed, from Pip's business before and after it. If what it owes (or its walls) moved, it owes more; if what
 * it makes in a year moved, the lemonade got worse; otherwise only the price moved. Judged on earnings, not on worth: the
 * second storm's new loan lowers the worth of a piece, but the lemonade is as good as it was (#495 review, #496).
 */
export function stormChange(before: StormCase, after: StormCase): StormChoice {
  if (after.owes !== before.owes || after.wall !== before.wall) return "owes";
  if (after.earnings !== before.earnings) return "worse";
  return "price";
}

const CALM = caseOf(practiceTiers("calm"));
/** The first storm's right answer ("price") and the second storm's ("owes"), each worked out from Pip's numbers. */
export const STORM_RIGHT = {
  first: stormChange(CALM, caseOf(practiceTiers("storm"))),
  second: stormChange(CALM, caseOf(practiceTiers("secondStorm"))),
} as const;

/** The checks: V3's walls, moat and price unchanged; the storm's right answer is chosen per run by `rightOf`. */
export const CHECKS = CHECKS_V3;

export interface StarterRun {
  beat: Beat;
  /** What the player picked: the company, the choices tried at each check, then the two chips of the why. */
  picks: { company?: "pip"; walls?: WallChoice[]; moat?: MoatChoice[]; price?: PriceChoice[]; storm?: StormChoice[]; why?: [WhyChip] | [WhyChip, WrongChip] };
  /** Set on every run started by "Play again": its storm is the second storm (beat 6b). */
  second?: true;
}

export interface StarterSaved extends Omit<StarterSavedV1, "run"> {
  run: StarterRun;
  /** The banner and cheer: "now" in the run that earned them (all five pages at the end), "done" ever after. */
  banner?: "now" | "done";
}

export function emptyStarter(): StarterSaved {
  return { pages: [], finished: false, skipped: false, run: { ...FRESH_RUN, picks: {} } };
}

const isBeat = (v: unknown): v is Beat => typeof v === "string" && (BEATS as readonly string[]).includes(v);
const isPage = (v: unknown): v is PageId => typeof v === "string" && (PAGES as readonly string[]).includes(v);
const beatIndex = (b: Beat): number => BEATS.indexOf(b);
const isCheck = (b: Beat): b is CheckBeat => (CHECK_ORDER as readonly string[]).includes(b);

/** The right answer at a check in this run: the storm's depends on which storm it is. */
export function rightOf(run: StarterRun, beat: CheckBeat): string {
  return beat === "storm" ? (run.second ? STORM_RIGHT.second : STORM_RIGHT.first) : CHECKS[beat].right;
}

/** The tries at one check, kept only if each is a real choice, each at most once, and they stop at the first right one. */
function cleanTries(raw: unknown, check: CheckBeat, run: StarterRun): string[] {
  if (!Array.isArray(raw)) return [];
  const choices = CHECKS[check].choices as readonly string[];
  const right = rightOf(run, check);
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string" || !choices.includes(v) || out.includes(v)) continue;
    out.push(v);
    if (v === right || out.length >= MAX_MISSES) break;
  }
  return out;
}

function triesOf(run: StarterRun, beat: CheckBeat): readonly string[] {
  return run.picks[beat] ?? [];
}

/** Is this check over: right, or two misses? */
export function checkDone(run: StarterRun, beat: CheckBeat): boolean {
  const tries = triesOf(run, beat);
  return tries.includes(rightOf(run, beat)) || tries.length >= MAX_MISSES;
}

/** The choices not yet tried. The card keeps every slot and shows a tried one blank, so the others never move. */
export function choicesLeft(run: StarterRun, beat: CheckBeat): string[] {
  const tried = triesOf(run, beat);
  return (CHECKS[beat].choices as readonly string[]).filter((c) => !tried.includes(c));
}

/** The wrong choice tried last at this check, if the check is still open (its hint is on the card). */
export function lastMiss(run: StarterRun, beat: CheckBeat): string | null {
  if (checkDone(run, beat)) return null;
  const tries = triesOf(run, beat);
  return tries.length > 0 ? tries[tries.length - 1] : null;
}

function cleanWhy(raw: unknown): StarterRun["picks"]["why"] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const [a, b] = raw;
  if (!(WHY_CHIPS as readonly unknown[]).includes(a)) return undefined;
  return (WRONG_CHIPS as readonly unknown[]).includes(b) ? [a as WhyChip, b as WrongChip] : [a as WhyChip];
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
  if (o.banner === "now" || o.banner === "done") out.banner = o.banner;
  // Only a finished player can be on a second run ("Play again" is offered at the end).
  if (run.second === true && out.finished) out.run.second = true;
  if (picks.company === "pip") out.run.picks.company = "pip";
  for (const check of CHECK_ORDER) {
    const tries = cleanTries(picks[check], check, out.run);
    if (tries.length) (out.run.picks as Record<CheckBeat, string[]>)[check] = tries;
  }
  const why = cleanWhy(picks.why);
  if (why) out.run.picks.why = why;
  return settle(out);
}

/**
 * Makes a run drawable honestly: no beat past the pick without a company, no beat past a check that is not done, a done
 * check always moves on, and the end only with a pinned why. A run that breaks one of these goes back to the first step it
 * can stand on, never forward.
 */
function settle(s: StarterSaved): StarterSaved {
  const r = s.run;
  const second = r.second ? ({ second: true } as const) : {};
  if (r.picks.company !== "pip") {
    return r.beat === "arrive" || r.beat === "pick" ? { ...s, run: { beat: r.beat, picks: {}, ...second } } : { ...s, run: { ...FRESH_RUN, picks: {}, ...second } };
  }
  const picks: StarterRun["picks"] = { ...r.picks };
  let beat: Beat = r.beat === "arrive" || r.beat === "pick" ? "walls" : r.beat;
  for (const [i, check] of CHECK_ORDER.entries()) {
    const done = checkDone({ beat, picks, ...second }, check);
    if (!done) {
      if (beatIndex(beat) > beatIndex(check)) beat = check;
      if (beat === check) {
        for (const later of CHECK_ORDER.slice(i + 1)) delete picks[later];
        delete picks.why;
        return { ...s, run: { beat, picks, ...second } };
      }
    } else if (beat === check) {
      beat = CHECKS[check].next;
    }
  }
  // Past the checks: the end needs both chips; a why beat keeps a half-written sheet.
  if (beat === "end" && picks.why?.length !== 2) beat = "why";
  return { ...s, run: { beat, picks, ...second } };
}

export function loadStarter(storage: Pick<Storage, "getItem"> | null): StarterSaved {
  try {
    return parseStarter(storage?.getItem(STARTER_KEY) ?? null);
  } catch {
    return emptyStarter();
  }
}

/** Writes the one key (V1's writer: same key, same shape plus V4's optional fields). Blocked storage is not an error. */
export function saveStarter(storage: Pick<Storage, "setItem"> | null, saved: StarterSaved): boolean {
  return saveStarterV1(storage, saved as StarterSavedV1);
}

/** Beat 1 is over: the arrival plate goes and Sal's card opens. */
export function arrived(s: StarterSaved): StarterSaved {
  return s.run.beat === "arrive" ? { ...s, run: { ...s.run, beat: "pick" } } : s;
}

/** Beat 2: picking Pip's Lemonade raises the tower. Picking again does nothing. */
export function pickCompany(s: StarterSaved): StarterSaved {
  if (s.run.beat !== "arrive" && s.run.beat !== "pick") return s;
  return { ...s, run: { ...s.run, beat: "walls", picks: { ...s.run.picks, company: "pip" } } };
}

export function towerStands(run: StarterRun): boolean {
  return run.picks.company === "pip";
}

export function counterWaiting(run: StarterRun): boolean {
  return run.beat === "arrive" || run.beat === "pick";
}

/** The check card waiting for an answer now, if any. */
export function checkWaiting(run: StarterRun): CheckBeat | null {
  return isCheck(run.beat) && towerStands(run) && !checkDone(run, run.beat) ? run.beat : null;
}

/**
 * One pick at a check card. A right answer on the first or second try unlocks the beat's page, once; after two misses the
 * world still changes and the beat moves on, but the page stays locked. Pages only ever gain an id; nothing is counted. In
 * the second storm a right answer also earns the Storms page if it is not held yet (it carries both halves of the lesson),
 * so a player who missed it in the first run can still fill the Book.
 */
export function answerCheck(s: StarterSaved, beat: CheckBeat, choice: string): { saved: StarterSaved; outcome: CheckOutcome } {
  const check = CHECKS[beat];
  const tries = triesOf(s.run, beat);
  if (checkWaiting(s.run) !== beat || !(check.choices as readonly string[]).includes(choice) || tries.includes(choice)) {
    return { saved: s, outcome: { kind: "ignored" } };
  }
  const nextTries = [...tries, choice];
  const picks = { ...s.run.picks, [beat]: nextTries } as StarterRun["picks"];
  const right = choice === rightOf(s.run, beat);
  if (!right && nextTries.length < MAX_MISSES) return { saved: { ...s, run: { ...s.run, picks } }, outcome: { kind: "miss" } };
  const held = s.pages.includes(check.page);
  const earns = right && !held;
  const saved: StarterSaved = {
    ...s,
    pages: earns ? [...s.pages, check.page] : s.pages,
    run: { ...s.run, beat: check.next, picks },
  };
  return { saved, outcome: { kind: "done", right, page: held ? "held" : right ? "new" : "locked" } };
}

/** Beat 7's card is waiting: the run is at "Pin your why" and the sheet is not pinned yet. */
export function whyWaiting(run: StarterRun): boolean {
  return run.beat === "why" && towerStands(run) && run.picks.why?.length !== 2;
}

/** Which row of chips is on the card: "why" first, then "wrong" once a why is picked. */
export function whyRow(run: StarterRun): "why" | "wrong" {
  return run.picks.why?.length === 1 ? "wrong" : "why";
}

/** What picking a chip did: the first row's chip waits for the second; the second pins the sheet and ends the run. */
export type WhyOutcome = { kind: "ignored" } | { kind: "half" } | { kind: "pinned"; page: "new" | "held"; banner: boolean };

/**
 * One chip of beat 7. The first row's chip writes half the sheet; the second row's pins it on the tower door, earns the
 * "Write it down" page (once), sets `finished` and moves the run to the end. If that leaves all five pages held and the banner
 * has never unrolled, it unrolls now (once ever).
 */
export function pickWhy(s: StarterSaved, chip: string): { saved: StarterSaved; outcome: WhyOutcome } {
  if (!whyWaiting(s.run)) return { saved: s, outcome: { kind: "ignored" } };
  const why = s.run.picks.why;
  if (!why) {
    if (!(WHY_CHIPS as readonly string[]).includes(chip)) return { saved: s, outcome: { kind: "ignored" } };
    return { saved: { ...s, run: { ...s.run, picks: { ...s.run.picks, why: [chip as WhyChip] } } }, outcome: { kind: "half" } };
  }
  if (!(WRONG_CHIPS as readonly string[]).includes(chip)) return { saved: s, outcome: { kind: "ignored" } };
  const held = s.pages.includes("why");
  const pages: PageId[] = held ? s.pages : [...s.pages, "why"];
  const banner = s.banner === undefined && PAGES.every((p) => pages.includes(p));
  const saved: StarterSaved = {
    ...s,
    pages,
    finished: true,
    ...(banner ? { banner: "now" as const } : {}),
    run: { ...s.run, beat: "end", picks: { ...s.run.picks, why: [why[0], chip as WrongChip] } },
  };
  return { saved, outcome: { kind: "pinned", page: held ? "held" : "new", banner } };
}

/** The sheet on the tower door: pinned once both chips are picked. */
export function sheetPinned(run: StarterRun): boolean {
  return towerStands(run) && run.picks.why?.length === 2;
}

/** The tower's flag: up and whole once the why is pinned (the same look and meaning as a real tower's intact flag). */
export function flagOf(run: StarterRun): "none" | "intact" {
  return sheetPinned(run) ? "intact" : "none";
}

/** The run is over: the end's line and its two buttons show. */
export function atEnd(run: StarterRun): boolean {
  return run.beat === "end" && sheetPinned(run);
}

/** The lemon banner hangs down the tower in the run that earned it. A later run gives neither the banner nor the cheer. */
export function bannerUp(s: StarterSaved): boolean {
  return s.banner === "now" && atEnd(s.run);
}

/** The end without all five pages: the line says to play again to fill the book. */
export function bookFull(s: StarterSaved): boolean {
  return PAGES.every((p) => s.pages.includes(p));
}

/**
 * "Play again": a new run in the yard, at Sal's counter (the arrival plate has been read), with the second storm. Pages,
 * `finished` and the banner's "once" stay; the banner that was up is put away for good.
 */
export function playAgain(s: StarterSaved): StarterSaved {
  if (!atEnd(s.run)) return s;
  return { ...s, ...(s.banner ? { banner: "done" as const } : {}), run: { beat: "pick", picks: {}, second: true } };
}

/** The storm's numbers in this run: the first storm, or the second (owes 15, brick). */
function stormTiers(run: StarterRun): PracticeTiers {
  return practiceTiers(run.second ? "secondStorm" : "storm");
}

/** Has the storm come in this run: its beat has started (the price is weighed) or is over. Before that the price is 7. */
export function stormCame(run: StarterRun): boolean {
  return towerStands(run) && checkDone(run, "price") && (run.beat === "storm" || checkDone(run, "storm"));
}

/** The storm's clouds hang over the yard while its card waits; once it is answered they clear. */
export function stormOverhead(run: StarterRun): boolean {
  return stormCame(run) && !checkDone(run, "storm");
}

/**
 * The walls the tower shows: fog until the walls check is over, then what the real rule makes of Pip's numbers. In the second
 * storm the new loan turns them from granite to brick the moment the storm hits (before the card asks), so the change is seen.
 */
export function wallsOf(run: StarterRun): PracticeWall {
  if (!towerStands(run) || !checkDone(run, "walls")) return "unsurveyed";
  return run.second && stormCame(run) ? practiceTiers("secondStorm").wall : practiceTiers().wall;
}

/** The moat: mist until the moat check is over, then Pip's narrow moat (the recipe is still secret in both storms). */
export function moatOf(run: StarterRun): typeof PIP.moat | "unsurveyed" {
  return towerStands(run) && checkDone(run, "moat") ? PIP.moat : "unsurveyed";
}

/** The four fact cards on the board over the path stand once the tower does. */
export function factCardsShown(run: StarterRun): boolean {
  return towerStands(run);
}

/** What the Owes card says: 5 coins, or 15 once the second storm has hit (the card flips). */
export function owesShown(run: StarterRun): number {
  return run.second && stormCame(run) ? practiceTiers("secondStorm").owes : PIP.owes;
}

/** The price post's gauge: mist until weighed, then the real zone of the price now. Both storms leave it a bargain. */
export function gaugeOf(run: StarterRun): PracticeLand | "fog" {
  if (!towerStands(run) || !checkDone(run, "price")) return "fog";
  return stormCame(run) ? stormTiers(run).land : practiceTiers().land;
}

/** The balance scale: level and fogged until the price has been weighed, then tipped toward worth. */
export function scaleOf(run: StarterRun): "fog" | "tipped" {
  return towerStands(run) && checkDone(run, "price") ? "tipped" : "fog";
}

/** The price of one piece on the scale: 7 coins, then 4.9 once either storm has come. */
export function priceOf(run: StarterRun): number {
  return stormCame(run) ? stormTiers(run).price : practiceTiers().price;
}

/**
 * Which fact card a wrong storm pick points at (a brass frame and a "Look here" tag), as an index into the four cards:
 * "the lemonade got worse" points at year 3 (still 10 a year); "it owes more now" (first storm) and "only the price" (second
 * storm) point at what it owes. Null when none.
 */
export function factPointedAt(run: StarterRun): number | null {
  const miss = lastMiss(run, "storm");
  if (miss === "worse") return 2;
  if (miss === "owes" || miss === "price") return 3;
  return null;
}

/** The goal strip's line. */
export type Goal = "build" | "walls" | "moat" | "price" | "storm" | "why" | "end";
export function goalOf(run: StarterRun): Goal {
  if (!towerStands(run)) return "build";
  for (const check of CHECK_ORDER) if (!checkDone(run, check)) return check;
  return sheetPinned(run) ? "end" : "why";
}

/** The Plain view's rows that have been looked at. Each only once its check is over (no free answer). */
export function plainSeen(run: StarterRun): {
  company: boolean;
  pieces: boolean;
  leftOver: boolean;
  owes: boolean;
  walls: boolean;
  moat: boolean;
  worth: boolean;
  price: boolean;
  room: boolean;
  storm: boolean;
  why: boolean;
} {
  const picked = towerStands(run);
  const weighed = picked && checkDone(run, "price");
  return {
    company: picked,
    pieces: picked,
    leftOver: factCardsShown(run),
    owes: factCardsShown(run),
    walls: wallsOf(run) !== "unsurveyed",
    moat: moatOf(run) !== "unsurveyed",
    worth: picked,
    price: picked,
    room: weighed,
    storm: picked && checkDone(run, "storm"),
    why: sheetPinned(run),
  };
}

/** The Book is offered outside the yard (first Quests card) once the player has been in the yard far enough to build. */
export function bookOffered(s: StarterSaved): boolean {
  return towerStands(s.run) || s.pages.length > 0 || s.finished;
}

/** Beat 8's cheer plays this long (the existing confetti burst); then Barren's line and the two buttons show. */
export const CHEER_MS = 3000;

/** Under reduced motion there is no burst to wait for: the banner hangs at once and its line is read, then the end shows. */
export const CHEER_REDUCED_MS = 1000;
