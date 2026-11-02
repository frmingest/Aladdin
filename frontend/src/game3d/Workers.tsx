import { CylinderCollider, RigidBody } from "@react-three/rapier";
import Avatar from "./Avatar";
import { HeroFigure } from "./Figures";
import { WORKERS } from "./workers";

/**
 * The scribe at the writing desk and the vault keeper at the chest (S20). They play one held clip each
 * (sitting, using an item) and never react to anything: no cheer, no dialogue, no data.
 * If a model file fails to load, a plain shape figure stands in, as for the other people.
 */
export default function Workers() {
  return (
    <>
      {WORKERS.map((w) => (
        <RigidBody key={w.id} type="fixed" colliders={false} position={[w.x, 0, w.z]} rotation={[0, w.facing, 0]}>
          <CylinderCollider args={w.seated ? [0.5, 0.4] : [0.9, 0.5]} position={[0, w.seated ? 0.5 : 0.9, 0]} />
          <Avatar
            id={w.id}
            height={w.height}
            pose={w.pose}
            loadingFallback={null}
            fallback={
              <group scale={w.height / 1.9}>
                <HeroFigure />
              </group>
            }
          />
        </RigidBody>
      ))}
    </>
  );
}
