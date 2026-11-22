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
    company: { name: PIP.name, what: "A lemonade stand by the park" },
    close: "Close",
    prompt: "Press E to open Sal's counter",
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
    company: `${PIP.name}: a lemonade stand by the park`,
    pieces: `Cut into ${PIP.pieces} pieces. You own ${PIP.owned}.`,
  },
} as const;

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
  ];
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
  ];
}
