import { useEffect, useMemo } from "react";
import { BufferGeometry, DoubleSide, Float32BufferAttribute, MeshStandardMaterial } from "three";
import { countrysideMesh } from "./countryside";

/** One flat material for the whole countryside: the colour rides on vertex colours, so it is one mesh and one draw call. */
const MATERIAL = new MeshStandardMaterial({ vertexColors: true, flatShading: true, side: DoubleSide });

/**
 * The river, the tracks and the fields (S31 PR 2). Scenery only: fixed shapes, the same for every portfolio, nothing in it
 * reads a holding. No physics: you walk across it like the meadow.
 */
export default function Countryside() {
  const geo = useMemo(() => {
    const m = countrysideMesh();
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(m.positions, 3));
    g.setAttribute("color", new Float32BufferAttribute(m.colors, 3));
    g.setAttribute("normal", new Float32BufferAttribute(Array.from({ length: m.positions.length / 3 }, () => [0, 1, 0]).flat(), 3));
    g.setIndex(m.indices);
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} material={MATERIAL} receiveShadow frustumCulled={false} />;
}
