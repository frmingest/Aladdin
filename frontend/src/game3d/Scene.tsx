import { Fragment, Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import Courtyard from "./Courtyard";
import type { WorldModel } from "./stateToWorld";
import PerfProbe from "./PerfProbe";
import type { PerfStats } from "./PerfProbe";
import Player from "./Player";
import type { Teleport } from "./Player";
import { useKeys } from "./useKeys";
import { useOrbit } from "./useOrbit";
import { LEAVE_RANGE, NPCS, TALK_RANGE, nearestNpc } from "./npcs";
import type { NpcId } from "./npcs";
import NpcMesh from "./NpcMesh";
import PropMesh from "./PropMesh";
import Scenery from "./Scenery";
import Market from "./Market";
import StandingTorches from "./StandingTorches";
import Horizon from "./Horizon";
import Backdrop from "./Backdrop";
import Townsfolk from "./Townsfolk";
import Confetti from "./Confetti";
import Desk from "./Desk";
import { DESK_LEAVE_RANGE, DESK_RANGE, nearDesk } from "./desk";
import { PROPS } from "./props";
import Library from "./Library";
import { ROOM_SPAWN, ROOM_YAW } from "./libraryRoom";
import type { Shelf, ShelfId } from "./libraryShelves";
import { ENTER_LEAVE_REACH, ENTER_REACH, exitCameraYaw, exitSpot, nearestTower } from "./towerDoor";

const SKY = "#cfe3f1";
const HALL_DARK = "#1d1712";
const noop = () => {};

interface Props {
  world: WorldModel;
  onLockChange: (locked: boolean) => void;
  onStats: (s: PerfStats) => void;
  /** Who is close enough to talk to (null: nobody). Called only when it changes. */
  onNear: (id: NpcId | null) => void;
  near: NpcId | null;
  /** Books on the writing desk's shelf: holdings with a reason and a wrong-if line. */
  books?: number;
  /** Tells the page when the hero is at the writing desk. Called only when it changes. */
  onNearDesk?: (near: boolean) => void;
  /** Whose dialogue is open (the Oracle casts while he talks). */
  talking?: NpcId | null;
  /** A new number starts the quest-done cheer and confetti, once. */
  cheerKey?: number | null;
  /** The Standing level (0 to 4); null when it could not be read. One Standing torch burns per level. */
  standingLevel?: number | null;
  /** Called only when it changes: which tower's door you stand at (null: none). */
  onNearTower?: (id: string | null) => void;
  /** The tower library you are in, or null for the courtyard. The courtyard is not drawn while you are inside. */
  room?: RoomView | null;
  onNearShelf?: (id: ShelfId | null) => void;
  onNearDoor?: (near: boolean) => void;
}

export interface RoomView {
  holdingId: string;
  name: string;
  ticker: string;
  gap?: string | null;
  shelves: Shelf[];
}

/** Tells the page when the hero walks up to, or away from, someone. */
function NearNpc({ pos, onNear }: { pos: { current: { x: number; z: number } }; onNear: (id: NpcId | null) => void }) {
  const last = useRef<NpcId | null>(null);
  useFrame(() => {
    // Wider range to leave than to arrive, so standing on the edge doesn't flicker.
    const n = nearestNpc(pos.current, NPCS, last.current ? LEAVE_RANGE : TALK_RANGE);
    const id = n ? n.id : null;
    if (id !== last.current) {
      last.current = id;
      onNear(id);
    }
  });
  return null;
}

/** Tells the page when the hero walks up to, or away from, the writing desk. */
function NearDeskWatch({ pos, onNearDesk }: { pos: { current: { x: number; z: number } }; onNearDesk: (near: boolean) => void }) {
  const last = useRef(false);
  useFrame(() => {
    const now = nearDesk(pos.current, last.current ? DESK_LEAVE_RANGE : DESK_RANGE);
    if (now !== last.current) {
      last.current = now;
      onNearDesk(now);
    }
  });
  return null;
}

/** Tells the page when the hero walks up to, or away from, a tower's door. */
function NearTowerWatch({
  pos,
  world,
  onNearTower,
}: {
  pos: { current: { x: number; z: number } };
  world: WorldModel;
  onNearTower: (id: string | null) => void;
}) {
  const last = useRef<string | null>(null);
  useFrame(() => {
    const t = nearestTower(pos.current, world.towers, last.current ? ENTER_LEAVE_REACH : ENTER_REACH);
    const id = t ? t.holdingId : null;
    if (id !== last.current) {
      last.current = id;
      onNearTower(id);
    }
  });
  return null;
}

function World({
  onLockChange,
  world,
  onNear,
  near,
  talking,
  cheerKey,
  standingLevel,
  books,
  onNearDesk,
  onNearTower,
  room,
  onNearShelf,
  onNearDoor,
}: {
  onLockChange: (locked: boolean) => void;
  world: WorldModel;
  onNear: (id: NpcId | null) => void;
  near: NpcId | null;
  books: number;
  onNearDesk: (near: boolean) => void;
  talking: NpcId | null;
  cheerKey: number | null;
  standingLevel: number | null;
  onNearTower: (id: string | null) => void;
  room: RoomView | null;
  onNearShelf: (id: ShelfId | null) => void;
  onNearDoor: (near: boolean) => void;
}) {
  const keys = useKeys();
  const pos = useRef({ x: 0, z: 0 });
  const orbit = useOrbit(onLockChange);

  // Through a tower door: into the library at its spawn, and back out in front of the same door.
  const [teleport, setTeleport] = useState<Teleport | null>(null);
  const prevRoom = useRef<string | null>(null);
  const count = useRef(0);
  useEffect(() => {
    const id = room ? room.holdingId : null;
    if (id === prevRoom.current) return;
    const left = prevRoom.current;
    prevRoom.current = id;
    if (id) {
      setTeleport({ key: ++count.current, x: ROOM_SPAWN.x, z: ROOM_SPAWN.z, yaw: ROOM_YAW });
    } else if (left) {
      const t = world.towers.find((w) => w.holdingId === left);
      if (t) {
        const out = exitSpot(t.spot, t.radius);
        setTeleport({ key: ++count.current, x: out.x, z: out.z, yaw: exitCameraYaw(t.spot, out) });
      }
    }
  }, [room, world.towers]);

  return (
    <Physics gravity={[0, -25, 0]} timeStep="vary">
      {room ? (
        <Library name={room.name} ticker={room.ticker} gap={room.gap} shelves={room.shelves} pos={pos} onShelf={onNearShelf} onDoor={onNearDoor} />
      ) : (
        <>
          <Backdrop />
          <Horizon />
          <Courtyard world={world} />
          {PROPS.map((p) => (
            <PropMesh key={p.id} prop={p} />
          ))}
          <Scenery />
          <Market />
          <StandingTorches level={standingLevel} />
          <Desk books={books} />
          {NPCS.map((n) => (
            <NpcMesh key={n.id} npc={n} active={near === n.id} playerPos={pos} talking={talking === n.id} cheerKey={cheerKey} />
          ))}
          <Townsfolk cheerKey={cheerKey} />
          <Confetti burstKey={cheerKey} />
          <NearNpc pos={pos} onNear={onNear} />
          <NearDeskWatch pos={pos} onNearDesk={onNearDesk} />
          <NearTowerWatch pos={pos} world={world} onNearTower={onNearTower} />
        </>
      )}
      <Player keys={keys} orbit={orbit} pos={pos} teleport={teleport} cheerKey={cheerKey} />
    </Physics>
  );
}

/**
 * The 3D courtyard canvas. Lighting is deliberately flat and the same
 * everywhere: no spotlight on a "good" tower, nothing that flatters a weak one.
 */
export default function Scene({
  world,
  onLockChange,
  onStats,
  onNear,
  near,
  books = 0,
  onNearDesk = noop,
  talking = null,
  cheerKey = null,
  standingLevel = null,
  onNearTower = noop,
  room = null,
  onNearShelf = noop,
  onNearDoor = noop,
}: Props) {
  const inside = room !== null;
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 60, near: 0.1, far: 400, position: [0, 6, 32] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      tabIndex={0}
      aria-label="3D courtyard. Walk with W A S D, look with the mouse."
    >
      {inside ? (
        <Fragment key="in">
          {/* Indoors: warm and dim, the same everywhere; no shelf is lit more kindly than another. */}
          <color attach="background" args={[HALL_DARK]} />
          <fog attach="fog" args={[HALL_DARK, 28, 70]} />
          <hemisphereLight args={["#ffe9c8", "#5a4430", 1.15]} />
          <directionalLight
            position={[4, 16, 8]}
            intensity={0.9}
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-camera-left={-16}
            shadow-camera-right={16}
            shadow-camera-top={16}
            shadow-camera-bottom={-16}
            shadow-camera-near={1}
            shadow-camera-far={50}
            shadow-bias={-0.0005}
          />
        </Fragment>
      ) : (
        <Fragment key="out">
          <color attach="background" args={[SKY]} />
          <fog attach="fog" args={[SKY, 70, 160]} />
          <hemisphereLight args={["#ffffff", "#9aa88a", 0.9]} />
          <directionalLight
            position={[40, 70, 30]}
            intensity={1.3}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-55}
            shadow-camera-right={55}
            shadow-camera-top={55}
            shadow-camera-bottom={-55}
            shadow-camera-near={1}
            shadow-camera-far={200}
            shadow-bias={-0.0005}
          />
        </Fragment>
      )}
      <Suspense fallback={null}>
        <World
          onLockChange={onLockChange}
          world={world}
          onNear={onNear}
          near={near}
          books={books}
          onNearDesk={onNearDesk}
          talking={talking}
          cheerKey={cheerKey}
          standingLevel={standingLevel}
          onNearTower={onNearTower}
          room={room}
          onNearShelf={onNearShelf}
          onNearDoor={onNearDoor}
        />
      </Suspense>
      <PerfProbe onStats={onStats} />
    </Canvas>
  );
}
