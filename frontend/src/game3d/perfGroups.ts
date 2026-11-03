import type { Object3D } from "three";

/**
 * Measuring only (S23 PR 1). Walks the 3D scene and says which part of it owns how many
 * draw calls and triangles, so the "draw copies in one go" work follows numbers, not guesses.
 *
 * A part tags itself with `userData.perfGroup` on a wrapping group; the nearest tagged
 * ancestor owns every mesh below it. Anything untagged lands in "other".
 *
 * These are shares of the scene, not the renderer's own total: the renderer also draws
 * shadows and the ink outline pass. The overlay shows both, so the gap is visible.
 */

export const OTHER_GROUP = "other";

export interface GroupTally {
  group: string;
  /** Meshes that would be drawn: visible, with every parent visible. One per material slot. */
  calls: number;
  /** Triangles those meshes hold (an instanced mesh counts every copy). */
  triangles: number;
  /** Instanced meshes in the group: the ones that already draw many copies in one call. */
  instanced: number;
}

interface MeshLike extends Object3D {
  isMesh?: boolean;
  isInstancedMesh?: boolean;
  count?: number;
  material?: unknown;
  geometry?: {
    index?: { count: number } | null;
    attributes?: { position?: { count: number } };
    drawRange?: { start: number; count: number };
  };
}

function ownerGroup(obj: Object3D): string {
  let cur: Object3D | null = obj;
  while (cur) {
    const tag = cur.userData?.perfGroup;
    if (typeof tag === "string" && tag) return tag;
    cur = cur.parent;
  }
  return OTHER_GROUP;
}

function hiddenByParent(obj: Object3D): boolean {
  let cur: Object3D | null = obj;
  while (cur) {
    if (cur.visible === false) return true;
    cur = cur.parent;
  }
  return false;
}

function triangleCount(mesh: MeshLike): number {
  const geo = mesh.geometry;
  if (!geo) return 0;
  const verts = geo.index ? geo.index.count : (geo.attributes?.position?.count ?? 0);
  const drawn = Math.min(verts, geo.drawRange?.count ?? Infinity);
  const copies = mesh.isInstancedMesh ? (mesh.count ?? 0) : 1;
  return Math.floor(drawn / 3) * copies;
}

/** Sorted biggest first (calls, then triangles, then name) so the order is stable. */
export function tallyScene(root: Object3D): GroupTally[] {
  const byGroup = new Map<string, GroupTally>();
  root.traverse((node) => {
    const mesh = node as MeshLike;
    if (!mesh.isMesh) return;
    if (hiddenByParent(mesh)) return;
    const group = ownerGroup(mesh);
    const row = byGroup.get(group) ?? { group, calls: 0, triangles: 0, instanced: 0 };
    row.calls += Array.isArray(mesh.material) ? Math.max(1, mesh.material.length) : 1;
    row.triangles += triangleCount(mesh);
    if (mesh.isInstancedMesh) row.instanced += 1;
    byGroup.set(group, row);
  });
  return [...byGroup.values()].sort((a, b) => b.calls - a.calls || b.triangles - a.triangles || a.group.localeCompare(b.group));
}

/** One short line per group for the overlay, e.g. "scenery 142 · 31k". */
export function groupLine(row: GroupTally): string {
  return `${row.group} ${row.calls} · ${Math.round(row.triangles / 1000)}k`;
}

/** The biggest few groups, with the rest folded into "N more" so the overlay stays small. */
export function topGroups(rows: readonly GroupTally[], limit = 6): { shown: GroupTally[]; more: number } {
  return { shown: rows.slice(0, limit), more: Math.max(0, rows.length - limit) };
}
