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
import type { PracticeWall } from "./practiceCompanyV1";
import type { Npc } from "./npcs";
import { SIZE_HEIGHT, WALL_LOOK } from "./towerLook";
import { strengthOf } from "./stateToWorld";
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

/** Where you knock on the walls and fill the moat (#494): anywhere round the tower, out to just past the fact cards. */
export const STATION_RANGE = 7.5;
export const STATION_LEAVE_RANGE = 8.5;
export function nearStation(p: { x: number; z: number }, range: number = STATION_RANGE): boolean {
  return Math.hypot(YARD_PAD.x - p.x, YARD_PAD.z - p.z) <= range;
}

/**
 * The notice board with the four fact cards (beat 3): two posts either side of the path with the cards hung between them,
 * above head height, so it is in the middle of the view from the arrival spot on a wide screen and on a portrait phone, and
 * you walk under it. (By the moat the numbers were too small to read; beside the path a phone cut off half the cards.)
 */
export const PLANK_AT = { x: 0, z: 4.8 } as const;
export const PLANK_YAW = yawToward(PLANK_AT, YARD_SPAWN);
/** Card width, the gap between card centres across a row, and the two rows' heights. */
export const FACT_CARD_W = 1.35;
export const FACT_CARD_STEP = 1.45;
export const FACT_CARD_ROWS = [3.2, 2.55] as const;

/**
 * The plate that says the tower's walls and moat in words, west of the path in front of the moat, and far enough west that
 * the notice board's post does not cut it from the arrival view (playtest, #494).
 */
export const TOWER_PLATE_AT = { x: -3.0, z: 1.6 } as const;

/** The reading lectern with the Book of Wisdom, by the gate on the west of the path (#494). */
export const LECTERN_AT = { x: -2.6, z: 11.8 } as const;
// Turned to the tower: you read it walking back towards the gate (its sign has words on both faces).
export const LECTERN_YAW = yawToward(LECTERN_AT, YARD_PAD);
export const LECTERN_RANGE = 1.8;
export const LECTERN_LEAVE_RANGE = 2.6;
export function nearLectern(p: { x: number; z: number }, range: number = LECTERN_RANGE): boolean {
  return Math.hypot(LECTERN_AT.x - p.x, LECTERN_AT.z - p.z) <= range;
}

/** The two looks the checks change (#494): the walls, and the moat. Fog until the player has looked. */
export type YardWall = PracticeWall;
export type YardMoat = typeof PIP.moat | "unsurveyed";

/**
 * The practice tower as the courtyard draws a tower that nobody has looked at yet: the great size (one piece of the only
 * shop is the whole practice fortress), the walls not surveyed (pale, no crenels) and the moat as mist. Beats 3 and 4 turn
 * the fog into what the numbers give (#494): the walls into their real look once the walls check is over, the moat into
 * water at the land's narrow width once the moat check is.
 */
export function practiceTowerView(wall: YardWall = "unsurveyed", moat: YardMoat = "unsurveyed"): TowerView {
  const look = WALL_LOOK[wall];
  const known = wall !== "unsurveyed";
  const moatKnown = moat !== "unsurveyed";
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
    strength: strengthOf(wall),
    crenels: look.crenels,
    cracks: look.cracks,
    // The land's own narrow width (`centreTowerFor`), so the yard's moat looks like a real land's.
    moatWidth: moat === "narrow" ? LAND_TOWER.moatNarrow : 0,
    moatFog: !moatKnown,
    // The body is pale fog until the walls are known; the moat can still be mist after that.
    fog: !known,
    freshness: known ? "fresh" : "unsurveyed",
    flag: "none",
    facts: { size: "great", wall, moat, thesis: "not_analyzed", weightPct: null, wallReason: "Not looked at yet" },
  };
}

/** What the page tells the yard: whether the tower stands, and a new number when it has just been raised (so it rises once). */
export interface PracticeLook {
  standing: boolean;
  /** Sal's card is waiting for the pick: the quest diamond hangs over the counter. */
  counterWaiting: boolean;
  /** Set when the pick happened in this visit: the tower rises instead of simply standing. */
  riseKey: number | null;
  /** Build step 2 (#494): the walls and the moat as the checks left them, and whether the fact cards stand. */
  wall: YardWall;
  moat: YardMoat;
  factCards: boolean;
}

export const NO_PRACTICE: PracticeLook = { standing: false, counterWaiting: false, riseKey: null, wall: "unsurveyed", moat: "unsurveyed", factCards: false };
