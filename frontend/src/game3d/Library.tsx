import { useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { PAL, Part } from "./Inked";
import { Bay } from "./LibraryBay";
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
import type { Shelf, ShelfId } from "./libraryShelves";
import WorldLabel from "./WorldLabel";

const PLASTER = "#d8c6a4";
const FLOOR = "#7a5638";
const LENGTH_Z = HALL.maxZ - HALL.minZ;
const MID_Z = (HALL.maxZ + HALL.minZ) / 2;
const WIDTH_X = HALL.maxX - HALL.minX;

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
      <WorldLabel position={[0, 3.9, HALL.maxZ - 0.3]} distanceFactor={9}>Door · back outside</WorldLabel>

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
      <WorldLabel position={[0, 5.9, HALL.minZ + 0.3]} distanceFactor={9}>
          <div className="whitespace-nowrap text-sm font-semibold">{name}</div>
          <div className="text-xs opacity-80">
            {ticker}
            {gap ? ` · Gap: ${gap}` : ""}
          </div>
        </WorldLabel>

      {SHELF_SLOTS.map((slot) => {
        const shelf = byId.get(slot.id);
        return shelf ? <Bay key={slot.id} shelf={shelf} x={slot.x} z={slot.z} yaw={slot.yaw} active={active === slot.id} /> : null;
      })}

      <ReadingWatch pos={pos} onShelf={onShelf} onDoor={onDoor} onTable={onTable} setActive={setActive} />
    </group>
  );
}
