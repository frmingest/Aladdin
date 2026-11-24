/**
 * The practice yard's layout (starter level, #493). Pure data and maths: no three.js, no React.
 *
 * The yard reuses a holding land's layout (same gate, same arrival spot, the tower on the same centre pad, the price post in
 * the same corner) with no survey lanterns and no records house, so it adds no new art place. Only one area is drawn at a
 * time, so the yard sits at the origin like a land. Local frame: x east, z south; you arrive at the south gate looking north.
 */
import { GATE_LEAVE_RANGE, GATE_RANGE, GATE_STONE, LAND_GATE, LAND_SPAWN, LAND_TOWER, PRICE_POST, WORKPLACE } from "./holdingLandLogic";
import { NPCS, yawToward } from "./npcs";
import { PIP } from "./practiceCompanyV1";
import type { Npc } from "./npcs";
import { SIZE_HEIGHT, WALL_LOOK } from "./towerLook";
import type { TowerView } from "./stateToWorld";
import type { GuideMark } from "./guideQuests";

/** The ground: the same hedge ring as a land of the small size. */
export const YARD_RADIUS = 17.5;
export const YARD_SPAWN = LAND_SPAWN;
export const YARD_GATE = LAND_GATE;
export const YARD_GATE_RANGE = GATE_RANGE;
export const YARD_GATE_LEAVE_RANGE = GATE_LEAVE_RANGE;
/** The empty pad in the middle, where the tower rises. */
export const YARD_PAD = { x: WORKPLACE.x, z: WORKPLACE.z, r: 2.6 } as const;
export const YARD_STONE = GATE_STONE;
export const YARD_PRICE_POST = PRICE_POST;

/** Sal's practice counter, east of the pad and facing the arrival spot, so it is in view as you come in. */
export const COUNTER_AT = { x: 5, z: 2 } as const;
export const COUNTER_YAW = yawToward(COUNTER_AT, YARD_SPAWN);
export const COUNTER_RANGE = 3.0;
export const COUNTER_LEAVE_RANGE = 4.2;

export function nearCounter(p: { x: number; z: number }, range: number = COUNTER_RANGE): boolean {
  return Math.hypot(COUNTER_AT.x - p.x, COUNTER_AT.z - p.z) <= range;
}

/**
 * Barren and Marlie west of the path, behind the gate stone and in the arrival view (further out they stood off the screen's
 * edge), turned to greet you at the arrival spot. Figures only: in the yard they speak in the plates.
 */
const ADVISOR_AT: Record<Npc["id"], { x: number; z: number }> = {
  oracle: { x: -3.4, z: 5 },
  partner: { x: -5, z: 3.6 },
};
export const YARD_ADVISORS: readonly Npc[] = NPCS.map((n) => {
  const at = ADVISOR_AT[n.id];
  return { ...n, x: at.x, z: at.z, facing: yawToward(at, YARD_SPAWN) };
});

/** The quest diamond over Sal's counter roof (the courtyard's own mark look). */
export const COUNTER_MARK: GuideMark = { key: "practice-counter", x: COUNTER_AT.x, y: 4.1, z: COUNTER_AT.z, size: 1 };

/**
 * The practice tower as the courtyard draws a tower that nobody has looked at yet: the great size (one piece of the only
 * shop is the whole practice fortress), the walls not surveyed (pale, no crenels) and the moat as mist. Beats 3 and 4 turn
 * the fog into what the numbers give; build step 1 stops at the fog.
 */
export function practiceTowerView(): TowerView {
  const look = WALL_LOOK.unsurveyed;
  return {
    slot: 0,
    spot: { x: YARD_PAD.x, z: YARD_PAD.z },
    holdingId: "practice",
    name: PIP.name,
    ticker: "",
    shape: "keep",
    height: Math.min(SIZE_HEIGHT.great, LAND_TOWER.maxHeight),
    radius: LAND_TOWER.radius,
    wallColor: look.color,
    strength: "unknown",
    crenels: look.crenels,
    cracks: look.cracks,
    moatWidth: 0,
    moatFog: true,
    fog: true,
    freshness: "unsurveyed",
    flag: "none",
    facts: { size: "great", wall: "unsurveyed", moat: "unsurveyed", thesis: "not_analyzed", weightPct: null, wallReason: "Not looked at yet" },
  };
}

/** What the page tells the yard: whether the tower stands, and a new number when it has just been raised (so it rises once). */
export interface PracticeLook {
  standing: boolean;
  /** Sal's card is waiting for the pick: the quest diamond hangs over the counter. */
  counterWaiting: boolean;
  /** Set when the pick happened in this visit: the tower rises instead of simply standing. */
  riseKey: number | null;
}

export const NO_PRACTICE: PracticeLook = { standing: false, counterWaiting: false, riseKey: null };
