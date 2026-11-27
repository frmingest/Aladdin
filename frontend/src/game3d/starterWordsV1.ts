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
import { PIP, practiceTiers } from "./practiceCompanyV1";

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
    // Build step 3 (#495):
    storm: "Spot what changed",
    why: "Pin your why",
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
    // Build step 3 (#495): the rows beats 5 and 6 look at. Numbers from the one table, the room worked out by `practiceTiers`.
    worth: `Low ${PIP.worth.low}, middle ${PIP.worth.middle}, high ${PIP.worth.high} coins.`,
    price: `${PIP.price} coins.`,
    room: `${practiceTiers().room} coins on ${PIP.worth.middle} (${Math.round(practiceTiers().roomShare * 100)}%). Lots of room. Grown-ups say margin of safety.`,
    storm: `Every price fell ${Math.round(PIP.stormFall * 100)}%: ${practiceTiers("storm").price} coins. Still made ${PIP.leftOver[2]}, still owes ${PIP.owes}.`,
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
      result: "Granite walls. One year's money pays its debt.",
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
    // Build step 3 (#495): beats 5 and 6. Right answer never first, never in the slot the card before used (starterPlanV3).
    price: {
      title: `Worth about ${PIP.worth.middle}. Price ${PIP.price}. How much room?`,
      taught: { who: "barren", text: `Worth ${PIP.worth.middle}, price ${PIP.price}. That gap is room to be wrong.` } as Line,
      // The real price post's own words, so the yard teaches the gauge the real lands show.
      choices: { some: "Some room", lots: "Lots of room", none: "No room" },
      result: "Lots of room. Even a low guess beats the price.",
      hints: {
        some: { who: "marlie", text: `Weigh it again. Even the low guess is ${PIP.worth.low}.` } as Line,
        none: { who: "marlie", text: `Weigh it again. Even the low guess is ${PIP.worth.low}.` } as Line,
      },
      prompt: "Press E to weigh the price",
    },
    storm: {
      title: `Storm! Prices fell ${Math.round(PIP.stormFall * 100)}%. What changed?`,
      // Not the taught line: "The price fell. The business did not." is the answer, so it waits for the Storms page.
      taught: { who: "barren", text: "Look at the cards, then the price." } as Line,
      choices: { worse: "The lemonade got worse", owes: "It owes more now", price: "Only the price" },
      result: "Only the price. Walls and moat held.",
      /** Said with the result: the other half of the lesson (a business change is news), true in beat 6b. */
      after: { who: "marlie", text: "If it owed more, that would be news." } as Line,
      hints: {
        worse: { who: "marlie", text: `Still ${PIP.leftOver[2]} coins a year. Look again.` } as Line,
        owes: { who: "marlie", text: `Still owes ${PIP.owes}. Look again.` } as Line,
      },
      /** The tag under the fact card a wrong pick points at. */
      lookHere: "Look here",
      prompt: "Press E to spot what changed",
    },
    close: "Close",
  },

  /** Beat 5's balance scale by the price post (#495): worth in one pan, the price in the other. */
  scale: {
    worth: `Worth about ${PIP.worth.middle}`,
    low: `low guess ${PIP.worth.low}`,
    price: `Price ${PIP.price}`,
    priceAfter: `Price ${PIP.price} → ${practiceTiers("storm").price}`,
    /** The gauge before the price is weighed: a "?" in the mist, and what to do, not "Not priced yet" (a price is on show). */
    gaugeFog: "Weigh it",
  },
  /** Beat 6's two plates before the card: the storm comes, and (reduced motion, no shake) what it did. */
  storm: {
    coming: "Storm coming",
    fell: `Prices fell ${Math.round(PIP.stormFall * 100)}%`,
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
        grownUp: "Grown-ups call what it owes, minus its cash, net debt.",
        real: "Press T: each tower says its walls.",
      },
      moat: {
        title: "Moat",
        lines: ["A moat is what stops others copying it."],
        fact: `Pip's has ${PIP.moatReason}: a narrow moat.`,
        grownUp: "Grown-ups say moat too: wide, narrow or none.",
        real: "Press T: each tower says its moat.",
      },
      // Build step 3 (#495):
      room: {
        title: "Room to be wrong",
        lines: [`Worth ${PIP.worth.middle}, price ${PIP.price}. That gap is room to be wrong.`],
        fact: `Pip's low guess is ${PIP.worth.low}, middle ${PIP.worth.middle}. Price ${PIP.price}.`,
        grownUp: "Grown-ups call this a margin of safety.",
        real: "On a real tower's land, the price post shows its room.",
      },
      storms: {
        title: "Storms",
        // Both halves from the first unlock (spec section 4), so the page never teaches "a price drop never matters".
        lines: ["The price fell. The business did not.", "If the business changes, that is news."],
        fact: `Pip's price fell from ${PIP.price} to ${practiceTiers("storm").price}. It still made ${PIP.leftOver[2]}.`,
        grownUp: "Grown-ups call a fall this big a bear market.",
        real: "Press T: walls and moat say if a business changed.",
      },
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
    ...(["walls", "moat", "price", "storm"] as const).flatMap((b) => {
      const c = w.checks[b];
      return [c.title, c.taught.text, ...Object.values(c.choices), c.result, ...lines(Object.values(c.hints)), c.prompt];
    }),
    w.checks.close,
    // Build step 3 (#495).
    w.goal.storm,
    w.goal.why,
    w.checks.storm.after.text,
    w.checks.storm.lookHere,
    ...Object.values(w.scale),
    ...Object.values(w.storm),
    ...bookStrings().filter((s) => !Object.values(w.book.pages).some((p) => p.grownUp === s)),
  ];
}

