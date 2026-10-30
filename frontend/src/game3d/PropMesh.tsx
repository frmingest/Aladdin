import { CylinderCollider, RigidBody } from "@react-three/rapier";
import Sprite from "./Billboard";
import type { Prop } from "./props";

/** One decoration. Solid at the base, so you walk round it instead of through it. */
export default function PropMesh({ prop }: { prop: Prop }) {
  return (
    <RigidBody type="fixed" colliders={false} position={[prop.x, 0, prop.z]}>
      {prop.solid > 0 && <CylinderCollider args={[1, prop.solid]} position={[0, 1, 0]} />}
      <Sprite art={prop.art} height={prop.height} />
    </RigidBody>
  );
}
