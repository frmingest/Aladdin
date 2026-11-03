import type { RealmLevel, RealmTone } from "../../lib/realmVerdict";

/**
 * Game-voice wording for the whole-fortress card in /game3d (text review 2026-11-03, docs/game/game3d-text-review-2026-11-03.md).
 * The facts and tones still come from `summarizeRealm`; this file only gives each row a short sign and each tone one plain
 * word, so the card can be read at a glance. The long factual sentence stays one tap away ("Show the numbers").
 * The flat Fortress page keeps its own wording (REALM_RULES, titles) untouched.
 */

/** The sign on each row: one or two plain words, no brackets. */
export const REALM_SIGN: Record<string, string> = {
  walls: "Walls",
  moat: "Moats",
  analysis: "Fresh reads",
  thesis: "Your whys",
  land: "Prices",
  weather: "Weather",
  vault: "Cash",
  spread: "Spread",
  temperament: "Your habits",
};

/** What each row's tone says, in one word. Colour is never the only signal: every tone also has a mark. */
export const REALM_TONE_WORD: Record<RealmTone, string> = {
  good: "Fine",
  watch: "Watch",
  bad: "Look now",
  unknown: "Fog",
};

/** The big badge, in plain words (the flat page keeps "No rule flags" and friends). */
export const REALM_LEVEL_WORD: Record<RealmLevel, string> = {
  sound: "Steady",
  mixed: "Mixed",
  attention: "Look now",
  unknown: "Fog",
};

export const REALM_SHOW_NUMBERS = "Show the numbers";
export const REALM_HIDE_NUMBERS = "Hide the numbers";
export const REALM_LOOK_FIRST = "Look at these first";
export const REALM_RULES_OPEN = "How this is decided";
export const REALM_RULES_CLOSE = "Hide";
export const REALM_RULES_LINES = [
  "Needs a look: a wire rang, or a lot sits behind weak walls or has no moat, or the storm is here.",
  "Fog: half or more was never looked at.",
  "Mixed: a little of that, old reads, dear prices, a flagged why, a gathering storm, or restless habits.",
  "Steady: none of the above. That is not a promise, and not advice to buy or sell.",
] as const;
