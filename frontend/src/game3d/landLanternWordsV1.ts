/**
 * The survey lanterns in a holding's land: the words (version 1, 2026-11-03). Short, game voice, written for the
 * player's act. A change to any wording that could be shown for real is a NEW version file, never an edit of this one.
 * The check's label and its reason come from `lib/survey.ts`; only the frame around them is written here.
 */
export const LANTERN_WORDS_VERSION = "v1";

export const LANTERN_WORDS = {
  /** On approach: "Press E to read the Analysis fresh lantern". */
  prompt: (label: string) => `Press E to read the lantern: ${label}`,
  /** After E: the label and the survey's own one-line reason. */
  plate: (label: string, reason: string) => `${label}. ${reason}`,
  /** What each look means, in a word or two. */
  lit: "Lit",
  mist: "In fog",
  bare: "Not judged",
} as const;
