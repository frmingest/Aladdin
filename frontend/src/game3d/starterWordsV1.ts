/**
 * The starter level's words (version 1, 2026-11-22; #477, build step 1 is #493). Spec:
 * `docs/game/game3d-starter-level-spec-2026-11-22.md` sections 3 and 4.
 *
 * Game voice: every sentence fits in one breath (under 12 words), in words a 12-year-old knows. At most 35 words on screen
 * in any beat, counted by a test over these strings. No buy, sell, hold or pay wording anywhere (a test bans them), and no
 * grown-up word ("net debt", "margin of safety") on a card face: those live only in the Plain view and the Book.
 *
 * Build step 1 writes the words of beats 1 and 2, the labels and the Plain view's titles. Later build steps add the words of
 * their own beats here before any of them is shown. A change to a string that has been shown is a new version file
 * (`starterWordsV2.ts`), never an edit of this one (CLAUDE.md rule 3).
 */
import { PIP } from "./practiceCompanyV1";

export const STARTER_WORDS_VERSION = "v1";

/** Who says a taught line: the name and a one-word tag, so the speaker is clear without knowing who they parody. */
export const SPEAKERS = {
  barren: "Barren, the patient one",
  marlie: "Marlie, the blunt one",
  sal: "Sal, the shopkeeper",
} as const;
export type SpeakerId = keyof typeof SPEAKERS;

export interface Line {
  who: SpeakerId;
  text: string;
}