/** The Plain view's own lines (neutral and exact; grown-up words are allowed here, but none is needed yet). */
export function plainStrings(): string[] {
  const p = STARTER_WORDS.plain;
  return [p.title, p.intro, p.notYet, p.close, ...Object.values(p.rows), p.company, p.pieces, p.leftOver, p.owes, p.walls, p.moat, p.worth, p.price, p.room, p.storm];
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
    // Build step 3 (#495) adds the price and storm cards the same way. A storm miss also puts a "Look here" tag under a fact
    // card, counted with it; the storm's result plate carries Marlie's line too.
    ...(["walls", "moat", "price", "storm"] as const).flatMap((b) => {
      const c = w.checks[b];
      const choices = Object.entries(c.choices) as [string, string][];
      const open = { beat: `${b}-card`, strings: [w.tag, ...said([c.taught]), c.title, ...choices.map(([, t]) => t)] };
      const misses = (Object.entries(c.hints) as [string, Line][]).map(([id, hint]) => ({
        beat: `${b}-miss-${id}`,
        strings: [w.tag, ...said([hint]), c.title, ...choices.filter(([k]) => k !== id).map(([, t]) => t), ...(b === "storm" ? [w.checks.storm.lookHere] : [])],
      }));
      const next = { walls: w.goal.moat, moat: w.goal.price, price: w.goal.storm, storm: w.goal.why }[b];
      const page = { walls: "walls", moat: "moat", price: "room", storm: "storms" } as const;
      const pageLines = [w.book.newPage(w.book.pages[page[b]].title), w.book.held, w.book.earnLater];
      const extra = b === "storm" ? said([w.checks.storm.after]) : [];
      const results = pageLines.map((line, i) => ({ beat: `${b}-result-${i + 1}`, strings: [next, w.tag, c.result, ...extra, line] }));
      return [open, ...misses, ...results];
    }),
    // Beat 6's plates before its card: the goal strip, the tag and one short plate.
    { beat: "storm-coming", strings: [w.goal.storm, w.tag, w.storm.coming] },
    { beat: "storm-fell", strings: [w.goal.storm, w.tag, w.storm.fell] },
  ];
}
