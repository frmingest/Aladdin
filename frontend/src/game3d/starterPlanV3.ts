/**
 * The starter level's rules, version 3 (2026-11-27; #477, build step 3 is #495). Pure: no three.js, no React, no network.
 * Spec: `docs/game/game3d-starter-level-spec-2026-11-22.md` sections 3 and 4.
 *
 * Why a new version: `starterPlanV2.ts` is on main and has been shown. Beats 5 and 6 change what it does with a run past the
 * moat (V2 stops every run at the price beat and has no price or storm check), so they live here and V2 is left as it was
 * (CLAUDE.md rule 3). V2's walls and moat checks are the same here: their choices, right answers and pages are imported
 * from V2, not copied.
 *
 * What it adds: two more checks with the same rules as V2's (three choices, the right one never first and never in the slot
 * the card before used, two misses show the answer, a page unlocks once): weigh the price (beat 5) and spot what changed in
 * the storm (beat 6). It saves under the same key (`aladdin.game3d.starter.v1`) in the same shape: the run's picks gain the
 * choices tried at these two checks. Nothing about the practice ever goes to the server.
 *
 * The right answers are not typed in: the price from the real land zones over Pip's numbers (`practiceTiers().land`), the
 * storm from comparing Pip's business before and after the storm (`practiceTiers("storm")`), so the practice can never mark an
 * answer right that the real rules would not give.
 */
import { PIP, practiceTiers } from "./practiceCompanyV1";
import type { PracticeLand, PracticeTiers, PracticeWall } from "./practiceCompanyV1";
import { CHECKS as CHECKS_V2, MAX_MISSES } from "./starterPlanV2";
import type { MoatChoice, WallChoice } from "./starterPlanV2";
import { BEATS, FRESH_RUN, PAGES, STARTER_KEY, saveStarter as saveStarterV1 } from "./starterPlanV1";
import type { Beat, PageId, StarterSaved as StarterSavedV1 } from "./starterPlanV1";

export { ARRIVAL_MS, BEATS, PAGES, PICKED_LINE_MS, STARTER_KEY } from "./starterPlanV1";
export { MAX_MISSES, MOAT_CHOICES, RESULT_MS, WALL_CHOICES } from "./starterPlanV2";
export type { Beat, PageId } from "./starterPlanV1";
export type { MoatChoice, WallChoice } from "./starterPlanV2";

/**
 * Beat 5's choices: the real price post's own words. The right one ("lots") sits in slot 2, the moat card's right answer was
 * in slot 3: never first, never the slot just used.
 */
export const PRICE_CHOICES = ["some", "lots", "none"] as const;
/**
 * Beat 6's choices. The right one ("price") sits in slot 3, the price card's was in slot 2. The same three words come back in
 * the second storm (build step 4), where "owes" (slot 2) is right, so the slot never gives it away either.
 */
export const STORM_CHOICES = ["worse", "owes", "price"] as const;
export type PriceChoice = (typeof PRICE_CHOICES)[number];
export type StormChoice = (typeof STORM_CHOICES)[number];
export type CheckBeat = "walls" | "moat" | "price" | "storm";

/** The gauge word each land zone shows (the real price post's mapping): the price card's right answer comes from Pip's zone. */
const ROOM_FOR: Record<PracticeLand, PriceChoice | null> = { bargain: "lots", discount: "some", full_price: "none", overpriced: null };

/**
 * What the storm changed, from Pip's business before and after it. If the walls (what it owes against what it makes) moved, it
 * owes more; if what it makes moved, the lemonade got worse; otherwise only the price moved. Worked out, never typed in.
 */
export function stormChange(before: PracticeTiers, after: PracticeTiers): StormChoice {
  if (after.owes !== before.owes || after.wall !== before.wall) return "owes";
  if (after.worth.middle !== before.worth.middle) return "worse";
  return "price";
}

/** Each check: its choices, the right one, the page it unlocks and the beat after it. */
export const CHECKS = {
  walls: CHECKS_V2.walls,
  moat: CHECKS_V2.moat,
  price: { choices: PRICE_CHOICES, right: ROOM_FOR[practiceTiers().land] as PriceChoice, page: "room", next: "storm" },
  storm: { choices: STORM_CHOICES, right: stormChange(practiceTiers("calm"), practiceTiers("storm")), page: "storms", next: "why" },
} as const satisfies Record<CheckBeat, { choices: readonly string[]; right: string; page: PageId; next: Beat }>;

/** The checks in the order they are played. */
export const CHECK_ORDER: readonly CheckBeat[] = ["walls", "moat", "price", "storm"];
/** The last beat this build plays to: past the storm the run waits at "Pin your why" (build step 4, #496). */
const LAST_BEAT: Beat = "why";

