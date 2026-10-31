import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import Courtyard from "./Courtyard";
import type { WorldModel } from "./stateToWorld";
import PerfProbe from "./PerfProbe";
import type { PerfStats } from "./PerfProbe";
import Player from "./Player";
import { useKeys } from "./useKeys";
import { useOrbit } from "./useOrbit";
import { LEAVE_RANGE, NPCS, TALK_RANGE, nearestNpc } from "./npcs";
import type { NpcId } from "./npcs";
import NpcMesh from "./NpcMesh";
import PropMesh from "./PropMesh";
import Scenery from "./Scenery";
import Horizon from "./Horizon";
import Backdrop from "./Backdrop";
import { PROPS } from "./props";

const SKY = "#cfe3f1";

interface Props {
  world: WorldModel;
  onLockChange: (locked: boolean) => void;
  onStats: (s: PerfStats) => void;
  /** Who is close enough to talk to (null: nobody). Called only when it changes. */
  onNear: (id: NpcId | null) => void;
  near: NpcId | null;
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

function World({
  onLockChange,
  world,
  onNear,
  near,
}: {
  onLockChange: (locked: boolean) => void;
  world: WorldModel;
  onNear: (id: NpcId | null) => void;
  near: NpcId | null;
}) {
  const keys = useKeys();
  const pos = useRef({ x: 0, z: 0 });
  const orbit = useOrbit(onLockChange);
  return (
    <Physics gravity={[0, -25, 0]} timeStep="vary">
      <Backdrop />
      <Horizon />
      <Courtyard world={world} />
      {PROPS.map((p) => (
        <PropMesh key={p.id} prop={p} />
      ))}
      <Scenery />
      {NPCS.map((n) => (
        <NpcMesh key={n.id} npc={n} active={near === n.id} playerPos={pos} />
      ))}
      <Player keys={keys} orbit={orbit} pos={pos} />
      <NearNpc pos={pos} onNear={onNear} />
    </Physics>
  );
}

/**
 * The 3D courtyard canvas. Lighting is deliberately flat and the same
 * everywhere: no spotlight on a "good" tower, nothing that flatters a weak one.
 */
export default function Scene({ world, onLockChange, onStats, onNear, near }: Props) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 60, near: 0.1, far: 400, position: [0, 6, 32] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      tabIndex={0}
      aria-label="3D courtyard. Walk with W A S D, look with the mouse."
    >
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
      <Suspense fallback={null}>
        <World onLockChange={onLockChange} world={world} onNear={onNear} near={near} />
      </Suspense>
      <PerfProbe onStats={onStats} />
    </Canvas>
  );
}
