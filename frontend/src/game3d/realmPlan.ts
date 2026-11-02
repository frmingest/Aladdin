/**
 * The Realm post in front of the keep (3D sprint S16, PR 3). Pure data and maths, no three.js and no React.
 *
 * The flat Fortress has a verdict on the whole fortress ("press the Great Keep"): one level, a headline, and the lines
 * behind it. In 3D that is a banner pole in front of the keep. The pennant on it has one fact, the level that
 * `summarizeRealm` (lib/realmVerdict.ts, the same function the flat card uses) already decided, shown by SHAPE and WORD,
 * never by colour alone. Press E and the flat RealmVerdict card opens in a world panel. A second small plate on the
 * pole says the weather in the flat page's own words.
 *
 * This file never works out a level or a weather. An unreadable fortress shows the "unknown" pennant, never a calm one.
 */
import { SPAWN } from "./layout";
import { yawToward } from "./npcs";
import type { RealmLevel } from "../lib/realmVerdict";

/**
 * On the road to the keep door, between the fountain and the keep. Clear of the desk (x = -5.5) and the vault chest
 * (x = 6) by more than both reaches added together, so E never means two things (`realmPlan.test.ts` checks this
 * against every door, the desk, the vault, the fountain, props and scenery).
 */
export const REALM_POST = { x: 0, z: -6 } as const;
export const REALM_FACING = yawToward(REALM_POST, SPAWN);
export const REALM_RANGE = 3.2;
/** Wider to leave than to arrive, so standing on the edge does not flicker. */
export const REALM_LEAVE_RANGE = 4.4;
/** Half the footprint of the pole you walk round. */
export const REALM_SOLID = 0.35;

export type PennantShape = "square" | "triangle" | "disc" | "ring";

/** Shape per level: a square needs a look, a triangle is mixed, a disc has no flags, an open ring does not know. */
const SHAPES: Record<RealmLevel, PennantShape> = {
  attention: "square",
  mixed: "triangle",
  sound: "disc",
  unknown: "ring",
};

/** Never red or green. Shape and the word on the plate carry the meaning; colour only helps. */
const COLORS: Record<RealmLevel, string> = {
  attention: "#e6b93a",
  mixed: "#0ca5b0",
  sound: "#eee4d3",
  unknown: "#a3a6c0",
};

export interface PennantLook {
  shape: PennantShape;
  color: string;
  level: RealmLevel;
}

/** A level that could not be read is "unknown", never "sound". */
export function pennantLook(level: RealmLevel | null | undefined): PennantLook {
  const l: RealmLevel = level ?? "unknown";
  return { shape: SHAPES[l] ?? SHAPES.unknown, color: COLORS[l] ?? COLORS.unknown, level: SHAPES[l] ? l : "unknown" };
}

export function nearRealm(pos: { x: number; z: number }, range: number = REALM_RANGE): boolean {
  return Math.hypot(REALM_POST.x - pos.x, REALM_POST.z - pos.z) <= range;
}
