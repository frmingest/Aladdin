/**
 * The check card's slot rule (#494), kept apart from the component so it is tested without a browser and the component file
 * exports components only. Pure: no React, no DOM.
 */
import type { ReactNode } from "react";

export interface CheckChoice {
  id: string;
  label: string;
  /** A small drawing beside the word (the walls check): shape and word carry the meaning, never colour alone. */
  icon?: ReactNode;
  /** Already tried and wrong: its slot stays (so no other choice moves up) but is blank and cannot be picked. */
  tried?: boolean;
}

/** After the choices change (a miss), picks are ignored this long, so a double tap or a second Enter cannot land. */
export const SETTLE_MS = 400;

/**
 * Which choice a key picks, if any: digit n is slot n, always (slots never move). A blank (tried) slot, a held key's repeat,
 * or a pick before the card has settled after a miss picks nothing. Pure, so the rule is tested without a browser.
 */
export function choiceForKey(
  choices: readonly CheckChoice[],
  code: string,
  opts: { repeat: boolean; now: number; settledAt: number },
): CheckChoice | null {
  const n = /^(?:Digit|Numpad)([1-9])$/.exec(code);
  if (!n || opts.repeat || opts.now < opts.settledAt) return null;
  const c = choices[Number(n[1]) - 1];
  return c && !c.tried ? c : null;
}

