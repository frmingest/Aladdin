/**
 * The signpost (3D sprint S13). Pure data and maths, no three.js and no React.
 * It stands just inside the gate, a few steps from where you arrive. Press E at it (or G anywhere,
 * or the "Where to?" button) and the menu of places opens. It is furniture: where it stands never
 * depends on a holding, and it carries no fact.
 */
import { yawToward } from "./npcs";

export const SIGNPOST = { x: -5.5, z: 35 } as const;
/** The boards face the gate road, so they are the first thing you see when you arrive. */
export const SIGNPOST_FACING = yawToward(SIGNPOST, { x: 3, z: 45 });

export const SIGN_RANGE = 4.2;
/** Wider to leave than to arrive, so standing on the edge does not flicker. */
export const SIGN_LEAVE_RANGE = 5.6;

export function nearSignpost(pos: { x: number; z: number }, range: number = SIGN_RANGE): boolean {
  return Math.hypot(SIGNPOST.x - pos.x, SIGNPOST.z - pos.z) <= range;
}

/** The key that opens the menu from anywhere (not a walking key, E, P or a panel key). */
export const WHERE_KEY = "KeyG";

/** Words for the little prompt and the menu. Short and playful; no number anywhere. */
export const SIGN_PROMPT = "Press E to see where you can go";
export const WHERE_TITLE = "Where to?";
export const WHERE_HINT = "Pick a place. The page opens right here.";
