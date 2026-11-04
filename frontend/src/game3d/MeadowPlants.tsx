import { Component, Suspense, useMemo } from "react";
import type { ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { Euler, InstancedMesh, Matrix4, Mesh, Quaternion, Vector3 } from "three";
import type { Object3D } from "three";
import { FOREST_URL, PLANTS } from "./meadowPlants";
import type { Plant, PlantModel } from "./meadowPlants";

/** If the forest file fails to load, draw and collide with nothing: the meadow stays as it was. */
class PlantsBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("3D meadow plants failed to load, leaving them out:", error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** One model, drawn once for all of its places: each model costs one draw call per mesh, not one per plant. */
function useInstanced(source: Object3D, model: PlantModel, plants: Plant[]): InstancedMesh[] {
  return useMemo(() => {
    const holder = source.getObjectByName(model);
    if (!holder || plants.length === 0) return [];
    holder.updateWorldMatrix(true, true);
    const toHolder = new Matrix4().copy(holder.matrixWorld).invert();
    const out: InstancedMesh[] = [];
    holder.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const local = new Matrix4().multiplyMatrices(toHolder, o.matrixWorld);
      const inst = new InstancedMesh(o.geometry, o.material, plants.length);
      const place = new Matrix4();
      const q = new Quaternion();
      plants.forEach((p, i) => {
        q.setFromEuler(new Euler(0, p.yaw, 0));
        place.compose(new Vector3(p.x, 0, p.z), q, new Vector3(p.scale, p.scale, p.scale));
        inst.setMatrixAt(i, place.clone().multiply(local));
      });
      inst.instanceMatrix.needsUpdate = true;
      // Far scenery: no shadows (the shadow map only reaches 55 units), and it never moves.
      inst.castShadow = false;
      inst.receiveShadow = false;
      inst.frustumCulled = false;
      out.push(inst);
    });
    return out;
  }, [source, model, plants]);
}

function Group({ source, model, plants }: { source: Object3D; model: PlantModel; plants: Plant[] }) {
  const meshes = useInstanced(source, model, plants);
  return (
    <>
      {meshes.map((m) => (
        <primitive key={m.uuid} object={m} />
      ))}
    </>
  );
}

function Pieces() {
  const gltf = useGLTF(FOREST_URL);
  const byModel = useMemo(() => {
    const map = new Map<PlantModel, Plant[]>();
    for (const p of PLANTS) map.set(p.model, [...(map.get(p.model) ?? []), p]);
    return [...map.entries()];
  }, []);
  const solids = useMemo(() => PLANTS.filter((p) => p.solid > 0), []);
  return (
    <>
      {byModel.map(([model, plants]) => (
        <Group key={model} source={gltf.scene} model={model} plants={plants} />
      ))}
      {/* Trunks and boulders you walk round. Bushes and tufts have none. */}
      <RigidBody type="fixed" colliders={false}>
        {solids.map((p) => (
          <CuboidCollider key={p.id} args={[p.solid, 3, p.solid]} position={[p.x, 3, p.z]} rotation={[0, p.yaw, 0]} />
        ))}
      </RigidBody>
    </>
  );
}

/** Trees, bushes, grass tufts and boulders on the meadow. Scenery only; no plant shows any data. */
export default function MeadowPlants() {
  return (
    <PlantsBoundary>
      <Suspense fallback={null}>
        <Pieces />
      </Suspense>
    </PlantsBoundary>
  );
}