export interface StarterRun {
  beat: Beat;
  /** What the player picked: the company, then the choices tried at each check, in order. */
  picks: { company?: "pip"; walls?: WallChoice[]; moat?: MoatChoice[]; price?: PriceChoice[]; storm?: StormChoice[] };
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
const isCheck = (b: Beat): b is CheckBeat => (CHECK_ORDER as readonly string[]).includes(b);

/** The tries at one check, kept only if each is a real choice, each at most once, and they stop at the first right one. */
function cleanTries(raw: unknown, check: CheckBeat): string[] {
  if (!Array.isArray(raw)) return [];
  const { choices, right } = CHECKS[check];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string" || !(choices as readonly string[]).includes(v) || out.includes(v)) continue;
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
  return tries.includes(CHECKS[beat].right) || tries.length >= MAX_MISSES;
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
  for (const check of CHECK_ORDER) {
    const tries = cleanTries(picks[check], check);
    if (tries.length) (out.run.picks as Record<CheckBeat, string[]>)[check] = tries;
  }
  return settle(out);
}

/**
 * Makes a run drawable honestly: no beat past the pick without a company, no beat past a check that is not done, and a done
 * check always moves on. A run that breaks one of these goes back to the first step it can stand on, never forward.
 */
function settle(s: StarterSaved): StarterSaved {
  const r = s.run;
  if (r.picks.company !== "pip") return r.beat === "arrive" || r.beat === "pick" ? { ...s, run: { beat: r.beat, picks: {} } } : { ...s, run: { ...FRESH_RUN, picks: {} } };
  const picks: StarterRun["picks"] = { ...r.picks };
  let beat: Beat = r.beat === "arrive" || r.beat === "pick" ? "walls" : r.beat;
  // Walk the checks in order and stop at the first one still open; anything tried at a later check cannot have happened yet.
  for (const [i, check] of CHECK_ORDER.entries()) {
    const done = checkDone({ beat, picks }, check);
    if (!done) {
      if (beatIndex(beat) > beatIndex(check)) beat = check;
      if (beat === check) {
        for (const later of CHECK_ORDER.slice(i + 1)) delete picks[later];
        return { ...s, run: { beat, picks } };
      }
    } else if (beat === check) {
      beat = CHECKS[check].next;
    }
  }
  // This build plays up to "Pin your why": a later beat saved by hand reads as that one.
  if (beatIndex(beat) > beatIndex(LAST_BEAT)) beat = LAST_BEAT;
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
  return isCheck(run.beat) && towerStands(run) && !checkDone(run, run.beat) ? run.beat : null;
}

/** What happened when a choice was picked, for the card and the result plate (the same outcomes as V2). */
export type CheckOutcome =
  | { kind: "ignored" }
  | { kind: "miss" }
  | { kind: "done"; right: boolean; page: "new" | "held" | "locked" };

/**
 * One pick at a check card. A right answer on the first or second try unlocks the beat's page, once; after two misses the
 * world still changes and the beat moves on, but the page stays locked. Pages only ever gain an id; nothing is counted.
 */
export function answerCheck(s: StarterSaved, beat: CheckBeat, choice: string): { saved: StarterSaved; outcome: CheckOutcome } {
  const check = CHECKS[beat];
  const tries = triesOf(s.run, beat);
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

/** The four fact cards on the board over the path stand once the tower does. */
export function factCardsShown(run: StarterRun): boolean {
  return towerStands(run);
}

/**
 * The price post's gauge (beat 5): mist with a "?" until the price has been weighed, then the real land zone of Pip's price
 * (a bargain: "Lots of room"). After the storm the zone is worked out again from the new price; it stays a bargain.
 */
export function gaugeOf(run: StarterRun): PracticeLand | "fog" {
  if (!towerStands(run) || !checkDone(run, "price")) return "fog";
  return practiceTiers(stormCame(run) ? "storm" : "calm").land;
}

/** The balance scale: level and fogged until the price has been weighed, then tipped toward worth. */
export function scaleOf(run: StarterRun): "fog" | "tipped" {
  return towerStands(run) && checkDone(run, "price") ? "tipped" : "fog";
}

/** Has the storm come in this run: its beat has started (the price is weighed) or is over. Before that the price is 7. */
export function stormCame(run: StarterRun): boolean {
  return towerStands(run) && checkDone(run, "price") && (run.beat === "storm" || checkDone(run, "storm"));
}

/** The storm's clouds hang over the yard while its card waits; once it is answered they clear. */
export function stormOverhead(run: StarterRun): boolean {
  return stormCame(run) && !checkDone(run, "storm");
}

/** The price of one piece on the scale: 7 coins, then 4.9 once the storm has come. */
export function priceOf(run: StarterRun): number {
  return practiceTiers(stormCame(run) ? "storm" : "calm").price;
}

/**
 * Which fact card a wrong storm pick points at (a thicker outline and a "Look here" tag): "the lemonade got worse" points at
 * year 3 (still 10 a year), "it owes more now" at what it owes (still 5). Index into the four cards; null when none.
 */
export function factPointedAt(run: StarterRun): number | null {
  const miss = lastMiss(run, "storm");
  return miss === "worse" ? 2 : miss === "owes" ? 3 : null;
}

/** The goal strip's line. */
export type Goal = "build" | "walls" | "moat" | "price" | "storm" | "why";
export function goalOf(run: StarterRun): Goal {
  if (!towerStands(run)) return "build";
  for (const check of CHECK_ORDER) if (!checkDone(run, check)) return check;
  return "why";
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
    // The worth and the price are on the scale and the card from the start of beat 5; the room is the answer, so it waits.
    worth: picked && checkDone(run, "moat"),
    price: picked && checkDone(run, "moat"),
    room: weighed,
    storm: picked && checkDone(run, "storm"),
  };
}

/** The Book is offered outside the yard (first Quests card) once the player has been in the yard far enough to build. */
export function bookOffered(s: StarterSaved): boolean {
  return towerStands(s.run) || s.pages.length > 0;
}

/** Beat 6's timing (spec section 3): "Storm coming" shows this long after beat 5's result plate goes, then the clouds come. */
export const STORM_COMING_MS = 1000;
/** The clouds are in and the price has fallen: the tower shakes (or, reduced motion, a plate says so), then the card opens. */
export const STORM_FALL_MS = 1400;
