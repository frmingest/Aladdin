import type { StoreLevel } from "./marketplace";
import type { Mood } from "./salesRep";
import type { ObjectArtId } from "./stitchArt";

/**
 * Marketplace pictures (Design Master Sprint 5, art mode only). Pure choices, no drawing:
 *  - which of the four stalls a company gets (a stable hash of its id: decoration, never data);
 *  - which Sal bust goes with a mood.
 * The stall picture carries no fact. The tone of a store stays in the plate edge and the printed
 * tag (decision 6a, 2026-10-11); the SVG awning is the fallback.
 */

export const STALL_ART_IDS = ["stall-smithy", "stall-armoury", "stall-provisions", "booth-goods"] as const satisfies readonly ObjectArtId[];

/** FNV-1a: small, stable across loads and browsers, no dependency. */
function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** The same company always gets the same stall, whatever the order of the street. */
export function stallArtId(holdingId: string): (typeof STALL_ART_IDS)[number] {
  return STALL_ART_IDS[hash32(holdingId) % STALL_ART_IDS.length]!;
}

/** Sal's busts by mood: all four moods have a Stitch bust since Sprint 6. */
const SAL_BUST: Partial<Record<Mood, ObjectArtId>> = {
  pitch: "sal-pitch",
  oops: "sal-oops",
  think: "sal-think",
  cheer: "sal-cheer",
};

export function salBustId(mood: Mood): ObjectArtId | null {
  return SAL_BUST[mood] ?? null;
}

/**
 * The shopkeeper's face for a store verdict. Four faces exist (Sprint 6): thoughtful = wait,
 * level gaze = promising, raised hand = pass, shrug = unknown. "ready" has no face yet (it needs a
 * smiling one), so it stays the SVG merchant. The face is the merchant's mood, never the tone
 * colour: the verdict is still written on the page beside it.
 */
const SHOPKEEPER_FACE: Partial<Record<StoreLevel, ObjectArtId>> = {
  promising: "shopkeeper-promising",
  wait: "shopkeeper-wait",
  pass: "shopkeeper-pass",
  unknown: "shopkeeper-unknown",
};

export function shopkeeperFaceId(level: StoreLevel): ObjectArtId | null {
  return SHOPKEEPER_FACE[level] ?? null;
}
