import { useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { Html } from "@react-three/drei";
import { api } from "../lib/api";
import { useCachedQuery } from "../lib/queryCache";
import type { Records } from "../lib/types";
import type { CapsuleState } from "../lib/capsules";
import { PAL, Part } from "./Inked";
import {
  ARCHIVE,
  ARCHIVE_DOOR,
  ARCHIVE_DOOR_LEAVE_RANGE,
  ARCHIVE_DOOR_RANGE,
  BOOK,
  BOOKCASE,
  BOOKCASE_XS,
  ROW_YS,
  SHELF_LEAVE_RANGE,
  SHELF_RANGE,
  bookPlans,
  nearArchiveDoor,
  nearShelves,
  shelfFacts,
  shelfPlate,
} from "./recordsHallRoom";
import type { BookPlan } from "./recordsHallRoom";

const STONE = "#b9b2a4";
const FLOOR = "#6b5a4a";
const WAX = "#7a1f18";
const GOLD = "#d9a93e";
const LENGTH_Z = ARCHIVE.maxZ - ARCHIVE.minZ;
const MID_Z = (ARCHIVE.maxZ + ARCHIVE.minZ) / 2;
const WIDTH_X = ARCHIVE.maxX - ARCHIVE.minX;

/** One small seal on a book's spine. The SHAPE says the state (whole disc, split disc, empty ring); the colour never has to. */
function Seal({ state, x, y, z }: { state: CapsuleState; x: number; y: number; z: number }) {
  const r = 0.085;
  const turn: [number, number, number] = [Math.PI / 2, 0, 0];
  if (state === "opened") {
    return (
      <mesh position={[x, y, z]}>
        <torusGeometry args={[r, 0.02, 5, 12]} />
        <meshBasicMaterial color={GOLD} />
      </mesh>
    );
  }
  if (state === "unsealed") {
    return (
      <group position={[x, y, z]}>
        {([-1, 1] as const).map((s) => (
          <mesh key={s} position={[0, s * 0.02, 0]} rotation={turn}>
            <cylinderGeometry args={[r, r, 0.02, 10, 1, false, s === 1 ? 0 : Math.PI, Math.PI]} />
            <meshBasicMaterial color={WAX} />
          </mesh>
        ))}
      </group>
    );
  }
  return (
    <mesh position={[x, y, z]} rotation={turn}>
      <cylinderGeometry args={[r, r, 0.02, 10]} />
      <meshBasicMaterial color={WAX} />
    </mesh>
  );
}

/** One book: the same box for every decision, leather from the flat Hall's own mapping, a ribbon when a review is owed. */
function Book({ b }: { b: BookPlan }) {
  const { w, h, d } = BOOK;
  return (
    <group position={[b.x, b.y, b.z]}>
      <Part color={b.tome.leather} grow={1.06}>
        <boxGeometry args={[w, h, d]} />
      </Part>
      <mesh position={[0, h / 2 - 0.12, d / 2 + 0.005]}>
        <boxGeometry args={[w - 0.1, 0.03, 0.01]} />
        <meshBasicMaterial color={b.tome.edge} />
      </mesh>
      <Seal state={b.tome.review6} x={-0.1} y={0.02} z={d / 2 + 0.02} />
      <Seal state={b.tome.review12} x={0.1} y={0.02} z={d / 2 + 0.02} />
      {b.tome.owed && (
        <mesh position={[0, -h / 2 - 0.08, d / 2 + 0.01]}>
          <boxGeometry args={[0.1, 0.22, 0.02]} />
          <meshBasicMaterial color={GOLD} />
        </mesh>
      )}
    </group>
  );
}

function Bookcase({ x }: { x: number }) {
  const { w, h, d, z } = BOOKCASE;
  return (
    <group position={[x, 0, z]}>
      <Part color={PAL.timberDark} position={[0, h / 2, -0.05]} grow={1.02}>
        <boxGeometry args={[w, h, d]} />
      </Part>
      {ROW_YS.map((y) => (
        <Part key={y} color={PAL.timber} position={[0, y - 0.03, 0.12]} grow={1.04}>
          <boxGeometry args={[w - 0.2, 0.06, d - 0.1]} />
        </Part>
      ))}
    </group>
  );
}

/** Tells the page whether you stand at the shelves and whether you stand by the door. Only on change. */
function ArchiveWatch({
  pos,
  onShelves,
  onDoor,
}: {
  pos: MutableRefObject<{ x: number; z: number }>;
  onShelves: (near: boolean) => void;
  onDoor: (near: boolean) => void;
}) {
  const lastShelves = useRef(false);
  const lastDoor = useRef(false);
  useFrame(() => {
    const s = nearShelves(pos.current, lastShelves.current ? SHELF_LEAVE_RANGE : SHELF_RANGE);
    if (s !== lastShelves.current) {
      lastShelves.current = s;
      onShelves(s);
    }
    const d = nearArchiveDoor(pos.current, lastDoor.current ? ARCHIVE_DOOR_LEAVE_RANGE : ARCHIVE_DOOR_RANGE);
    if (d !== lastDoor.current) {
      lastDoor.current = d;
      onDoor(d);
    }
  });
  return null;
}

interface Props {
  pos: MutableRefObject<{ x: number; z: number }>;
  onShelves: (near: boolean) => void;
  onDoor: (near: boolean) => void;
}

/**
 * The inside of the Hall of Records: one archive room, three bookcases, one same-size book per decision, a door.
 * Read through the same call as the flat page (`getRecords`); a failed read leaves the shelves bare with the plain
 * plate, never a guess. Code-built shapes with the same ink outline as the rest; walls are drawn from inside only so
 * the follow camera can sit outside them. The room is furniture and carries no fact beyond the books themselves.
 */
export default function RecordsHallRoom({ pos, onShelves, onDoor }: Props) {
  const records = useCachedQuery<Records>("records", () => api.getRecords());
  const list = records.data?.records;
  const books = useMemo(() => (list ? bookPlans(list) : []), [list]);
  const plate = shelfPlate(list ? shelfFacts(list) : null);
  const doorGap = ARCHIVE_DOOR.width / 2;
  const sideLen = (WIDTH_X - ARCHIVE_DOOR.width) / 2;
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[WIDTH_X / 2 + 1, 0.5, LENGTH_Z / 2 + 1]} position={[0, -0.5, MID_Z]} />
        <CuboidCollider args={[WIDTH_X / 2 + 1, ARCHIVE.height / 2, 0.5]} position={[0, ARCHIVE.height / 2, ARCHIVE.minZ - 0.5]} />
        <CuboidCollider args={[0.5, ARCHIVE.height / 2, LENGTH_Z / 2 + 1]} position={[ARCHIVE.minX - 0.5, ARCHIVE.height / 2, MID_Z]} />
        <CuboidCollider args={[0.5, ARCHIVE.height / 2, LENGTH_Z / 2 + 1]} position={[ARCHIVE.maxX + 0.5, ARCHIVE.height / 2, MID_Z]} />
        <CuboidCollider args={[WIDTH_X / 2 + 1, ARCHIVE.height / 2, 0.5]} position={[0, ARCHIVE.height / 2, ARCHIVE.maxZ + 0.5]} />
        {BOOKCASE_XS.map((x) => (
          <CuboidCollider key={x} args={[BOOKCASE.w / 2, BOOKCASE.h / 2, BOOKCASE.d / 2]} position={[x, BOOKCASE.h / 2, BOOKCASE.z]} />
        ))}
      </RigidBody>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, MID_Z]} receiveShadow>
        <planeGeometry args={[WIDTH_X, LENGTH_Z]} />
        <meshStandardMaterial color={FLOOR} flatShading />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, ARCHIVE.height, MID_Z]}>
        <planeGeometry args={[WIDTH_X, LENGTH_Z]} />
        <meshStandardMaterial color="#8d6b45" flatShading />
      </mesh>
      <mesh position={[0, ARCHIVE.height / 2, ARCHIVE.minZ]} receiveShadow>
        <planeGeometry args={[WIDTH_X, ARCHIVE.height]} />
        <meshStandardMaterial color={STONE} flatShading />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]} position={[ARCHIVE.minX, ARCHIVE.height / 2, MID_Z]} receiveShadow>
        <planeGeometry args={[LENGTH_Z, ARCHIVE.height]} />
        <meshStandardMaterial color={STONE} flatShading />
      </mesh>
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[ARCHIVE.maxX, ARCHIVE.height / 2, MID_Z]} receiveShadow>
        <planeGeometry args={[LENGTH_Z, ARCHIVE.height]} />
        <meshStandardMaterial color={STONE} flatShading />
      </mesh>
      {([-1, 1] as const).map((s) => (
        <mesh key={s} rotation={[0, Math.PI, 0]} position={[s * (doorGap + sideLen / 2), ARCHIVE.height / 2, ARCHIVE.maxZ]} receiveShadow>
          <planeGeometry args={[sideLen, ARCHIVE.height]} />
          <meshStandardMaterial color={STONE} flatShading />
        </mesh>
      ))}
      <mesh rotation={[0, Math.PI, 0]} position={[0, (ARCHIVE.height + 3.4) / 2, ARCHIVE.maxZ]}>
        <planeGeometry args={[ARCHIVE_DOOR.width, ARCHIVE.height - 3.4]} />
        <meshStandardMaterial color={STONE} flatShading />
      </mesh>

      {([-1, 1] as const).map((s) => (
        <Part key={s} color={PAL.timber} position={[s * (ARCHIVE_DOOR.width / 4), 1.7, ARCHIVE.maxZ - 0.12]} grow={1.04}>
          <boxGeometry args={[ARCHIVE_DOOR.width / 2 - 0.05, 3.4, 0.2]} />
        </Part>
      ))}
      <Part color={PAL.iron} position={[0, 1.6, ARCHIVE.maxZ - 0.3]} grow={1.2}>
        <torusGeometry args={[0.18, 0.04, 6, 14]} />
      </Part>
      <Html position={[0, 3.9, ARCHIVE.maxZ - 0.3]} center distanceFactor={9} zIndexRange={[10, 0]}>
        <div className="pointer-events-none whitespace-nowrap rounded bg-black/65 px-2 py-0.5 text-xs text-white">Door · back to the Town</div>
      </Html>

      {/* A rug in front of the shelves: furniture, no fact. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, ARCHIVE.minZ + 4.2]} receiveShadow>
        <planeGeometry args={[9, 3.4]} />
        <meshStandardMaterial color={PAL.tealDark} flatShading />
      </mesh>

      {BOOKCASE_XS.map((x) => (
        <Bookcase key={x} x={x} />
      ))}
      {books.map((b) => (
        <Book key={b.id} b={b} />
      ))}

      <Html position={[0, 4.4, ARCHIVE.minZ + 0.9]} center distanceFactor={9} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <div className="rounded bg-black/70 px-3 py-1.5 text-center text-white" style={{ maxWidth: 260 }}>
          {plate.map((line, i) => (
            <div key={line} className={i === 0 ? "text-sm font-semibold" : "text-xs opacity-80"}>
              {line}
            </div>
          ))}
        </div>
      </Html>

      <ArchiveWatch pos={pos} onShelves={onShelves} onDoor={onDoor} />
    </group>
  );
}
