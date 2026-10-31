import { CylinderCollider, RigidBody } from "@react-three/rapier";
import Avatar from "./Avatar";
import { HeroFigure } from "./Figures";
import { TOWNSFOLK } from "./townsfolk";

/**
 * The townsfolk (S8): a guard and a scout who stand and breathe. No name tag, no dialogue, no data.
 * If a model file fails to load, a plain shape figure stands in, as for the other people.
 */
export default function Townsfolk({ cheerKey = null }: { cheerKey?: number | null }) {
  return (
    <>
      {TOWNSFOLK.map((t) => (
        <RigidBody key={t.id} type="fixed" colliders={false} position={[t.x, 0, t.z]} rotation={[0, t.facing, 0]}>
          <CylinderCollider args={[0.9, 0.5]} position={[0, 0.9, 0]} />
          <Avatar
            id={t.id}
            height={t.height}
            cheerKey={cheerKey}
            fallback={
              <group scale={t.height / 1.9}>
                <HeroFigure />
              </group>
            }
          />
        </RigidBody>
      ))}
    </>
  );
}
