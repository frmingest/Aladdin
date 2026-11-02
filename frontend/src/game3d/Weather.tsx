import { useLayoutEffect, useMemo, useRef } from "react";
import { Matrix4, Quaternion, Vector3 } from "three";
import type { InstancedMesh } from "three";
import { cloudSlots } from "./weatherPlan";
import type { WeatherLook } from "./weatherPlan";

/**
 * Storm clouds over the walls (S16, PR 3): flat grey ellipsoids drawn in one call, unlit, so no light in the scene
 * changes. They are fixed in place (nothing drifts, so reduced motion needs nothing) and carry no fact beyond the
 * weather level the backend already decided. Calm skies and mist draw none.
 */
export default function Weather({ look }: { look: WeatherLook }) {
  const slots = useMemo(() => cloudSlots(look.clouds), [look.clouds]);
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const q = new Quaternion();
    slots.forEach((s, i) => {
      m.setMatrixAt(i, new Matrix4().compose(new Vector3(s.x, s.y, s.z), q, new Vector3(s.rx, s.ry, s.rz)));
    });
    m.instanceMatrix.needsUpdate = true;
  }, [slots]);
  if (slots.length === 0) return null;
  return (
    <instancedMesh key={slots.length} ref={ref} args={[undefined, undefined, slots.length]} frustumCulled={false}>
      <sphereGeometry args={[1, 10, 6]} />
      <meshBasicMaterial color={look.cloudColor} toneMapped={false} depthWrite={false} />
    </instancedMesh>
  );
}
