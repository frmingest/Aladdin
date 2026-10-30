import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import Courtyard from "./Courtyard";
import PerfProbe from "./PerfProbe";
import type { PerfStats } from "./PerfProbe";
import Player from "./Player";
import { useKeys } from "./useKeys";
import { useOrbit } from "./useOrbit";

const SKY = "#cfe3f1";

interface Props {
  onLockChange: (locked: boolean) => void;
  onStats: (s: PerfStats) => void;
}

function World({ onLockChange }: { onLockChange: (locked: boolean) => void }) {
  const keys = useKeys();
  const orbit = useOrbit(onLockChange);
  return (
    <Physics gravity={[0, -25, 0]} timeStep="vary">
      <Courtyard />
      <Player keys={keys} orbit={orbit} />
    </Physics>
  );
}

/**
 * The 3D courtyard canvas. Lighting is deliberately flat and the same
 * everywhere: no spotlight on a "good" tower, nothing that flatters a weak one.
 */
export default function Scene({ onLockChange, onStats }: Props) {
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
        <World onLockChange={onLockChange} />
      </Suspense>
      <PerfProbe onStats={onStats} />
    </Canvas>
  );
}