export const STARTER_WORDS = {
  /** The place. */
  place: "Practice yard",
  loading: "Setting up the practice yard…",
  /** The HUD tag and the plate on the gate. "Practice" is only ever the noun. */
  tag: "Practice: made-up shop, made-up coins",
  /** The goal strip, one per beat. */
  goal: {
    build: "Build your first tower",
    walls: "Knock on the walls",
    // Build step 2 (#494):
    moat: "Fill the moat",
    price: "Weigh the price",
  },

  /** Beat 1: the arrival plate. Shown once; it goes when Sal's card opens, so the two are never on screen together. */
  arrival: [
    { who: "barren", text: "Welcome! Each tower is a business you own a piece of." },
    { who: "marlie", text: "This is practice. Made-up shop, made-up coins." },
  ] as readonly Line[],

  /** Beat 2: Sal's practice counter. Selecting acts: the company card is the only tap. */
  counter: {
    title: "Sal's counter (practice)",
    lead: { who: "sal", text: "Pick a shop. Its tower goes up." } as Line,
    company: { name: PIP.name, what: PIP.what },
    close: "Close",
    prompt: "Press E to open Sal's counter",
    /** The goal strip turns into this button once the card has been closed, so a phone (which cannot walk yet) is never stuck. */
    reopen: "Open Sal's counter",
  },
  /** Beat 2's result: the tower rises, then these two lines, one after the other. */
  picked: [
    { who: "sal", text: "A share is a small piece of a business. This piece is yours." },
    { who: "marlie", text: "Fog means nobody looked yet. Not good, not bad." },
  ] as readonly Line[],

  /** The gate stone once the tower stands. */
  gateStone: [PIP.name, `1 of ${PIP.pieces} pieces`, "Practice"] as readonly string[],
  /** The yard's gate: E here goes back to the courtyard. */
  leavePrompt: "Press E to leave the practice yard",

  /** The yard's own Plain view: neutral and exact. Everything is "Not looked at yet" until its beat has been played. */
  plain: {
    title: "Practice yard, plain",
    intro: "A made-up shop in made-up coins. Nothing here is real.",
    notYet: "Not looked at yet",
    close: "Close",
    rows: {
      company: "Company",
      pieces: "Pieces",
      leftOver: "Money left over per year",
      owes: "Owes",
      walls: "Walls",
      moat: "Moat",
      worth: "Worth of one piece (low, middle, high)",
      price: "Price of one piece",
      room: "Room to be wrong",
      storm: "After the storm",
    },
    company: `${PIP.name}: ${PIP.what.charAt(0).toLowerCase()}${PIP.what.slice(1)}`,
    pieces: `Cut into ${PIP.pieces} pieces. You own ${PIP.owned}.`,
    // Build step 2 (#494): the rows beats 3 and 4 look at.
    leftOver: `Year 1: ${PIP.leftOver[0]} coins. Year 2: ${PIP.leftOver[1]}. Year 3: ${PIP.leftOver[2]}.`,
    owes: `${PIP.owes} coins. Cash: ${PIP.cash}. Interest: ${PIP.interest} coins a year.`,
    walls: `Granite. Owes ${PIP.owes}. Made ${PIP.leftOver[2]} last year. Half of one year: granite.`,
    moat: `Narrow. ${PIP.moatReason} is hard to copy, not impossible.`,
  },

  // --- Build step 2 (#494): beats 3 and 4 and the Book of Wisdom. -------------------------------------------------------

  /** The four fact cards on the notice board by the path (beat 3). Each card: its big line, then any small print under it. */
  facts: [[`Year 1: ${PIP.leftOver[0]}`, "coins left over"], [`Year 2: ${PIP.leftOver[1]}`], [`Year 3: ${PIP.leftOver[2]}`], [`Owes: ${PIP.owes} coins`]] as readonly (readonly string[])[],

  /**
   * The check cards. The taught line is spoken in the card's header; a wrong pick swaps it for Marlie's hint (so the card
   * never grows). No choice label gives the answer away: the reason is in the result line only.
   */
  checks: {
    walls: {
      title: "Knock on the walls. Which walls?",
      taught: { who: "barren", text: "Strong walls: it makes money and owes little." } as Line,
      choices: { granite: "Granite", timber: "Timber", rotted: "Rotted" },
      result: "Granite walls. One good year pays its debt.",
      hints: {
        timber: { who: "marlie", text: `Look again. It owes ${PIP.owes}. Last year it made ${PIP.leftOver[2]}.` } as Line,
        rotted: { who: "marlie", text: `Look again. It owes ${PIP.owes}. Last year it made ${PIP.leftOver[2]}.` } as Line,
      },
      prompt: "Press E to knock on the walls",
    },
    moat: {
      title: "What stops others copying Pip's?",
      taught: { who: "marlie", text: "A moat is what stops others copying it." } as Line,
      choices: { recipe: PIP.moatReason, sign: "A shiny new sign", cheap: "Cheapest lemonade this week" },
      result: "Narrow moat. A recipe is hard to copy.",
      hints: {
        sign: { who: "marlie", text: "Anyone can paint a sign. Look for what they can't copy." } as Line,
        cheap: { who: "marlie", text: "Anyone can cut prices tomorrow. Look for what they can't copy." } as Line,
      },
      prompt: "Press E to fill the moat",
    },
    close: "Close",
  },

  /** The Book of Wisdom (section 4). No number anywhere in it: five titles, each learned or not, and nothing counted. */
  book: {
    title: "Book of Wisdom",
    prompt: "Press E to read the Book",
    close: "Close",
    cover: ["A share is a small piece of a business.", "Fog means nobody looked yet. Same on real towers."] as readonly string[],
    locked: "Not learned yet",
    learned: "Learned",
    blocked: "This browser won't keep your book.",
    /** The plate beside the result once a page unlocks, and the lines when it does not. */
    newPage: (title: string) => `New page: ${title}`,
    held: "Already in your book.",
    earnLater: "Play again to earn this page.",
    /** The first card of the Quests panel outside the yard. */
    questLead: "What you learned in the practice yard.",
    questOpen: "Read the Book",
    /**
     * One page per idea checked in practice. Build step 2 writes the full pages it unlocks (walls, moat); the others carry
     * their title only until their own build step writes them (a locked page shows only its title).
     */
    pages: {
      walls: {
        title: "Walls",
        lines: ["Strong walls: it makes money and owes little."],
        fact: `Pip's owes ${PIP.owes} and made ${PIP.leftOver[2]} last year.`,
        grownUp: "Grown-ups call what it owes, less its cash, net debt.",
        real: "Press T: each tower says its walls.",
      },
      moat: {
        title: "Moat",
        lines: ["A moat is what stops others copying it."],
        fact: `Pip's has ${PIP.moatReason}.`,
        grownUp: "Grown-ups call this a moat too.",
        real: "Press T: each tower says its moat.",
      },
      room: { title: "Room to be wrong" },
      storms: { title: "Storms" },
      why: { title: "Write it down" },
    } as Record<"walls" | "moat" | "room" | "storms" | "why", BookPage>,
  },
} as const;

/** One Book page. A page with no `lines` is not written yet; it can only show as locked. */
export interface BookPage {
  title: string;
  lines?: readonly string[];
  fact?: string;
  /** The grown-up word: only ever on a Book page or in the Plain view, never on a card face. */
  grownUp?: string;
  real?: string;
}

