import type { FortressTemperamentLevel, FortressVaultLevel, NightWatch, NightWatchState, NightWatchStatus } from "../lib/types";

/**
 * Game-voice layer for the Vault chest, the temperament meter and the Night Watch note in /game3d (text pass 4d).
 * The flat Fortress keeps its own neutral wording (the cards default to `voice="flat"`); the 3D panels pass
 * `voice="game"`. Only words change: every number, state and rule is the card's own. Lines the backend writes
 * (temperament explanations, Night Watch lines) are not touched here; they need a versioned backend wording pass.
 */
export type Voice = "flat" | "game";

export const VAULT_V2 = {
  title: "The Vault",
  noCash: "The chest is empty: no figure yet. Tell me your cash and the gold fills in.",
  inCash: "in the chest",
  shareOf: "of everything you own (cash and portfolio)",
  accountsLine: (withCash: number, total: number, oldest: string | null) =>
    `${withCash} of ${total} accounts have counted their cash${oldest ? `; oldest count ${oldest}` : ""}.`,
  stale: "Some cash counts are over a month old. Count again so the chest is not drawn from an old number.",
  coins: "Coins in the chest",
  coinsNote: "(counted in ounces; no price put on them)",
  demo: "Sample fortress: the cash can't be changed while the sample is on.",
  enter: "Put in cash",
  update: "Count the cash again",
} as const;

export const TEMPER_V2 = {
  title: "Temperament",
  lowConfidence: "Not sure yet",
  restored: "calmed",
  drained: "rattled",
  moved: "What moved the needle",
  fromJournal: "your journal",
  fromSnapshots: "saved looks",
  remodelling: "What changed between the last two looks",
  countsOnly: "Counted, not priced: no fee data to put kroner on it.",
  footerPre: "Only what you write in the",
  footerLink: "decision journal",
  footerPost: "and what saved looks show is read; it can't see feelings. Nothing here blocks or suggests a trade, and trading never earns points.",
} as const;

/** Level labels where the flat one sounds like a system: unknown is fog. Other levels keep the flat label. */
export const VAULT_LABEL_V2: Partial<Record<FortressVaultLevel, string>> = { unsurveyed: "Cash in fog" };
export const TEMPER_LABEL_V2: Partial<Record<FortressTemperamentLevel, string>> = { unsurveyed: "Too little to read" };
export const TEMPER_TEXT_V2: Partial<Record<FortressTemperamentLevel, string>> = {
  composed: "Most of what your journal and saved looks show is patient, written-down deciding.",
  unsurveyed: "Nothing matched a rule yet, so there is no reading. That is not the same as a good one.",
};

export const WATCH_STATUS_V2: Record<NightWatchStatus, string> = {
  attention: "Needs a look",
  quiet: "Quiet night",
  unknown: "The Watch hasn't reported",
};
export const WATCH_STATE_V2: Record<NightWatchState, string> = {
  ok: "The Watch reported on time",
  old: "The Watch's note is old",
  never: "The Watch has never reported",
};
export const WATCH_V2 = {
  loading: "Reading last night's note…",
  demo: "Sample data",
  note: "Just the Watch's note from last night. It never checks by itself and never tells you what to do.",
} as const;

function hoursV2(hours: number | null): string {
  if (hours === null) return "never";
  if (hours < 1) return "under an hour ago";
  if (hours === 1) return "1 hour ago";
  if (hours < 48) return `${hours} hours ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

/** "Last look 3 hours ago · 120 readings saved" (the review's wording for the stamp). */
export function stampLineV2(w: NightWatch): string {
  const parts = [`Last look ${hoursV2(w.watch_age_hours)}`];
  if (w.frames_stored > 0) parts.push(`${w.frames_stored} ${w.frames_stored === 1 ? "reading" : "readings"} saved`);
  return parts.join(" · ");
}

/** Words that sound like a system on the page face of these three cards. */
export const VAULT_WATCH_BANNED = [/\bstored\b/i, /\bsnapshots?\b/i, /\bdispatch\b/i, /\bworker\b/i, /\bframes?\b/i, /\bdemo\b/i, /\bnot entered\b/i, /\bunsurveyed\b/i];
