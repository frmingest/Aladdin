/**
 * The starter level's words, version 3 (2026-11-27; #496, build step 4). Spec: `docs/game/game3d-starter-level-spec-2026-11-22.md`
 * sections 3 (beats 6b, 7 and 8), 4 and 5.
 *
 * V2 (`starterWordsV2.ts`, #530) has been shown, so build step 4's words are a new file (CLAUDE.md rule 3). Every V2 string is
 * here unchanged, taken from V2, not copied; this file only adds: the second storm (beat 6b), the why card (beat 7), the end
 * (beat 8), the Owes card and Plain view rows that follow the run, and the "Write it down" Book page.
 *
 * Game voice: every sentence fits in one breath (under 12 words), in words a 12-year-old knows. At most 35 words on screen
 * in any beat. No buy, sell, hold or pay wording. The helpers below read V3's own words (V2 re-exports V1's helpers, which
 * read V1's), so the voice, banned-word and word-cap tests cover every string this build adds.
 */
import { PIP, practiceTiers } from "./practiceCompanyV1";
import { STARTER_WORDS as V2 } from "./starterWordsV2";
import { SPEAKERS, allStarterStrings as allV1, plainStrings as plainV1, screensOfBeats as screensV1 } from "./starterWordsV1";
import type { BookPage, Line } from "./starterWordsV1";

export { SPEAKERS } from "./starterWordsV1";
export type { BookPage, Line, SpeakerId } from "./starterWordsV1";

export const STARTER_WORDS_VERSION = "v3";

const SECOND = practiceTiers("secondStorm");
const EARNED = PIP.leftOver[PIP.leftOver.length - 1];

export const STARTER_WORDS = {
  ...V2,
  goal: { ...V2.goal, end: "Your tower stands" },

  /** The four fact cards after the second storm has hit: the Owes card flips from 5 to 15 (beat 6b). */
  factsSecond: [...V2.facts.slice(0, 3), [`Owes: ${SECOND.owes} coins`]] as readonly (readonly string[])[],

  /** Beat 6b, the second storm ("Play again" only). The card is beat 6's own: same title, same three choices. */
  storm2: {
    /** The plate while the price falls: what changed in the business, with its number. */
    fridge: `The fridge broke. Pip's borrowed ${PIP.secondStormBorrow} coins.`,
    result: "It owes more now. The walls cracked.",
    /** Marlie's line from beat 6, now true. */
    after: { who: "marlie", text: "If it owed more, that would be news. It does." } as Line,
    hints: {
      price: { who: "marlie", text: `Owes ${SECOND.owes} now. Look again.` } as Line,
      worse: { who: "marlie", text: `Still ${EARNED} coins a year. Look again.` } as Line,
    },
  },

  /** The scale's worth sign after the second storm: the new loan comes off the stand's worth, a coin a piece. */
  scale2: { worth: `Worth about ${SECOND.worth.middle}`, low: `low guess ${SECOND.worth.low}` },

  /** Beat 7: pin your why. One row of chips at a time; the second chip pins the sheet. No wrong why. */
  why: {
    taught: { who: "barren", text: "Write why you own it, and what proves you wrong." } as Line,
    rows: { why: "Why I own it", wrong: "I'm wrong if" },
    chips: { money: "It makes money every year", recipe: "People love the recipe", price: "Price below worth" },
    wrongChips: { customers: "Customers stop coming", owing: "It starts owing a lot", copied: "Someone copies the recipe" },
    /** The result plate when the sheet is pinned, with Marlie's line. */
    result: "Pinned on the door. The flag is up.",
    after: { who: "marlie", text: "Now you can check yourself later." } as Line,
    prompt: "Press E to pin your why",
    /** The two lines of the sheet on the door. */
    sheet: { why: "Why:", wrong: "Wrong if:" },
  },

  /** Beat 8: the end. Barren's line, then the two buttons. */
  end: {
    line: { who: "barren", text: "You can read a tower now. Next, real ones." } as Line,
    /** Instead, when a page is still locked: no banner, no cheer. */
    notFull: { who: "barren", text: "Play again to fill your book." } as Line,
    real: "Bring your real fortress",
    again: "Play again",
    /** The banner down the tower, in words for a screen reader (the banner itself carries a lemon, no words). */
    banner: "A lemon banner unrolls down your tower.",
  },

  plain: {
    ...V2.plain,
    rows: { ...V2.plain.rows, why: "Your why" },
    /** The walls and the storm rows after the second storm: the same facts as the world, exact. */
    walls2: `Brick. Owes ${SECOND.owes}. Made ${EARNED} last year. One and a half years: brick.`,
    storm2: `Every price fell ${Math.round(PIP.stormFall * 100)}%: ${SECOND.price} coins. Borrowed ${PIP.secondStormBorrow}, so it owes ${SECOND.owes}.`,
    worth2: `Low ${SECOND.worth.low}, middle ${SECOND.worth.middle}, high ${SECOND.worth.high} coins.`,
    owes2: `${SECOND.owes} coins. Cash: ${PIP.cash}. Interest: ${(PIP.interest / PIP.owes) * SECOND.owes} coins a year.`,
    why: "Two chips, kept in this browser only.",
  },

  book: {
    ...V2.book,
    pages: {
      ...V2.book.pages,
      why: {
        title: "Write it down",
        lines: ["Write why you own it, and what proves you wrong."],
        fact: "Your why for Pip's hangs on its tower door.",
        // No grown-up word: "why" is the word used everywhere (spec section 4).
        real: "At your desk, write a real why.",
      },
    } as Record<"walls" | "moat" | "room" | "storms" | "why", BookPage>,
  },
} as const;

