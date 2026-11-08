import { useMemo } from "react";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { PAL, Part } from "./Inked";
import StaticBatch from "./StaticBatch";
import { describeShelf, shelfMark } from "./libraryShelves";
import type { Shelf } from "./libraryShelves";
import WorldLabel from "./WorldLabel";

const MIST = "#dfe5ea";
const LAMP = "#f2d27a";
const BOOK_HEIGHTS = [0.95, 1.05, 0.9, 1.0] as const;
const BOARD_Y = [0.15, 1.3, 2.45] as const;
const BAY_W = 3.6;
const BAY_H = 3.45;

const GOLD = "#d6b35a";
/** Fixed by slot, never by data. No red or green: a cover colour must not read as a verdict. */
const COVERS = [PAL.teal, "#34456b", "#7a4a2b", PAL.slateDark, "#6a4a6e", "#b9a98a"] as const;
const BOOK_WIDTHS = [0.42, 0.5, 0.38, 0.46] as const;
const SPINE_DEPTH = 0.56;

export interface BookSlot {
  key: number;
  /** Centre across the bay, and the board it stands on. */
  x: number;
  y: number;
  w: number;
  h: number;
  lean: number;
}

/**
 * Books packed from the left of each board with a hair of gap, in uneven widths and heights, and the last
 * book of a half-full board leaning. Fixed by position, so they carry no fact of their own; how many
 * stand there is the fact.
 */
function bookSlots(count: number): BookSlot[] {
  const slots: BookSlot[] = [];
  for (let row = 0; row < 2; row++) {
    const inRow = Math.max(0, Math.min(4, count - row * 4));
    let cursor = -1.5;
    for (let col = 0; col < inRow; col++) {
      const i = row * 4 + col;
      const w = BOOK_WIDTHS[(col + row) % 4];
      const h = BOOK_HEIGHTS[(col * 3 + row) % 4];
      const last = col === inRow - 1 && inRow < 4;
      slots.push({ key: i, x: cursor + w / 2 + (last ? 0.06 : 0), y: BOARD_Y[row] + 0.05, w, h, lean: last ? -0.16 : 0 });
      cursor += w + 0.03;
    }
  }
  return slots;
}

/** One book: a rounded cover, a cream edge of pages along the top, and two gold bands on the spine. */
function Book({ b }: { b: BookSlot }) {
  const geo = useMemo(() => new RoundedBoxGeometry(b.w, b.h, SPINE_DEPTH, 2, 0.04), [b.w, b.h]);
  return (
    <group position={[b.x, b.y, 0.05]} rotation={[0, 0, b.lean]}>
      <group position={[0, b.h / 2, 0]}>
        <Part color={COVERS[b.key % COVERS.length]} grow={1.07}>
          <primitive object={geo} attach="geometry" />
        </Part>
        <Part color={PAL.cream} position={[0, b.h / 2 + 0.005, -0.03]} ink={false}>
          <boxGeometry args={[b.w - 0.1, 0.03, SPINE_DEPTH - 0.14]} />
        </Part>
        {([-1, 1] as const).map((s) => (
          <Part key={s} color={GOLD} position={[0, s * b.h * 0.3, SPINE_DEPTH / 2 + 0.004]} ink={false}>
            <boxGeometry args={[b.w + 0.01, 0.05, 0.015]} />
          </Part>
        ))}
      </group>
    </group>
  );
}

/**
 * One shelf bay: carcase, up to eight books, mist over it when not surveyed, a gold frame when you stand at it.
 * `scale` draws the same bay smaller (the records house uses 0.75); the books and words never change with it.
 */
export function Bay({ shelf, x, z, yaw, active, scale = 1 }: { shelf: Shelf; x: number; z: number; yaw: number; active: boolean; scale?: number }) {
  const books = bookSlots(shelf.books);
  return (
    <RigidBody type="fixed" colliders={false} position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <CuboidCollider args={[(BAY_W / 2) * scale, (BAY_H / 2) * scale, 0.4 * scale]} position={[0, (BAY_H / 2) * scale, 0]} />
      <group scale={scale}>
        {/* The carcass and the books are still; the books are the fact, so the batch is rebuilt when their number changes. */}
        <StaticBatch rebuildKey={shelf.books}>
        <Part color={PAL.timberDark} position={[0, BAY_H / 2, -0.32]} grow={1.02}>
          <boxGeometry args={[BAY_W, BAY_H, 0.1]} />
        </Part>
        {([-1, 1] as const).map((s) => (
          <Part key={s} color={PAL.timber} position={[s * (BAY_W / 2 - 0.05), BAY_H / 2, 0]} grow={1.1}>
            <boxGeometry args={[0.12, BAY_H, 0.8]} />
          </Part>
        ))}
        {[...BOARD_Y, BAY_H - 0.05].map((y) => (
          <Part key={y} color={PAL.timberLight} position={[0, y, 0]} grow={1.05}>
            <boxGeometry args={[BAY_W, 0.1, 0.8]} />
          </Part>
        ))}
        {books.map((b) => (
          <Book key={b.key} b={b} />
        ))}
        </StaticBatch>
        {shelf.state === "unknown" && (
          <mesh position={[0, 1.4, 0.45]}>
            <boxGeometry args={[BAY_W - 0.3, 2.5, 0.06]} />
            <meshStandardMaterial color={MIST} transparent opacity={0.6} />
          </mesh>
        )}
        {active && (
          <group position={[0, BAY_H / 2, 0.5]}>
            {([-1, 1] as const).map((s) => (
              <mesh key={`v${s}`} position={[s * (BAY_W / 2 + 0.08), 0, 0]}>
                <boxGeometry args={[0.08, BAY_H + 0.2, 0.08]} />
                <meshBasicMaterial color={LAMP} />
              </mesh>
            ))}
            {([-1, 1] as const).map((s) => (
              <mesh key={`h${s}`} position={[0, s * (BAY_H / 2 + 0.06), 0]}>
                <boxGeometry args={[BAY_W + 0.24, 0.08, 0.08]} />
                <meshBasicMaterial color={LAMP} />
              </mesh>
            ))}
          </group>
        )}
        <WorldLabel position={[0, 2.95, 0.45]} distanceFactor={9} title={describeShelf(shelf)}>
            {shelfMark(shelf)} {shelf.title}
          </WorldLabel>
      </group>
    </RigidBody>
  );
}
