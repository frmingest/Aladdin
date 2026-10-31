import { CylinderCollider, RigidBody } from "@react-three/rapier";
import { PAL, Part } from "./Inked";
import { BEAM_Y, GATE_TORCHES, POST_HEIGHT, POST_X, POST_Z, torchesLit } from "./gateTorchData";
import type { GateTorch } from "./gateTorchData";

/** Flames are flat-lit meshes (no new lights), so the frame rate is untouched. */
function Bowl({ torch, lit }: { torch: GateTorch; lit: boolean }) {
  return (
    <group position={[torch.x, torch.y, torch.z]}>
      <Part color={PAL.iron} position={[0, -0.12, 0]} grow={1.12}>
        <cylinderGeometry args={[0.42, 0.26, 0.28, 8]} />
      </Part>
      {lit ? (
        <group>
          <mesh position={[0, 0.42, 0]}>
            <coneGeometry args={[0.3, 0.95, 7]} />
            <meshBasicMaterial color="#ff9d2e" />
          </mesh>
          <mesh position={[0, 0.3, 0]}>
            <coneGeometry args={[0.16, 0.55, 7]} />
            <meshBasicMaterial color="#fff3b0" />
          </mesh>
        </group>
      ) : (
        // Cold: a bare dark disc in the bowl, no flame standing.
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.34, 0.34, 0.04, 8]} />
          <meshBasicMaterial color={PAL.void} />
        </mesh>
      )}
    </group>
  );
}

/** The gate frame with its three torches. `level` is the Standing level, 0 to 3. */
export default function GateTorches({ level }: { level: number }) {
  const lit = torchesLit(level);
  return (
    <group>
      {[-POST_X, POST_X].map((x) => (
        <RigidBody key={x} type="fixed" colliders={false} position={[x, 0, POST_Z]}>
          <CylinderCollider args={[POST_HEIGHT / 2, 0.45]} position={[0, POST_HEIGHT / 2, 0]} />
          <Part color={PAL.slate} position={[0, 0.3, 0]} grow={1.04}>
            <cylinderGeometry args={[0.8, 0.9, 0.6, 10]} />
          </Part>
          <Part color={PAL.timber} position={[0, POST_HEIGHT / 2, 0]} grow={1.06}>
            <cylinderGeometry args={[0.28, 0.36, POST_HEIGHT, 8]} />
          </Part>
        </RigidBody>
      ))}
      {/* Cross beam over the road, high enough to walk under. */}
      <Part color={PAL.timberLight} position={[0, BEAM_Y, POST_Z]} grow={1.04}>
        <boxGeometry args={[POST_X * 2 + 0.8, 0.4, 0.5]} />
      </Part>
      {/* Chain for the hanging lantern. */}
      <Part color={PAL.iron} position={[0, BEAM_Y - 0.5, POST_Z]} grow={1.3}>
        <cylinderGeometry args={[0.04, 0.04, 0.8, 5]} />
      </Part>
      {GATE_TORCHES.map((t, i) => (
        <Bowl key={t.id} torch={t} lit={lit[i]} />
      ))}
    </group>
  );
}
