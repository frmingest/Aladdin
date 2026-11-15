/**
 * Today's round, the words (Morning Round step 3, #412). Game voice: short, plain, player verbs. One line per stop, six
 * words or fewer. No buy or sell wording, no points, no streaks. "All quiet" is only ever said when every source was read
 * (`quietLine` is the only place that says it, and `round.ts` gates it).
 */
export const ROUND_TITLE = "Today's round";
export const ROUND_MAX_WORDS = 6;
/** Under the title in the sample fortress, and the button that resets the sample's ticks. */
export const ROUND_SAMPLE = "Made-up round. Tick it off.";
export const ROUND_AGAIN = "Start again";

export const ROUND_WORDS = {
  smoke: (name: string) => `Smoke at ${name}`,
  raven: (name: string) => `A raven for ${name}`,
  bell: (name: string) => `Bell: ${name} is due a look`,
  lamp: (ticker: string) => `Lamp lit at the ${ticker} stall`,
  /** No ticker and no name to say. */
  lampPlain: "A lamp is lit",
  notice: "A notice at the watch post",
  /** A holding we cannot name (it has no tower and no stall). */
  someone: "a holding",
  more: (n: number) => `and ${n} more`,
  /** Said beside a stop that has no room in the yard, so no walk target. */
  offYard: "No room",
  doneSr: "done",
  todoSr: "to do",
  /** Spoken count of open stops. */
  openSr: (n: number) => (n === 1 ? "1 stop to do" : `${n} stops to do`),
  /** All stops dealt with. */
  allDone: "Round done. Nothing left.",
} as const;

/** Said only when every source was read and nothing is open. `since` is a weekday name, or null on a first visit. */
export function quietLine(since: string | null, sameDay: boolean, longGap = false): string {
  if (since === null) return "All quiet. Nothing to do.";
  if (sameDay) return "All quiet today. Nothing to do.";
  if (longGap) return "All quiet for a while. Nothing to do.";
  return `All quiet since ${since}. Nothing to do.`;
}

/** A source that did not report: fog in words, never calm. */
export const UNREAD_LINE = {
  watch: "The watch did not report in",
  wires: "The wires were not read",
  ravens: "The ravens did not report in",
  stalls: "Some stalls have no fresh price",
  thesis: "Some holdings are not read yet",
} as const;

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
