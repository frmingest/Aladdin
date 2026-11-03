import { BufferGeometry, Group, Matrix4, Mesh } from "three";
import type { Material, Object3D } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Draw still pieces in one go (S23 PR 2).
 *
 * Walks a part of the scene that never moves or changes and joins every mesh that looks the same
 * (same material, same shadow flags) into one mesh, in the place it already stands. Same look, far
 * fewer draw calls. The original meshes stay in the scene, only hidden, so nothing that built them
 * is disturbed, and `undoBatch` puts everything back.
 *
 * Only for pieces that carry no fact and never move: furniture, walls, scenery. Anything that is
 * lit by the Standing, shows a level or a status, or animates, stays out of a batch.
 */

export interface Batch {
  /** The group that holds the joined meshes, a child of the batch root (null when nothing was joined). */
  holder: Group | null;
  /** The joined meshes. */
  made: Mesh[];
  /** The originals that were hidden because they now live inside a joined mesh. */
  hidden: Mesh[];
  /** Draw calls the originals would have cost, and what the joined meshes cost. */
  callsBefore: number;
  callsAfter: number;
}

interface MaterialLike extends Material {
  color?: { getHex(): number };
  emissive?: { getHex(): number };
  map?: { uuid: string } | null;
  normalMap?: { uuid: string } | null;
  flatShading?: boolean;
  metalness?: number;
  roughness?: number;
}

/** Two meshes may be joined when this is equal: they would have been drawn the same way. */
export function materialKey(mesh: Mesh): string {
  const m = mesh.material as MaterialLike;
  return [
    m.type,
    m.color?.getHex() ?? "-",
    m.emissive?.getHex() ?? "-",
    m.map?.uuid ?? "-",
    m.normalMap?.uuid ?? "-",
    m.flatShading ? 1 : 0,
    m.metalness ?? "-",
    m.roughness ?? "-",
    m.vertexColors ? 1 : 0,
    m.side,
    m.transparent ? 1 : 0,
    m.opacity,
    m.alphaTest,
    m.depthWrite ? 1 : 0,
    m.toneMapped ? 1 : 0,
    mesh.castShadow ? 1 : 0,
    mesh.receiveShadow ? 1 : 0,
    mesh.renderOrder,
  ].join("|");
}

interface Candidate {
  mesh: Mesh;
  matrix: Matrix4;
}

function shownAll(obj: Object3D): boolean {
  let cur: Object3D | null = obj;
  while (cur) {
    if (!cur.visible) return false;
    cur = cur.parent;
  }
  return true;
}

function joinable(obj: Object3D): obj is Mesh {
  const mesh = obj as Mesh & {
    isSkinnedMesh?: boolean;
    isInstancedMesh?: boolean;
  };
  if (!mesh.isMesh || mesh.isSkinnedMesh || mesh.isInstancedMesh) return false;
  if (Array.isArray(mesh.material) || !mesh.material) return false;
  if (mesh.userData?.noBatch) return false;
  if ((mesh.material as Material).transparent) return false; // see-through meshes depend on draw order; leave them be
  if (mesh.morphTargetInfluences && mesh.morphTargetInfluences.length > 0)
    return false;
  if (!mesh.geometry?.getAttribute("position")) return false;
  return shownAll(mesh);
}

/** Keep the attributes every geometry has, drop the rest, and make indexing match, so they can be joined. */
function normalised(geometries: BufferGeometry[]): BufferGeometry[] {
  const common = Object.keys(geometries[0].attributes).filter((name) =>
    geometries.every((g) => g.getAttribute(name)),
  );
  const anyIndexed = geometries.some((g) => g.index);
  const allIndexed = geometries.every((g) => g.index);
  return geometries.map((g) => {
    const copy = !allIndexed && anyIndexed && g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(copy.attributes))
      if (!common.includes(name)) copy.deleteAttribute(name);
    copy.morphAttributes = {};
    return copy;
  });
}

/**
 * Join the meshes under `root` that look the same into one mesh each. Returns what it did. Groups of one
 * are left alone, and so is any group that cannot be joined safely (the originals stay visible).
 */
export function batchStatic(root: Object3D): Batch {
  root.updateWorldMatrix(true, true);
  const inverse = new Matrix4().copy(root.matrixWorld).invert();

  const groups = new Map<string, Candidate[]>();
  let callsBefore = 0;
  root.traverse((obj) => {
    if (!joinable(obj)) return;
    // A mirrored piece would turn inside out when its transform is baked in; leave it as it is.
    const matrix = new Matrix4().multiplyMatrices(inverse, obj.matrixWorld);
    if (matrix.determinant() <= 0) return;
    callsBefore += 1;
    const key = materialKey(obj);
    const list = groups.get(key) ?? [];
    list.push({ mesh: obj, matrix });
    groups.set(key, list);
  });

  const holder = new Group();
  holder.name = "static-batch";
  const made: Mesh[] = [];
  const hidden: Mesh[] = [];
  let untouched = 0;

  for (const list of groups.values()) {
    if (list.length < 2) {
      untouched += list.length;
      continue;
    }
    const baked = list.map(({ mesh, matrix }) =>
      mesh.geometry.clone().applyMatrix4(matrix),
    );
    let merged: BufferGeometry | null = null;
    try {
      merged = mergeGeometries(normalised(baked), false);
    } catch {
      merged = null;
    }
    baked.forEach((g) => g.dispose());
    if (!merged) {
      untouched += list.length;
      continue;
    }
    const first = list[0].mesh;
    const joined = new Mesh(merged, first.material);
    joined.castShadow = first.castShadow;
    joined.receiveShadow = first.receiveShadow;
    joined.renderOrder = first.renderOrder;
    joined.userData.noBatch = true; // a second pass must never join a joined mesh again
    holder.add(joined);
    made.push(joined);
    list.forEach(({ mesh }) => {
      mesh.visible = false;
      hidden.push(mesh);
    });
  }

  if (made.length > 0) root.add(holder);
  return {
    holder: made.length > 0 ? holder : null,
    made,
    hidden,
    callsBefore,
    callsAfter: made.length + untouched,
  };
}

/** Put the originals back and throw the joined meshes away. */
export function undoBatch(batch: Batch): void {
  batch.hidden.forEach((m) => {
    m.visible = true;
  });
  batch.made.forEach((m) => m.geometry.dispose());
  batch.holder?.parent?.remove(batch.holder);
  batch.holder = null;
  batch.made.length = 0;
  batch.hidden.length = 0;
}
