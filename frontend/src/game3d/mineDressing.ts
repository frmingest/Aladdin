/**
 * The gold mine and the quarry dressings (S26 PR 5). Pure data and maths, no three.js and no React.
 *
 * Both draw the centre of a land from the CONDITION LADDER ALONE (`landCondition`, from the wall tier). The sector only
 * picks the theme (mine or quarry). Nothing else about a holding reaches this file: not the weight, the size class, the
 * margin of safety, the verdict or any gain. So:
 *   - the loose pieces that are always there (gold, stone piles, tools) are a FIXED set per theme, never counted from a value;
 *   - only the ladder fields (lean, gaps, props, loose boards, rubble, patches, crack, trim) change what is drawn, and each
 *     of those never gets smaller as the wall gets worse (tested).
 *
 * Frame: the land's centre is the origin, +z faces the player's gate, one unit is one world unit. The dressing must stay
 * inside radius `DRESSING_RADIUS` so it never reaches the stream band (which starts at STREAM_INNER).
 */
import type { LandCondition } from "./landCondition";
import { STREAM_INNER } from "./landStream";

export type MineTheme = "mine" | "quarry";
export type PieceFile = "own" | "builder";

/** One placed model piece: a top-level node of the theme's own file (or of town-buildings.glb for "builder"). */
export interface Piece {
  file: PieceFile;
  node: string;
  x: number;
  z: number;
  y?: number;
  /** Turn about the up axis, radians. */
  yaw?: number;
  /** Lean about the front-back axis, radians (a lean the ladder asked for). */
  lean?: number;
  scale: number;
}

/** One timber prop, code-built: it leans against the structure; a broken one is short and cracked off. */
export interface Prop {
  x: number;
  z: number;
  broken: boolean;
}

export interface DressingPlan {
  theme: MineTheme;
  pieces: Piece[];
  props: Prop[];
  /** Plain repair patches (code-built light squares). */
  patches: number;
  /** A crack across the front of the main structure (code-built dark bars). */
  crack: boolean;
  /** 0 to 1: the stone footing, the proud part. */
  trim: number;
  /** The code-built stepped cut face (quarry only). */
  cutFace: boolean;
}

/** The dressing must stay inside this radius: the stream band begins at STREAM_INNER. */
export const DRESSING_RADIUS = STREAM_INNER - 0.1;

/** Pieces with no ladder field behind them. The same list for every condition, so a value can never grow them. */
export const FIXED_PIECES: Record<MineTheme, readonly Piece[]> = {
  mine: [
    { file: "own", node: "floor_rocky", x: 0, z: 0, scale: 0.8 },
    { file: "builder", node: "mine", x: 0, z: -0.4, scale: 2.0 },
    { file: "own", node: "ore_gold_nuggets", x: 1.5, z: 1.3, yaw: 0.6, scale: 0.7 },
    { file: "own", node: "ore_gold_large", x: -1.4, z: 1.5, yaw: -0.4, scale: 1.3 },
    { file: "own", node: "wheelbarrow", x: 0.9, z: 1.9, yaw: 0.5, scale: 2.4 },
    { file: "own", node: "lantern", x: -0.7, z: 1.9, scale: 0.6 },
    { file: "own", node: "pickaxe", x: -1.9, z: 0.3, yaw: 1.2, scale: 0.55 },
    { file: "own", node: "shovel", x: 1.9, z: -0.9, yaw: -0.8, scale: 0.5 },
  ],
  quarry: [
    { file: "own", node: "floor_rocks", x: 0, z: 0, scale: 0.8 },
    { file: "own", node: "grindstone", x: 1.4, z: 1.4, yaw: 0.4, scale: 0.5 },
    { file: "own", node: "bricks_stack_small", x: 0.1, z: 1.7, yaw: 0.2, scale: 0.7 },
    { file: "own", node: "wheelbarrow", x: -1.5, z: 1.5, yaw: -0.6, scale: 2.4 },
    { file: "own", node: "mallet", x: -0.8, z: 2.0, yaw: 0.9, scale: 0.6 },
    { file: "own", node: "chisel", x: 0.9, z: 2.0, yaw: 0.2, scale: 0.8 },
  ],
};

/** The two scaffold segments that flank the mine mouth (wall panels, or panels with planks missing). */
const SCAFFOLD_SPOTS: readonly { x: number; z: number; yaw: number }[] = [
  { x: -1.9, z: 0.9, yaw: Math.PI / 2 },
  { x: 1.9, z: 0.9, yaw: -Math.PI / 2 },
];
const SCAFFOLD_SCALE = 0.45;

