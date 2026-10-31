import { Component, Suspense, useMemo } from "react";
import type { ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { Euler, InstancedMesh, Matrix4, Mesh, Quaternion, Vector3 } from "three";
import type { Object3D } from "three";
import { wallSegments } from "./layout";
import { HORIZON, HORIZON_LIMIT, HORIZON_URL } from "./horizonPieces";
import type { HorizonModel, HorizonPiece } from "./horizonPieces";

/** If the horizon file fails to load, draw and collide with nothing: the courtyard stays as it was. */
class HorizonBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("3D horizon failed to load, leaving it out:", error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** One model, drawn once for all of its places: each repeated piece costs one draw call, not one per tree. */
function useInstanced(source: Object3D, model: HorizonModel, pieces: HorizonPiece[]): InstancedMesh[] {
  return useMemo(() => {
    const holder = source.getObjectByName(model);
    if (!holder || pieces.length === 0) return [];
    holder.updateWorldMatrix(true, true);
    const toHolder = new Matrix4().copy(holder.matrixWorld).invert();
    const out: InstancedMesh[] = [];
    holder.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const local = new Matrix4().multiplyMatrices(toHolder, o.matrixWorld);
      const inst = new InstancedMesh(o.geometry, o.material, pieces.length);
      const place = new Matrix4();
      const q = new Quaternion();
      pieces.forEach((p, i) => {
        q.setFromEuler(new Euler(0, p.yaw, 0));
        place.compose(new Vector3(p.x, 0, p.z), q, new Vector3(p.scale, p.scale, p.scale));
        inst.setMatrixAt(i, place.clone().multiply(local));
      });
      inst.instanceMatrix.needsUpdate = true;
      // Far scenery: no shadows (the shadow map only reaches 55 units), and the whole ring is cheap to draw.
      inst.castShadow = false;
      inst.receiveShadow = false;
      inst.frustumCulled = false;
      out.push(inst);
    });
    return out;
  }, [source, model, pieces]);
}

function Group({ source, model, pieces }: { source: Object3D; model: HorizonModel; pieces: HorizonPiece[] }) {
  const meshes = useInstanced(source, model, pieces);
  return (
    <>
      {meshes.map((m) => (
        <primitive key={m.uuid} object={m} />
      ))}
    </>
  );
}

function Pieces() {
  const gltf = useGLTF(HORIZON_URL);
  const byModel = useMemo(() => {
    const map = new Map<HorizonModel, HorizonPiece[]>();
    for (const p of HORIZON) map.set(p.model, [...(map.get(p.model) ?? []), p]);
    return [...map.entries()];
  }, []);
  const solids = useMemo(() => HORIZON.filter((p) => p.solid > 0), []);
  const ring = useMemo(() => wallSegments(HORIZON_LIMIT, 48, 0), []);
  return (
    <>
      {byModel.map(([model, pieces]) => (
        <Group key={model} source={gltf.scene} model={model} pieces={pieces} />
      ))}
      {/* Trunks and boulders you walk round, and the invisible edge of the meadow. */}
      <RigidBody type="fixed" colliders={false}>
        {solids.map((p) => (
          <CuboidCollider key={p.id} args={[p.solid, 3, p.solid]} position={[p.x, 3, p.z]} rotation={[0, p.yaw, 0]} />
        ))}
        {ring.map((s, i) => (
          <CuboidCollider key={i} args={[s.length / 2, 15, 0.5]} position={[s.x, 15, s.z]} rotation={[0, s.rotY, 0]} />
        ))}
      </RigidBody>
    </>
  );
}

/** Trees, boulders, foothills and mountains round the meadow. Scenery only; no piece shows any data. */
export default function Horizon() {
  return (
    <HorizonBoundary>
      <Suspense fallback={null}>
        <Pieces />
      </Suspense>
    </HorizonBoundary>
  );
}
