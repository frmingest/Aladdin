import {
  BackSide,
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from "three";
import type { BufferGeometry, Material, Object3D } from "three";
import { describe, expect, it } from "vitest";
import { batchStatic, materialKey, undoBatch } from "./staticBatch";

const std = (color: string) =>
  new MeshStandardMaterial({ color, flatShading: true });

function mesh(
  geo: BufferGeometry,
  material: Material,
  x = 0,
  y = 0,
  z = 0,
): Mesh {
  const m = new Mesh(geo, material);
  m.position.set(x, y, z);
  return m;
}

/** Every triangle that would be drawn, in world space, as a sorted list of strings: the picture, as data. */
function worldTriangles(root: Object3D): string[] {
  root.updateWorldMatrix(true, true);
  const out: string[] = [];
  const v = new Float32Array(3);
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    let shown = true;
    for (let p: Object3D | null = m; p; p = p.parent)
      if (!p.visible) shown = false;
    if (!shown) return;
    const pos = m.geometry.getAttribute("position");
    const index = m.geometry.index;
    const count = index ? index.count : pos.count;
    const tri: string[] = [];
    for (let i = 0; i < count; i++) {
      const vi = index ? index.getX(i) : i;
      v[0] = pos.getX(vi);
      v[1] = pos.getY(vi);
      v[2] = pos.getZ(vi);
      const w = new Vector3(v[0], v[1], v[2]).applyMatrix4(m.matrixWorld);
      tri.push(`${w.x.toFixed(3)},${w.y.toFixed(3)},${w.z.toFixed(3)}`);
      if (tri.length === 3) {
        out.push(
          `${(m.material as MeshStandardMaterial).color?.getHexString?.() ?? "-"}:${[...tri].sort().join("|")}`,
        );
        tri.length = 0;
      }
    }
  });
  return out.sort();
}

function visibleMeshes(root: Object3D): Mesh[] {
  const list: Mesh[] = [];
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    for (let p: Object3D | null = m; p; p = p.parent) if (!p.visible) return;
    list.push(m);
  });
  return list;
}

/** Triangles in every mesh that is not itself a joined mesh or hidden: what the picture should hold. */
function visibleTriangleCountOf(root: Object3D): number {
  return worldTriangles(root).length;
}

function scene(): Group {
  const root = new Group();
  root.position.set(10, 0, -4);
  root.rotation.y = 0.7;
  const inner = new Group();
  inner.position.set(1, 2, 3);
  inner.scale.set(1.5, 0.5, 2);
  root.add(inner);
  const a = std("#aa5533");
  const b = std("#3355aa");
  inner.add(mesh(new BoxGeometry(1, 1, 1), a, 0, 0, 0));
  inner.add(mesh(new BoxGeometry(2, 1, 1), std("#aa5533"), 4, 1, 0)); // same colour, its own material
  inner.add(mesh(new CylinderGeometry(0.5, 0.5, 2, 8), a, -3, 0, 2));
  inner.add(mesh(new SphereGeometry(0.6, 8, 6), b, 2, 3, 1));
  inner.add(mesh(new BoxGeometry(1, 1, 1), b, 5, 0, 5));
  return root;
}