/** Every string the Book can show, grown-up lines included (for the count-pattern and voice tests). */
export function bookStrings(): string[] {
  const b = STARTER_WORDS.book;
  const pages = Object.values(b.pages).flatMap((p) => [p.title, ...(p.lines ?? []), p.fact, p.grownUp, p.real].filter((s): s is string => !!s));
  return [b.title, b.prompt, b.close, ...b.cover, b.locked, b.learned, b.blocked, b.held, b.earnLater, b.questLead, b.questOpen, ...Object.values(b.pages).map((p) => b.newPage(p.title)), ...pages];
}

const lines = (ls: readonly Line[]) => ls.map((l) => l.text);
const said = (ls: readonly Line[]) => ls.flatMap((l) => [SPEAKERS[l.who], l.text]);

/** The strings this build adds to the card faces, plates and labels (no grown-up word is allowed in any of them). */
function addedStrings(): string[] {
  const w = STARTER_WORDS;
  return [
    w.goal.end,
    ...w.factsSecond.flat(),
    w.storm2.fridge,
    w.storm2.result,
    ...Object.values(w.scale2),
    ...lines([w.storm2.after, ...Object.values(w.storm2.hints)]),
    ...lines([w.why.taught, w.why.after]),
    ...Object.values(w.why.rows),
    ...Object.values(w.why.chips),
    ...Object.values(w.why.wrongChips),
    w.why.result,
    w.why.prompt,
    ...Object.values(w.why.sheet),
    ...lines([w.end.line, w.end.notFull]),
    w.end.real,
    w.end.again,
    w.end.banner,
  ];
}

/** Every sentence a player can see in the starter, for the voice tests: V1's, the new ones, and the Book outside its grown-up lines. */
export function allStarterStrings(): string[] {
  const grownUps = Object.values(STARTER_WORDS.book.pages).flatMap((p) => (p.grownUp ? [p.grownUp] : []));
  return [...allV1(), ...addedStrings(), ...bookStrings().filter((s) => !grownUps.includes(s))];
}

/** The Plain view's own lines. */
export function plainStrings(): string[] {
  const p = STARTER_WORDS.plain;
  return [...plainV1(), p.rows.why, p.walls2, p.storm2, p.worth2, p.owes2, p.why];
}

/** What is on screen at once in each beat, for the 35-word cap: V1's beats, then 6b, 7 and 8. */
export function screensOfBeats(): { beat: string; strings: string[] }[] {
  const w = STARTER_WORDS;
  const storm = w.checks.storm;
  const choices = Object.entries(storm.choices) as [string, string][];
  // Beat 6b: the same card as beat 6, the fridge plate before it, Marlie's hints after a miss (with a "Look here" tag).
  const second = [
    { beat: "storm2-fridge", strings: [w.goal.storm, w.tag, w.storm2.fridge] },
    { beat: "storm2-card", strings: [w.tag, ...said([storm.taught]), storm.title, ...choices.map(([, t]) => t)] },
    ...(Object.entries(w.storm2.hints) as [string, Line][]).map(([id, hint]) => ({
      beat: `storm2-miss-${id}`,
      strings: [w.tag, ...said([hint]), storm.title, ...choices.filter(([k]) => k !== id).map(([, t]) => t), storm.lookHere],
    })),
    ...[w.book.newPage(w.book.pages.storms.title), w.book.held, w.book.earnLater].map((line, i) => ({
      beat: `storm2-result-${i + 1}`,
      strings: [w.goal.why, w.tag, w.storm2.result, ...said([w.storm2.after]), line],
    })),
  ];
  // Beat 7: the card's header (Barren's line), the row's title and its three chips. The goal strip steps aside.
  const why = [
    { beat: "why-row-1", strings: [w.tag, ...said([w.why.taught]), w.why.rows.why, ...Object.values(w.why.chips)] },
    { beat: "why-row-2", strings: [w.tag, ...said([w.why.taught]), w.why.rows.wrong, ...Object.values(w.why.wrongChips)] },
    ...[w.book.newPage(w.book.pages.why.title), w.book.held].map((line, i) => ({
      beat: `why-result-${i + 1}`,
      strings: [w.goal.end, w.tag, w.why.result, ...said([w.why.after]), line],
    })),
  ];
  // Beat 8: the goal, the tag, Barren's line and the two buttons.
  const end = [w.end.line, w.end.notFull].map((l, i) => ({ beat: `end-${i + 1}`, strings: [w.goal.end, w.tag, ...said([l]), w.end.real, w.end.again] }));
  return [...screensV1(), ...second, ...why, ...end];
}
