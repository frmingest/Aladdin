import { BackSide, Mesh, MeshBasicMaterial, SkinnedMesh } from "three";
import type { BufferGeometry, Object3D } from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { INK } from "./Inked";

/**
 * Ink outline for the real character models (game3d S2).
 *
 * The shape figures get their outline from a slightly larger back-facing copy (Inked.tsx). A plain
 * scaled copy does not follow a skeleton, so for a skinned model each visible mesh gets a second
 * mesh that shares the same skeleton. Its material draws back-faces only, and the vertex shader
 * pushes every vertex outwards along its normal *before* skinning, so the shell bends with the body.
 * The extrusion uses smoothed normals, otherwise the model's flat-shaded corners would split the
 * shell open at every hard edge.
 */

/** Outline width in courtyard units (a person is about 1.9 high). */
export const OUTLINE_WORLD = 0.03;

/** Marks the shell meshes, so they are never outlined themselves. */
export const OUTLINE_FLAG = "isOutlineShell";

/** Pushes each vertex out along its normal, ahead of the skinning step that follows `begin_vertex`. */
export function patchOutlineVertex(shader: { vertexShader: string }, thickness: number): void {
  shader.vertexShader = shader.vertexShader.replace(
    "#include <begin_vertex>",
    `#include <begin_vertex>\n  transformed += normalize( normal ) * ${thickness.toFixed(6)};`,
  );
}

/** One back-face ink material for a given thickness (in the model's own units, before scaling). */
export function makeOutlineMaterial(thickness: number): MeshBasicMaterial {
  const material = new MeshBasicMaterial({ color: INK, side: BackSide });
  material.onBeforeCompile = (shader) => patchOutlineVertex(shader, thickness);
  material.customProgramCacheKey = () => `ink-outline-${thickness.toFixed(6)}`;
  return material;
}

/** Hull geometry per source geometry: same positions and skin weights, normals smoothed across edges. */
const hullGeometry = new WeakMap<BufferGeometry, BufferGeometry>();

function smoothed(source: BufferGeometry): BufferGeometry {
  let hull = hullGeometry.get(source);
  if (!hull) {
    try {
      hull = toCreasedNormals(source, Math.PI);
    } catch {
      hull = source; // could not smooth: extrude along the normals it already has
    }
    hullGeometry.set(source, hull);
  }
  return hull;
}

/**
 * Add an ink shell to every visible mesh under `root`. `thickness` is in the model's own units, so
 * pass `OUTLINE_WORLD / scale`. Returns a function that removes the shells again.
 */
export function addOutlines(root: Object3D, thickness: number): () => void {
  const material = makeOutlineMaterial(thickness);
  const shells: Mesh[] = [];
  const sources: Mesh[] = [];
  root.traverseVisible((o) => {
    const m = o as Mesh;
    if (m.isMesh && !m.userData[OUTLINE_FLAG]) sources.push(m);
  });

  for (const source of sources) {
    const parent = source.parent;
    if (!parent) continue;
    const geometry = smoothed(source.geometry);
    let shell: Mesh;
    const skinned = source as SkinnedMesh;
    if (skinned.isSkinnedMesh) {
      const s = new SkinnedMesh(geometry, material);
      s.bind(skinned.skeleton, skinned.bindMatrix);
      s.bindMode = skinned.bindMode;
      shell = s;
    } else {
      shell = new Mesh(geometry, material);
    }
    shell.name = `${source.name}_outline`;
    shell.userData[OUTLINE_FLAG] = true;
    shell.position.copy(source.position);
    shell.quaternion.copy(source.quaternion);
    shell.scale.copy(source.scale);
    shell.castShadow = false;
    shell.receiveShadow = false;
    shell.frustumCulled = false;
    parent.add(shell);
    shells.push(shell);
  }

  return () => {
    for (const shell of shells) shell.parent?.remove(shell);
    material.dispose();
  };
}