/** Where fallen pieces lie, in the order they fall. The first `rubble` of them are drawn, so a worse wall never has fewer. */
const MINE_RUBBLE: readonly { node: string; x: number; z: number; scale: number }[] = [
  { node: "stone_chunks_large", x: 0, z: 1.5, scale: 0.55 },
  { node: "rock_B", x: -0.9, z: 1.2, scale: 2.4 },
  { node: "rock_D", x: 0.8, z: 1.0, scale: 2.4 },
  { node: "rock_A", x: 0.4, z: 2.1, scale: 2.4 },
  { node: "rock_B", x: -1.1, z: 1.9, scale: 2.4 },
];
const QUARRY_RUBBLE: readonly { node: string; x: number; z: number; scale: number }[] = [
  { node: "stone_chunks_small", x: -0.2, z: 0.6, scale: 0.7 },
  { node: "rock_B", x: -1.0, z: 0.4, scale: 2.4 },
  { node: "rock_D", x: 0.9, z: 0.8, scale: 2.4 },
  { node: "rock_A", x: 0.3, z: 1.2, scale: 2.4 },
  { node: "rock_B", x: -0.6, z: 1.1, scale: 2.4 },
];

/** Loose planks hanging off the structure; the first `looseBoards` are drawn. */
const LOOSE_SPOTS: readonly { x: number; z: number; yaw: number; lean: number }[] = [
  { x: 1.9, z: 0.2, yaw: 0.4, lean: 0.5 },
  { x: -1.9, z: -0.7, yaw: -0.5, lean: -0.5 },
  { x: 1.0, z: -1.6, yaw: 0.2, lean: 0.6 },
];

const PROP_SPOTS: readonly { x: number; z: number }[] = [
  { x: 2.0, z: -0.3 },
  { x: -2.0, z: -0.6 },
  { x: 1.4, z: -1.5 },
];

const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * What the centre of a mine or quarry land draws for one rung of the ladder. Ghost and neutral never get here (the slot draws
 * them once for every theme), but a condition that is not a rung returns the plain fixed set, undamaged, so a call is safe.
 */
export function mineDressing(theme: MineTheme, c: LandCondition): DressingPlan {
  const isRung = c.state === "rung";
  const lean = isRung ? c.lean : 0;
  const gaps = isRung ? c.gaps : 0;
  const pieces: Piece[] = FIXED_PIECES[theme].map((p) => ({ ...p }));

  if (theme === "mine") {
    // The mine mouth leans a little (a third of the ladder's lean), the scaffold leans the full amount.
    const body = pieces.find((p) => p.node === "mine");
    if (body) body.lean = rad(lean) * 0.3;
    const open = Math.min(SCAFFOLD_SPOTS.length, Math.ceil(gaps / 3));
    SCAFFOLD_SPOTS.forEach((s, i) => {
      pieces.push({ file: "own", node: i < open ? "scaffold_open" : "scaffold_wall", x: s.x, z: s.z, yaw: s.yaw, lean: rad(lean) * (i === 0 ? -1 : 1), scale: SCAFFOLD_SCALE });
    });
  } else {
    // Brick stacks: missing bricks turn a large stack into a medium one, and a medium one into a small one.
    const large = gaps >= 3 ? "bricks_stack_medium" : "bricks_stack_large";
    const medium = gaps >= 6 ? "bricks_stack_small" : "bricks_stack_medium";
    pieces.push({ file: "own", node: large, x: -1.2, z: 0.1, yaw: 0.3, lean: rad(lean), scale: 0.8 });
    pieces.push({ file: "own", node: medium, x: 1.3, z: -0.1, yaw: -0.3, lean: -rad(lean), scale: 0.8 });
  }

  const rubbleList = theme === "mine" ? MINE_RUBBLE : QUARRY_RUBBLE;
  for (const r of rubbleList.slice(0, isRung ? c.rubble : 0)) pieces.push({ file: "own", node: r.node, x: r.x, z: r.z, scale: r.scale });

  const planks = theme === "mine" ? "planks_small" : "planks_medium";
  const plankScale = theme === "mine" ? 0.7 : 0.6;
  for (const s of LOOSE_SPOTS.slice(0, isRung ? c.looseBoards : 0)) pieces.push({ file: "own", node: planks, x: s.x, z: s.z, yaw: s.yaw, lean: s.lean, scale: plankScale });

  const props: Prop[] = PROP_SPOTS.slice(0, isRung ? c.props : 0).map((s, i) => ({ x: s.x, z: s.z, broken: i < c.brokenProps }));

  return {
    theme,
    pieces,
    props,
    patches: isRung ? c.patches : 0,
    crack: isRung && c.crack > 0,
    trim: isRung ? c.trim : 0,
    cutFace: theme === "quarry",
  };
}

/** The most loose pieces and code-built parts one dressing draws, for the draw-call budget (limit 120 for a whole land). */
export function dressingPartCount(p: DressingPlan): number {
  const cutFace = p.cutFace ? 3 : 0;
  const crack = p.crack ? 3 : 0;
  const footing = p.trim > 0 ? 1 : 0;
  return p.pieces.length + p.props.length + p.patches + crack + footing + cutFace;
}