/** Every string the Book can show, grown-up lines included (for the count-pattern and voice tests). */
export function bookStrings(): string[] {
  const b = STARTER_WORDS.book;
  const pages = Object.values(b.pages).flatMap((p) => [p.title, ...(p.lines ?? []), p.fact, p.grownUp, p.real].filter((s): s is string => !!s));
  return [b.title, b.prompt, b.close, ...b.cover, b.locked, b.learned, b.blocked, b.held, b.earnLater, b.questLead, b.questOpen, ...Object.values(b.pages).map((p) => b.newPage(p.title)), ...pages];
}

/** Every sentence a player can see in the starter, for the voice tests. */
export function allStarterStrings(): string[] {
  const w = STARTER_WORDS;
  const lines = (ls: readonly Line[]) => ls.map((l) => l.text);
  return [
    w.place,
    w.loading,
    w.tag,
    ...Object.values(w.goal),
    ...lines(w.arrival),
    w.counter.title,
    w.counter.lead.text,
    w.counter.company.name,
    w.counter.company.what,
    w.counter.close,
    w.counter.prompt,
    w.counter.reopen,
    ...lines(w.picked),
    ...w.gateStone,
    w.leavePrompt,
    w.plain.title,
    w.plain.intro,
    w.plain.notYet,
    ...Object.values(w.plain.rows),
    w.plain.company,
    w.plain.pieces,
    ...Object.values(SPEAKERS),
    // Build step 2 (#494). Plain view rows and Book grown-up lines are left out of this list on purpose: they are the only
    // places a grown-up word may appear, and `bookStrings` / `plainStrings` cover them in their own tests.
    w.goal.moat,
    w.goal.price,
    ...w.facts.flat(),
    ...(["walls", "moat"] as const).flatMap((b) => {
      const c = w.checks[b];
      return [c.title, c.taught.text, ...Object.values(c.choices), c.result, ...lines(Object.values(c.hints)), c.prompt];
    }),
    w.checks.close,
    ...bookStrings().filter((s) => !Object.values(w.book.pages).some((p) => p.grownUp === s)),
  ];
}

/** The Plain view's own lines (neutral and exact; grown-up words are allowed here, but none is needed yet). */
export function plainStrings(): string[] {
  const p = STARTER_WORDS.plain;
  return [p.title, p.intro, p.notYet, p.close, ...Object.values(p.rows), p.company, p.pieces, p.leftOver, p.owes, p.walls, p.moat];
}

/** What is on screen at once in each beat, for the 35-word cap: the goal strip, the practice tag and the open card or plate. */
export function screensOfBeats(): { beat: string; strings: string[] }[] {
  const w = STARTER_WORDS;
  const said = (ls: readonly Line[]) => ls.flatMap((l) => [SPEAKERS[l.who], l.text]);
  return [
    { beat: "arrive", strings: [w.goal.build, w.tag, ...said(w.arrival)] },
    { beat: "pick", strings: [w.goal.build, w.tag, w.counter.title, ...said([w.counter.lead]), w.counter.company.name, w.counter.company.what] },
    // Beat 2's two result lines show one after the other, so each stays well under the cap.
    ...w.picked.map((l, i) => ({ beat: `picked-${i + 1}`, strings: [w.goal.walls, w.tag, ...said([l])] })),
    // Build step 2 (#494): while a check card is open the goal strip steps aside (the card's title says the same), so a
    // screen is the tag and the card: its header (the taught line, or the hint after a miss), its title and the choices
    // still on it. After a miss the tried choice is off the card. Then the result plate with its page line, under the goal.
    ...(["walls", "moat"] as const).flatMap((b) => {
      const c = w.checks[b];
      const choices = Object.entries(c.choices) as [string, string][];
      const open = { beat: `${b}-card`, strings: [w.tag, ...said([c.taught]), c.title, ...choices.map(([, t]) => t)] };
      const misses = (Object.entries(c.hints) as [string, Line][]).map(([id, hint]) => ({
        beat: `${b}-miss-${id}`,
        strings: [w.tag, ...said([hint]), c.title, ...choices.filter(([k]) => k !== id).map(([, t]) => t)],
      }));
      const next = b === "walls" ? w.goal.moat : w.goal.price;
      const pageLines = [w.book.newPage(w.book.pages[b].title), w.book.held, w.book.earnLater];
      const results = pageLines.map((line, i) => ({ beat: `${b}-result-${i + 1}`, strings: [next, w.tag, c.result, line] }));
      return [open, ...misses, ...results];
    }),
  ];
}
