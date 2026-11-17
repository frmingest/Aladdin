import { useNear } from "./nearStore";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { PAL, Part } from "./Inked";
import {
  BOARDS,
  BOARD_SIZE,
  BOARD_SLOTS,
  HALL,
  HALL_DOOR,
} from "./townHallRoomLogic";
import type { Board, BoardSlot } from "./townHallRoomLogic";
import { boardHeadline } from "./boardHeadlines";
import { useBoardHeadlines } from "./useBoardHeadlines";
import WorldLabel from "./WorldLabel";

const PLASTER = "#d8c6a4";
const FLOOR = "#7a5638";
const LAMP = "#f2d27a";
const LENGTH_Z = HALL.maxZ - HALL.minZ;
const MID_Z = (HALL.maxZ + HALL.minZ) / 2;
const WIDTH_X = HALL.maxX - HALL.minX;

/** One notice board: a frame, a pale face, a title, a line and, when it is known, one headline number from the flat page's own function. No colour that reads as a verdict. */
function BoardMesh({ board, slot, active, headline }: { board: Board; slot: BoardSlot; active: boolean; headline: string | null }) {
  const { w, h } = BOARD_SIZE;
  return (
    <group position={[slot.x, 0, slot.z]} rotation={[0, slot.yaw, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[w / 2, h / 2, 0.3]} position={[0, 2.2, -0.1]} />
      </RigidBody>
      <Part color={PAL.timberDark} position={[0, 2.2, -0.2]} grow={1.02}>
        <boxGeometry args={[w, h, 0.14]} />
      </Part>
      <mesh position={[0, 2.2, -0.11]}>
        <planeGeometry args={[w - 0.4, h - 0.4]} />
        <meshBasicMaterial color="#a9cfe8" />
      </mesh>
      {([-1, 1] as const).map((s) => (
        <Part key={s} color={PAL.timber} position={[s * (w / 2 - 0.1), 0.9, 0]} grow={1.1}>
          <boxGeometry args={[0.14, 1.8, 0.14]} />
        </Part>
      ))}
      {active && (
        <group position={[0, 2.2, -0.05]}>
          {([-1, 1] as const).map((s) => (
            <mesh key={`v${s}`} position={[s * (w / 2 + 0.08), 0, 0]}>
              <boxGeometry args={[0.08, h + 0.2, 0.08]} />
              <meshBasicMaterial color={LAMP} />
            </mesh>
          ))}
          {([-1, 1] as const).map((s) => (
            <mesh key={`h${s}`} position={[0, s * (h / 2 + 0.06), 0]}>
              <boxGeometry args={[w + 0.24, 0.08, 0.08]} />
              <meshBasicMaterial color={LAMP} />
            </mesh>
          ))}
        </group>
      )}
      <WorldLabel position={[0, 2.2, 0.05]} distanceFactor={9} wrap maxWidth={220}>
          <div className="text-sm font-semibold">{board.title}</div>
          <div className="text-xs opacity-80">{board.line}</div>
          {headline && <div className="tabular mt-1 whitespace-pre-line text-sm font-semibold">{headline}</div>}
        </WorldLabel>
    </group>
  );
}

/**
 * The inside of the Town Hall: one hall, six notice boards, a door. Code-built shapes with the same ink outline
 * as the rest; the room is furniture only and carries no fact. Walls are drawn from inside only (single-sided),
 * so the follow camera can sit outside them without a wall in the way. Nothing animates.
 */
export default function TownHallRoom() {
  // The board you stand at lights up; the one watcher (near.ts) says which.
  const active = useNear("board");
  const headlines = useBoardHeadlines();
  const doorGap = HALL_DOOR.width / 2;
  const sideLen = (WIDTH_X - HALL_DOOR.width) / 2;
  return (
    <group>
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

      {[-6, -1, 4].map((z) => (
        <Part key={z} color={PAL.timberDark} position={[0, HALL.height - 0.25, z]} grow={1.04}>
          <boxGeometry args={[WIDTH_X, 0.4, 0.5]} />
        </Part>
      ))}

      {([-1, 1] as const).map((s) => (
        <Part key={s} color={PAL.timber} position={[s * (HALL_DOOR.width / 4), 1.7, HALL.maxZ - 0.12]} grow={1.04}>
          <boxGeometry args={[HALL_DOOR.width / 2 - 0.05, 3.4, 0.2]} />
        </Part>
      ))}
      <Part color={PAL.iron} position={[0, 1.6, HALL.maxZ - 0.3]} grow={1.2}>
        <torusGeometry args={[0.18, 0.04, 6, 14]} />
      </Part>

      {/* A rug in the middle: furniture, no fact. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -1]} receiveShadow>
        <planeGeometry args={[8, 5]} />
        <meshStandardMaterial color={PAL.tealDark} flatShading />
      </mesh>

      {BOARD_SLOTS.map((slot) => {
        const board = BOARDS.find((b) => b.id === slot.id);
        return board ? <BoardMesh key={slot.id} board={board} slot={slot} active={active === slot.id} headline={boardHeadline(board.id, headlines)} /> : null;
      })}

    </group>
  );
}
