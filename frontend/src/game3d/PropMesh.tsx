import { CylinderCollider, RigidBody } from "@react-three/rapier";
import Avatar from "./Avatar";
import { Board, Fountain, Lamp, Perch } from "./PropModels";
import type { Prop, PropKind } from "./props";

const MODEL: Record<PropKind, () => JSX.Element> = { fountain: Fountain, lamp: Lamp, board: Board, perch: Perch };

/** One decoration, a real solid model. Solid at the base, so you walk round it instead of through it. */
export default function PropMesh({ prop }: { prop: Prop }) {
  const Model = MODEL[prop.kind];
  return (
    <RigidBody type="fixed" colliders={false} position={[prop.x, 0, prop.z]}>
      {prop.solid > 0 && <CylinderCollider args={[1, prop.solid]} position={[0, 1, 0]} />}
      <Avatar id={prop.kind} height={prop.height} fallback={<Model />} />
    </RigidBody>
  );
}
