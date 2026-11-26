/**
 * The wooden carcass of one library shelf bay (#516). Pure data, no three.js and no React: LibraryBay.tsx draws these boxes.
 * Bay-local frame: x across the bay, y up from the floor, z out of the bay towards the reader.
 *
 * No two boxes may share a face that points the same way: two faces in one plane z-fight on the depth buffer and the shelf
 * blinks as the camera moves (the moat ring did the same, #510). So the side panels stand a little proud of the boards
 * (deeper and taller), and the back panel stops inside the top board instead of level with its top.
 */
export const BAY_W = 3.6;
export const BAY_H = 3.45;
/** Height of each board books stand on (the top board is the cap, not a book board). */
export const BOARD_Y = [0.15, 1.3, 2.45] as const;

const BOARD_T = 0.1;
const BOARD_D = 0.8;
const SIDE_W = 0.12;
/** How far the side panels stand proud of the boards, in front/behind and above. */
const SIDE_PROUD = 0.02;
const SIDE_RISE = 0.04;
const BACK_D = 0.1;
const BACK_Z = -0.32;
const CAP_Y = BAY_H - BOARD_T / 2;

export type CarcassTone = "back" | "side" | "board";

export interface CarcassBox {
  key: string;
  tone: CarcassTone;
  /** Centre and full size, bay-local. */
  at: [number, number, number];
  size: [number, number, number];
  /** Ink outline scale (small parts need a bigger number). */
  grow: number;
}

/**
 * The back panel runs from just off the floor to the middle of the top board (never level with its top face), and ends just
 * inside the side panels (never level with the board ends). Both gaps are hidden behind the bottom board and the side panels.
 */
const BACK_BOTTOM = 0.02;
const BACK_H = CAP_Y - BACK_BOTTOM;
const BACK_W = BAY_W - 0.04;

export const BAY_CARCASS: readonly CarcassBox[] = [
  { key: "back", tone: "back", at: [0, BACK_BOTTOM + BACK_H / 2, BACK_Z], size: [BACK_W, BACK_H, BACK_D], grow: 1.02 },
  ...([-1, 1] as const).map(
    (s): CarcassBox => ({
      key: `side${s}`,
      tone: "side",
      at: [s * (BAY_W / 2 - 0.05), (BAY_H + SIDE_RISE) / 2, 0],
      size: [SIDE_W, BAY_H + SIDE_RISE, BOARD_D + 2 * SIDE_PROUD],
      grow: 1.1,
    }),
  ),
  ...[...BOARD_Y, CAP_Y].map(
    (y): CarcassBox => ({ key: `board${y.toFixed(2)}`, tone: "board", at: [0, y, 0], size: [BAY_W, BOARD_T, BOARD_D], grow: 1.05 }),
  ),
];

interface Face {
  axis: 0 | 1 | 2;
  sign: 1 | -1;
  at: number;
  /** The face's extent on the two other axes, as [min, max] pairs in axis order. */
  span: [[number, number], [number, number]];
}

function faces(b: CarcassBox): Face[] {
  const out: Face[] = [];
  for (const axis of [0, 1, 2] as const) {
    const others = ([0, 1, 2] as const).filter((a) => a !== axis);
    const span = others.map((a) => [b.at[a] - b.size[a] / 2, b.at[a] + b.size[a] / 2] as [number, number]) as Face["span"];
    for (const sign of [1, -1] as const) out.push({ axis, sign, at: b.at[axis] + (sign * b.size[axis]) / 2, span });
  }
  return out;
}

const EPS = 1e-6;

function overlaps(a: [number, number], b: [number, number]): boolean {
  return Math.min(a[1], b[1]) - Math.max(a[0], b[0]) > EPS;
}

/** Pairs of boxes with two faces in one plane, pointing the same way, overlapping by some area: those faces z-fight. */
export function coplanarClashes(boxes: readonly CarcassBox[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      for (const fa of faces(boxes[i])) {
        for (const fb of faces(boxes[j])) {
          if (fa.axis !== fb.axis || fa.sign !== fb.sign || Math.abs(fa.at - fb.at) > EPS) continue;
          if (overlaps(fa.span[0], fb.span[0]) && overlaps(fa.span[1], fb.span[1])) {
            out.push(`${boxes[i].key}/${boxes[j].key} ${"xyz"[fa.axis]}${fa.sign > 0 ? "+" : "-"}`);
          }
        }
      }
    }
  }
  return out;
}
