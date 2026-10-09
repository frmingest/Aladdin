import { capsuleLabel, capsuleState, type CapsuleState } from "./capsules";
import { actionLabel, daysText } from "./rituals";
import type { DecisionRecord } from "./types";

/**
 * The Hall of Records (game mode G18, identity pass). Pure mapping from a stored decision record to
 * what the hall draws: one tome per record on a shelf, a wax seal per review, a bookmark ribbon when a
 * review is owed. Nothing here grades a decision: a tome's look never depends on the price change, the
 * verdict or the confidence, so a good outcome is not drawn prettier than a bad one and hindsight stays
 * a reading, not a score. Each look is told apart by shape and printed word, never by colour alone.
 */

export type SealShape = "intact" | "cracked" | "open";

export interface SealLook {
  shape: SealShape;
  /** Printed beside the seal in the reading desk. */
  word: string;
}

/** sealed = an intact disc, owed = a disc split in two, written = an empty ring. */
export const SEAL_LOOK: Record<CapsuleState, SealLook> = {
  sealed: { shape: "intact", word: "Sealed" },
  unsealed: { shape: "cracked", word: "Owed" },
  opened: { shape: "open", word: "Written" },
};

/** The six actions a journal entry can carry, each with a letter for the spine roundel and a leather. */
export const ACTION_SPINE: Record<string, { letter: string; leather: string; edge: string }> = {
  buy: { letter: "B", leather: "#5b2a22", edge: "#8a4a3a" },
  add: { letter: "A", leather: "#4a3320", edge: "#7d5a37" },
  trim: { letter: "T", leather: "#2f3a4a", edge: "#586a82" },
  sell: { letter: "S", leather: "#3f2a45", edge: "#6e4f78" },
  hold: { letter: "H", leather: "#3b3a2a", edge: "#6c6a46" },
  pass: { letter: "P", leather: "#33302c", edge: "#68625a" },
};
const FALLBACK = { letter: "·", leather: "#33302c", edge: "#68625a" };

export function spineFor(action: string) {
  return ACTION_SPINE[action] ?? FALLBACK;
}

export interface Tome {
  id: string;
  title: string;
  action: string;
  actionWord: string;
  letter: string;
  leather: string;
  edge: string;
  review6: CapsuleState;
  review12: CapsuleState;
  /** True when either review is owed: the tome wears a bookmark ribbon. */
  owed: boolean;
}

export function tomeFor(r: DecisionRecord): Tome {
  const sp = spineFor(r.action);
  const review6 = capsuleState(r.review_6m);
  const review12 = capsuleState(r.review_12m);
  return {
    id: r.id,
    title: r.company_name,
    action: r.action,
    actionWord: actionLabel(r.action),
    letter: sp.letter,
    leather: sp.leather,
    edge: sp.edge,
    review6,
    review12,
    owed: review6 === "unsealed" || review12 === "unsealed",
  };
}

/** Accessible name of a tome button: what it is, when, and which reviews stand where. No outcome. */
export function tomeAria(r: DecisionRecord): string {
  return `${actionLabel(r.action)} ${r.company_name}, ${daysText(r.days_since)}. ${capsuleLabel(6, r.review_6m)}. ${capsuleLabel(12, r.review_12m)}.`;
}

/** The record the reading desk opens first: the first with a review owed, else the first. */
export function defaultOpenId(records: ReadonlyArray<Pick<DecisionRecord, "id" | "review_6m" | "review_12m">>): string | null {
  if (records.length === 0) return null;
  const owed = records.find((r) => r.review_6m === "due" || r.review_12m === "due");
  return (owed ?? records[0]).id;
}

/** Strings the hall prints; budget-checked. */
export const HALL_COPY = {
  subtitle: "Your decision journal, shelved: what you wrote, what the price did, which reviews are owed.",
  press: "Press a tome to open it at the desk.",
  empty: "The shelves are bare. Decisions you log in the Journal are shelved here.",
  noneOwed: "No record has a review owed.",
  onlyOwed: "Only reviews owed",
  keyTitle: "Seals",
} as const;

/** Words of the default view's chrome (subtitle, caption line aside): budget for the hall's own text. */
export const HALL_CHROME_BUDGET = 40;
