import { useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { Html } from "@react-three/drei";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { PAL, Part } from "./Inked";
import {
  DOOR_LEAVE_RANGE,
  DOOR_RANGE,
  HALL,
  HALL_DOOR,
  SHELF_LEAVE_RANGE,
  SHELF_RANGE,
  SHELF_SLOTS,
  TABLE_LEAVE_RANGE,
  TABLE_RANGE,
  nearDoor,
  nearTable,
  nearestShelf,
} from "./libraryRoom";
import { describeShelf, shelfMark } from "./libraryShelves";
import type { Shelf, ShelfId } from "./libraryShelves";

const PLASTER = "#d8c6a4";
const FLOOR = "#7a5638";
const MIST = "#dfe5ea";
const LAMP = "#f2d27a";
const BOOK_HEIGHTS = [0.95, 1.05, 0.9, 1.0] as const;
const BOARD_Y = [0.15, 1.3, 2.45] as const;
const BAY_W = 3.6;
const BAY_H = 3.45;

const LENGTH_Z = HALL.maxZ - HALL.minZ;
const MID_Z = (HALL.maxZ + HALL.minZ) / 2;
const WIDTH_X = HALL.maxX - HALL.minX;

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

/** One shelf bay: carcase, up to eight books, mist over it when not surveyed, a gold frame when you stand at it. */
function Bay({ shelf, x, z, yaw, active }: { shelf: Shelf; x: number; z: number; yaw: number; active: boolean }) {
  const books = bookSlots(shelf.books);
  return (
    <RigidBody type="fixed" colliders={false} position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <CuboidCollider args={[BAY_W / 2, BAY_H / 2, 0.4]} position={[0, BAY_H / 2, 0]} />
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
      <Html position={[0, 2.95, 0.45]} center distanceFactor={9} zIndexRange={[10, 0]}>
        <div
          className="pointer-events-none whitespace-nowrap rounded bg-black/65 px-2 py-0.5 text-xs text-white"
          title={describeShelf(shelf)}
        >
          {shelfMark(shelf)} {shelf.title}
        </div>
      </Html>
    </RigidBody>
  );
}

/** Tells the page which shelf you stand at, and whether you stand by the door. Called only when it changes. */
function ReadingWatch({
  pos,
  onShelf,
  onDoor,
  onTable,
  setActive,
}: {
  pos: MutableRefObject<{ x: number; z: number }>;
  onShelf: (id: ShelfId | null) => void;
  onDoor: (near: boolean) => void;
  onTable: (near: boolean) => void;
  setActive: (id: ShelfId | null) => void;
}) {
  const lastShelf = useRef<ShelfId | null>(null);
  const lastDoor = useRef(false);
  const lastTable = useRef(false);
  useFrame(() => {
    const s = nearestShelf(pos.current, SHELF_SLOTS, lastShelf.current ? SHELF_LEAVE_RANGE : SHELF_RANGE);
    const id = s ? s.id : null;
    if (id !== lastShelf.current) {
      lastShelf.current = id;
      onShelf(id);
      setActive(id);
    }
    const d = nearDoor(pos.current, lastDoor.current ? DOOR_LEAVE_RANGE : DOOR_RANGE);
    if (d !== lastDoor.current) {
      lastDoor.current = d;
      onDoor(d);
    }
    const t = nearTable(pos.current, lastTable.current ? TABLE_LEAVE_RANGE : TABLE_RANGE);
    if (t !== lastTable.current) {
      lastTable.current = t;
      onTable(t);
    }
  });
  return null;
}

interface Props {
  name: string;
  ticker: string;
  /** A named gap from the Standing ("no tagged filing"), shown honestly under the name. */
  gap?: string | null;
  shelves: Shelf[];
  pos: MutableRefObject<{ x: number; z: number }>;
  onShelf: (id: ShelfId | null) => void;
  onDoor: (near: boolean) => void;
  onTable: (near: boolean) => void;
}

/**
 * The inside of a holding's tower: one hall, six shelf bays, a door. Plain code-built shapes with the
 * same ink outline as the rest. The room is the same for every holding; only the books differ, and each
 * shelf's books and words come from `shelvesFor`. Walls are drawn from inside only (single-sided), so the
 * follow camera can sit outside them without a wall in the way. Nothing animates.
 */
export default function Library({ name, ticker, gap = null, shelves, pos, onShelf, onDoor, onTable }: Props) {
  const [active, setActive] = useState<ShelfId | null>(null);
  const byId = new Map(shelves.map((s) => [s.id, s]));
  const doorGap = HALL_DOOR.width / 2;
  const sideLen = (WIDTH_X - HALL_DOOR.width) / 2;
  return (
    <group>
      {/* Floor, walls and the closed door: solid for the hero, drawn from inside only. */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[WIDTH_X / 2 + 1, 0.5, LENGTH_Z / 2 + 1]} position={[0, -0.5, MID_Z]} />
        <CuboidCollider args={[WIDTH_X / 2 + 1, HALL.height / 2, 0.5]} position={[0, HALL.height / 2, HALL.minZ - 0.5]} />
        <CuboidCollider args={[0.5, HALL.height / 2, LENGTH_Z / 2 + 1]} position={[HALL.minX - 0.5, HALL.height / 2, MID_Z]} />
        <CuboidCollider args={[0.5, HALL.height / 2, LENGTH_Z / 2 + 1]} position={[HALL.maxX + 0.5, HALL.height / 2, MID_Z]} />
        <CuboidCollider args={[WIDTH_X / 2 + 1, HALL.height / 2, 0.5]} position={[0, HALL.height / 2, HALL.maxZ + 0.5]} />
      </RigidBody>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, MID_Z]} receiveShadow>
        <planeGeometry args={[WIDTH_X, LENGTH_Z]} />
        <meshStandardMaterial color={FLOOR} flatShading />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, HALL.height, MID_Z]}>
        <planeGeometry args={[WIDTH_X, LENGTH_Z]} />
        <meshStandardMaterial color="#8d6b45" flatShading />
      </mesh>
      <mesh position={[0, HALL.height / 2, HALL.minZ]} receiveShadow>
        <planeGeometry args={[WIDTH_X, HALL.height]} />
        <meshStandardMaterial color={PLASTER} flatShading />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]} position={[HALL.minX, HALL.height / 2, MID_Z]} receiveShadow>
        <planeGeometry args={[LENGTH_Z, HALL.height]} />
        <meshStandardMaterial color={PLASTER} flatShading />
      </mesh>
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[HALL.maxX, HALL.height / 2, MID_Z]} receiveShadow>
        <planeGeometry args={[LENGTH_Z, HALL.height]} />
        <meshStandardMaterial color={PLASTER} flatShading />
      </mesh>
      {([-1, 1] as const).map((s) => (
        <mesh key={s} rotation={[0, Math.PI, 0]} position={[s * (doorGap + sideLen / 2), HALL.height / 2, HALL.maxZ]} receiveShadow>
          <planeGeometry args={[sideLen, HALL.height]} />
          <meshStandardMaterial color={PLASTER} flatShading />
        </mesh>
      ))}
      <mesh rotation={[0, Math.PI, 0]} position={[0, (HALL.height + 3.4) / 2, HALL.maxZ]}>
        <planeGeometry args={[HALL_DOOR.width, HALL.height - 3.4]} />
        <meshStandardMaterial color={PLASTER} flatShading />
      </mesh>

      {/* Beams across the ceiling. */}
      {[-6, -1, 4].map((z) => (
        <Part key={z} color={PAL.timberDark} position={[0, HALL.height - 0.25, z]} grow={1.04}>
          <boxGeometry args={[WIDTH_X, 0.4, 0.5]} />
        </Part>
      ))}

      {/* The door: two leaves and a ring. E beside it leads back out. */}
      {([-1, 1] as const).map((s) => (
        <Part key={s} color={PAL.timber} position={[s * (HALL_DOOR.width / 4), 1.7, HALL.maxZ - 0.12]} grow={1.04}>
          <boxGeometry args={[HALL_DOOR.width / 2 - 0.05, 3.4, 0.2]} />
        </Part>
      ))}
      <Part color={PAL.iron} position={[0, 1.6, HALL.maxZ - 0.3]} grow={1.2}>
        <torusGeometry args={[0.18, 0.04, 6, 14]} />
      </Part>
      <Html position={[0, 3.9, HALL.maxZ - 0.3]} center distanceFactor={9} zIndexRange={[10, 0]}>
        <div className="pointer-events-none whitespace-nowrap rounded bg-black/65 px-2 py-0.5 text-xs text-white">Door · back outside</div>
      </Html>

      {/* A rug, a reading table and an open book: furniture, no facts. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -1]} receiveShadow>
        <planeGeometry args={[7, 5]} />
        <meshStandardMaterial color={PAL.tealDark} flatShading />
      </mesh>
      <RigidBody type="fixed" colliders={false} position={[0, 0, -1]}>
        <CuboidCollider args={[1.15, 0.5, 0.6]} position={[0, 0.5, 0]} />
        <Part color={PAL.timberLight} position={[0, 1.0, 0]} grow={1.08}>
          <boxGeometry args={[2.3, 0.12, 1.2]} />
        </Part>
        {([-1, 1] as const).flatMap((sx) =>
          ([-1, 1] as const).map((sz) => (
            <Part key={`${sx}${sz}`} color={PAL.timberDark} position={[sx * 1.0, 0.5, sz * 0.48]} grow={1.25}>
              <boxGeometry args={[0.14, 1, 0.14]} />
            </Part>
          )),
        )}
        <Part color={PAL.cream} position={[0, 1.1, 0]} grow={1.15} ink={false}>
          <boxGeometry args={[0.9, 0.08, 0.6]} />
        </Part>
      </RigidBody>

      {/* The name of the tower, on the north wall between the two bays. */}
      <Part color={PAL.timberDark} position={[0, 3.6, HALL.minZ + 0.04]} grow={1.03}>
        <boxGeometry args={[2.5, 3.3, 0.08]} />
      </Part>
      <mesh position={[0, 3.6, HALL.minZ + 0.1]}>
        <planeGeometry args={[2.1, 2.9]} />
        <meshBasicMaterial color="#a9cfe8" />
      </mesh>
      <Html position={[0, 5.9, HALL.minZ + 0.3]} center distanceFactor={9} zIndexRange={[10, 0]}>
        <div className="pointer-events-none rounded bg-black/70 px-3 py-1 text-center text-white">
          <div className="whitespace-nowrap text-sm font-semibold">{name}</div>
          <div className="text-xs opacity-80">
            {ticker}
            {gap ? ` · Gap: ${gap}` : ""}
          </div>
        </div>
      </Html>

      {SHELF_SLOTS.map((slot) => {
        const shelf = byId.get(slot.id);
        return shelf ? <Bay key={slot.id} shelf={shelf} x={slot.x} z={slot.z} yaw={slot.yaw} active={active === slot.id} /> : null;
      })}

      <ReadingWatch pos={pos} onShelf={onShelf} onDoor={onDoor} onTable={onTable} setActive={setActive} />
    </group>
  );
}