describe("batchStatic", () => {
  it("joins meshes that look the same, and leaves the picture exactly as it was", () => {
    const root = scene();
    const before = worldTriangles(root);
    const batch = batchStatic(root);
    expect(batch.callsBefore).toBe(5);
    expect(batch.callsAfter).toBe(2); // one per colour
    expect(batch.hidden).toHaveLength(5);
    expect(worldTriangles(root)).toEqual(before);
  });

  it("drops no triangle and adds none", () => {
    const root = scene();
    const total = worldTriangles(root).length;
    batchStatic(root);
    expect(worldTriangles(root)).toHaveLength(total);
    expect(visibleMeshes(root)).toHaveLength(2);
  });

  it("keeps different materials apart", () => {
    const root = new Group();
    root.add(
      mesh(new BoxGeometry(), std("#111111")),
      mesh(new BoxGeometry(), std("#222222"), 3, 0, 0),
    );
    const batch = batchStatic(root);
    expect(batch.made).toHaveLength(0);
    expect(batch.callsAfter).toBe(2);
    expect(visibleMeshes(root)).toHaveLength(2);
  });

  it("keeps back-face outlines apart from solid meshes of the same colour", () => {
    const root = new Group();
    const solid = new MeshBasicMaterial({ color: "#26253B" });
    const ink = new MeshBasicMaterial({ color: "#26253B", side: BackSide });
    root.add(
      mesh(new BoxGeometry(), solid),
      mesh(new BoxGeometry(), solid, 2, 0, 0),
      mesh(new BoxGeometry(), ink),
      mesh(new BoxGeometry(), ink, 2, 0, 0),
    );
    const batch = batchStatic(root);
    expect(batch.made).toHaveLength(2);
    expect(
      new Set(batch.made.map((m) => (m.material as Material).side)).size,
    ).toBe(2);
  });

  it("keeps meshes with different shadow flags apart", () => {
    const material = std("#444444");
    const a = mesh(new BoxGeometry(), material);
    const b = mesh(new BoxGeometry(), material, 2, 0, 0);
    a.castShadow = true;
    expect(materialKey(a)).not.toBe(materialKey(b));
    const root = new Group();
    root.add(a, b);
    expect(batchStatic(root).made).toHaveLength(0);
  });

  it("copies the shadow flags onto the joined mesh", () => {
    const root = new Group();
    const material = std("#444444");
    for (const x of [0, 2, 4]) {
      const m = mesh(new BoxGeometry(), material, x, 0, 0);
      m.castShadow = true;
      m.receiveShadow = true;
      root.add(m);
    }
    const [joined] = batchStatic(root).made;
    expect(joined.castShadow).toBe(true);
    expect(joined.receiveShadow).toBe(true);
  });

  it("leaves hidden meshes, flagged meshes and mirrored meshes alone", () => {
    const material = std("#555555");
    const root = new Group();
    const hiddenOne = mesh(new BoxGeometry(), material, 1, 0, 0);
    hiddenOne.visible = false;
    const flagged = mesh(new BoxGeometry(), material, 2, 0, 0);
    flagged.userData.noBatch = true;
    const mirrored = mesh(new BoxGeometry(), material, 3, 0, 0);
    mirrored.scale.x = -1;
    root.add(
      hiddenOne,
      flagged,
      mirrored,
      mesh(new BoxGeometry(), material, 4, 0, 0),
      mesh(new BoxGeometry(), material, 5, 0, 0),
    );
    const batch = batchStatic(root);
    expect(batch.made).toHaveLength(1);
    expect(batch.hidden).toHaveLength(2);
    expect(flagged.visible).toBe(true);
    expect(mirrored.visible).toBe(true);
    expect(hiddenOne.visible).toBe(false);
  });

  it("leaves see-through meshes alone, because their draw order matters", () => {
    const fog = new MeshStandardMaterial({
      color: "#999999",
      transparent: true,
      opacity: 0.5,
    });
    const root = new Group();
    root.add(
      mesh(new BoxGeometry(), fog),
      mesh(new BoxGeometry(), fog, 2, 0, 0),
    );
    const batch = batchStatic(root);
    expect(batch.made).toHaveLength(0);
    expect(visibleMeshes(root)).toHaveLength(2);
  });

  it("shows a piece added later once the batch is built again", () => {
    const root = scene();
    const first = batchStatic(root);
    const extra = mesh(new BoxGeometry(1, 1, 1), std("#aa5533"), 9, 0, 0); // like a new book on the shelf
    root.children[0].add(extra);
    undoBatch(first);
    const again = batchStatic(root);
    expect(again.hidden).toContain(extra);
    expect(worldTriangles(root)).toHaveLength(visibleTriangleCountOf(root));
    expect(visibleMeshes(root)).toHaveLength(2);
  });

  it("joins a mix of indexed and non-indexed geometry", () => {
    const material = std("#666666");
    const plain = new BoxGeometry().toNonIndexed();
    const root = new Group();
    root.add(mesh(plain, material), mesh(new BoxGeometry(), material, 3, 0, 0));
    const before = worldTriangles(root);
    expect(batchStatic(root).made).toHaveLength(1);
    expect(worldTriangles(root)).toEqual(before);
  });

  it("does not join a joined mesh again on a second pass", () => {
    const root = scene();
    batchStatic(root);
    const second = batchStatic(root);
    expect(second.made).toHaveLength(0);
  });

  it("undo puts every original back and removes the joined meshes", () => {
    const root = scene();
    const before = worldTriangles(root);
    const batch = batchStatic(root);
    undoBatch(batch);
    expect(visibleMeshes(root)).toHaveLength(5);
    expect(root.getObjectByName("static-batch")).toBeUndefined();
    expect(worldTriangles(root)).toEqual(before);
  });

  it("does nothing to an empty scene", () => {
    const batch = batchStatic(new Group());
    expect(batch).toMatchObject({
      made: [],
      hidden: [],
      callsBefore: 0,
      callsAfter: 0,
      holder: null,
    });
  });
});
