/**
 * Touch controls for /game3d (#485, plan `docs/game/game3d-touch-controls-plan-2026-11-22.md`): the pure parts.
 * No React, no DOM events: the stick's maths, the seal's word, the pinch, the hand setting, and the one shared stick
 * value the hero reads every frame (no per-frame React state, the same way the keyboard's `keys` ref works).
 */

/** The stick's whole width in CSS pixels (the plan's 96 px). Its knob travels at most half of it. */
export const STICK_SIZE = 96;
export const STICK_RADIUS = STICK_SIZE / 2;
/** Under this share of the radius the thumb is resting, not pushing: the hero stands. */
export const STICK_DEAD = 0.12;
/** Past this share of the radius the hero runs, so Shift is not needed. */
export const STICK_RUN = 0.85;

/** What the stick says: forward and sideways, each -1 to 1 (length at most 1), and whether it is pushed far enough to run. */
export interface StickInput {
  fwd: number;
  side: number;
  run: boolean;
}

export const NO_STICK: StickInput = { fwd: 0, side: 0, run: false };

/**
 * The thumb's offset from the stick's centre (screen pixels, y down) to a walk. The knob is held inside the rim, so pushing
 * further than the rim is the same as pushing to it. Inside the dead zone the hero stands.
 */
export function stickInput(dx: number, dy: number, radius: number = STICK_RADIUS): StickInput {
  const len = Math.hypot(dx, dy);
  if (radius <= 0 || len / radius < STICK_DEAD) return { ...NO_STICK };
  const share = Math.min(1, len / radius);
  return { side: (dx / len) * share, fwd: (-dy / len) * share, run: share >= STICK_RUN };
}

/** Where the knob is drawn for a thumb offset: the same direction, held inside the rim. */
export function knobOffset(dx: number, dy: number, radius: number = STICK_RADIUS): { x: number; y: number } {
  const len = Math.hypot(dx, dy);
  if (len <= radius || len === 0) return { x: dx, y: dy };
  return { x: (dx / len) * radius, y: (dy / len) * radius };
}

/**
 * Where the stick's centre goes when a thumb lands at (x, y) inside its zone: on the thumb, but never so near an edge that
 * the rose would be cut off.
 */
export function stickCentre(x: number, y: number, zoneWidth: number, zoneHeight: number, radius: number = STICK_RADIUS): { x: number; y: number } {
  const clampTo = (v: number, max: number) => Math.min(Math.max(v, radius), Math.max(radius, max - radius));
  return { x: clampTo(x, zoneWidth), y: clampTo(y, zoneHeight) };
}

/**
 * The one stick value the hero reads every frame (Player.tsx), next to the keyboard's keys. The stick writes it; letting go,
 * a lost touch or the page hiding puts it back to rest, as a key release does.
 */
export const touchStick: StickInput = { ...NO_STICK };

export function setStick(input: StickInput): void {
  touchStick.fwd = input.fwd;
  touchStick.side = input.side;
  touchStick.run = input.run;
}

export function releaseStick(): void {
  setStick(NO_STICK);
}

/**
 * What the seal says for a prompt, or null for no seal. Only an E action gets one, so the seal never promises something E
 * does not do. Three shapes of E prompt are in the game:
 * - "Press E to talk to Barren" gives the word "Talk" and the name "Talk to Barren";
 * - "Press E at the shelves to read the Hall of Records" gives "Read" and "Read the Hall of Records";
 * - "Press E: look 3 years ahead" gives "Look" and "Look 3 years ahead".
 * A verb with "back" keeps it ("Head back", "Step back"): "Head" alone reads as a noun. A note that is not an E action
 * ("Pull a lever first, then STAMP", "Shut while you look back. Press H for today", "Stamping...") gives null.
 */
export function touchAction(prompt: string | null | undefined): { word: string; label: string } | null {
  if (!prompt) return null;
  const m = /^Press E\b:?\s*(.*)$/.exec(prompt.trim());
  if (!m) return null;
  let rest = m[1];
  if (rest.startsWith("to ")) rest = rest.slice(3);
  else if (rest.includes(" to ")) rest = rest.slice(rest.indexOf(" to ") + 4);
  rest = rest.trim();
  if (!rest) return null;
  const label = rest.charAt(0).toUpperCase() + rest.slice(1);
  const words = label.split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}'-]/gu, ""));
  if (!words[0]) return null;
  const word = words[1]?.toLowerCase() === "back" ? `${words[0]} back` : words[0];
  return { word, label };
}

/** The seal's word alone (see `touchAction`). */
export function sealWord(prompt: string | null | undefined): string | null {
  return touchAction(prompt)?.word ?? null;
}

/** The seal's name for a screen reader: the whole action ("Talk to Barren Wuffet"), not just its word. */
export function sealLabel(prompt: string): string {
  return touchAction(prompt)?.label ?? prompt;
}

/** Pinch: how much to move the camera for a change in the distance between two fingers (pixels). Spread is zoom in. */
export const PINCH_SPEED = 0.03;

export function pinchZoom(distance: number, before: number, after: number): number {
  return distance - (after - before) * PINCH_SPEED;
}

/** Which side the stick sits on. Left-handed players put it on the right, and the seal on the left. */
export type StickSide = "left" | "right";

const HAND_KEY = "aladdin.game3d.touchHand.v1";

type Store = Pick<Storage, "getItem" | "setItem">;

function browserStore(): Store | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The saved side, or the default (stick bottom-left). Storage can be missing or throw (private windows). */
export function loadStickSide(store: Store | null = browserStore()): StickSide {
  try {
    return store?.getItem(HAND_KEY) === "right" ? "right" : "left";
  } catch {
    return "left";
  }
}

export function saveStickSide(side: StickSide, store: Store | null = browserStore()): void {
  try {
    store?.setItem(HAND_KEY, side);
  } catch {
    /* the swap still holds for this visit */
  }
}

/** The media query for a touch screen: the main pointer is a finger. A desktop with a mouse never matches it. */
export const TOUCH_QUERY = "(pointer: coarse)";
