import type { QueueReadyHoldingsResult, QueueScope } from "./types";

/**
 * Game mode G11: the Genie of the Lamp. Rubbing the lamp in the corner of the Fortress calls him up
 * and he offers three wishes. The wishes are the same three choices the Analysis queue page offers
 * ("Queue all ready holdings": actual holdings, watchlist, or both) and they make the same call,
 * `POST /analysis/queue/ready-holdings?scope=…`. So a wish only ADDS ROWS TO THE QUEUE. The analysis
 * itself runs later, on the worker on Faiz's PC, on the local model. The genie must never say a
 * result is ready when it is only queued (CLAUDE.md "Status honesty").
 *
 * Wording rules (tests enforce them): original lines, no real person's name or catchphrases; never
 * says buy, sell, trim or invest; no promise of gains; unknown stays unknown (an unknown worker
 * state is not called asleep or awake).
 */

export interface Wish {
  scope: QueueScope;
  /** Short name on the card. */
  title: string;
  /** What it does, in plain words that match the queue page's hint. */
  blurb: string;
  /** A small icon word for the card art. */
  icon: "tower" | "scroll" | "stars";
}

export const WISHES: readonly Wish[] = [
  {
    scope: "holdings",
    title: "Awaken the Towers",
    blurb: "Study every position you actually own. Skips the watchlist.",
    icon: "tower",
  },
  {
    scope: "watchlist",
    title: "Scry the Marketplace",
    blurb: "Study the companies you are following but do not own.",
    icon: "scroll",
  },
  {
    scope: "all",
    title: "The Grand Conjuring",
    blurb: "Everything at once: owned positions and the watchlist together.",
    icon: "stars",
  },
] as const;

export const GENIE_DISCLAIMER =
  "The Genie is an invented character. His magic only places requests in your analysis queue; the analysis runs later on your PC.";

const GREETINGS = [
  "Ahh, who rubs my lamp?! Ten thousand years I slept, and you wake me for a spreadsheet. I love it!",
  "Poof! Your Genie is here! Ask for a mighty conjuring, master, and I shall send it to the workshop.",
  "Careful with the polish, that tickles! Now then: which powerful magic shall we conjure today?",
  "Master! The lamp glows, the smoke curls, the walls are quiet. Name your wish: what shall the analysts study?",
];

export function greeting(seed: number): string {
  return GREETINGS[Math.abs(Math.trunc(seed)) % GREETINGS.length];
}

/** What the genie says while the request is travelling. */
export const CONJURING_LINE = "Abra-cadabra-kaboom! Sending your wish to the queue…";

export const DEMO_LINE =
  "Demo mode is on, so my magic is only scenery today. Switch it off in Settings and I will send real wishes.";

export const WISH_PER_SCOPE: Record<QueueScope, string> = {
  holdings: "the towers you own",
  watchlist: "the companies on your watchlist",
  all: "your towers and your watchlist",
};

export type WishMood = "granted" | "nothing" | "error";

export interface WishOutcome {
  mood: WishMood;
  headline: string;
  lines: string[];
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/**
 * The genie's report after the queue call. `workerOnline` is null when the queue could not be read:
 * then he says he does not know, instead of guessing.
 */
export function summariseWish(
  result: QueueReadyHoldingsResult,
  scope: QueueScope,
  workerOnline: boolean | null,
): WishOutcome {
  const queued = result.queued.length;
  const already = result.already_queued.length;
  const skipped = result.skipped.length;
  const lines: string[] = [];

  if (queued > 0) {
    lines.push(`${plural(queued, "scroll is", "scrolls are")} now waiting in the queue for ${WISH_PER_SCOPE[scope]}.`);
  }
  if (already > 0) {
    lines.push(`${plural(already, "was", "were")} already waiting, so I left ${already === 1 ? "it" : "them"} alone.`);
  }
  if (skipped > 0) {
    lines.push(
      `${plural(skipped, "was", "were")} not ready for study. The queue page says why.`,
    );
  }

  if (queued > 0) {
    if (workerOnline === true) {
      lines.push("The worker on your PC is awake and will start with the oldest scroll. Nothing is analysed yet: the results arrive when it finishes.");
    } else if (workerOnline === false) {
      lines.push("The worker on your PC is asleep. The scrolls wait until you start it (python -m app.worker). Nothing is analysed yet.");
    } else {
      lines.push("I could not see whether the worker on your PC is awake. Nothing is analysed yet; check the queue page.");
    }
    return { mood: "granted", headline: "Your wish is queued!", lines };
  }

  if (already > 0 || skipped > 0) {
    return { mood: "nothing", headline: "Nothing new to conjure", lines };
  }
  return {
    mood: "nothing",
    headline: "Nothing new to conjure",
    lines: [`I found nothing ready to study in ${WISH_PER_SCOPE[scope]}.`],
  };
}

export function errorOutcome(message: string): WishOutcome {
  return {
    mood: "error",
    headline: "The magic fizzled",
    lines: [`Nothing was queued. ${message}`],
  };
}
