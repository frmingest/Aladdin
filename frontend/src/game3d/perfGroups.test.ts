import { BoxGeometry, Group, InstancedMesh, Mesh, MeshBasicMaterial } from "three";
import { describe, expect, it } from "vitest";
import { OTHER_GROUP, groupLine, tallyScene, topGroups } from "./perfGroups";

const mat = () => new MeshBasicMaterial();
// A box has 12 triangles.
const box = () => new Mesh(new BoxGeometry(1, 1, 1), mat());

function tagged(name: string, ...kids: Mesh[]): Group {
  const g = new Group();
  g.userData.perfGroup = name;
  kids.forEach((k) => g.add(k));
  return g;
}

describe("tallyScene", () => {
  it("counts one call and the triangles per visible mesh, under the tagged group", () => {
    const root = new Group();
    root.add(tagged("scenery", box(), box(), box()));
    root.add(tagged("market", box()));
    const rows = tallyScene(root);
    expect(rows.find((r) => r.group === "scenery")).toMatchObject({ calls: 3, triangles: 36, instanced: 0 });
    expect(rows.find((r) => r.group === "market")).toMatchObject({ calls: 1, triangles: 12 });
  });

  it("puts untagged meshes in 'other' and lets the nearest tag win", () => {
    const root = new Group();
    root.add(box());
    const outer = tagged("courtyard");
    const inner = tagged("keep", box());
    outer.add(inner);
    root.add(outer);
    const rows = tallyScene(root);
    expect(rows.find((r) => r.group === OTHER_GROUP)?.calls).toBe(1);
    expect(rows.find((r) => r.group === "keep")?.calls).toBe(1);
    expect(rows.find((r) => r.group === "courtyard")).toBeUndefined();
  });

  it("skips meshes that are hidden, or sit under a hidden parent", () => {
    const root = new Group();
    const hiddenMesh = box();
    hiddenMesh.visible = false;
    const hiddenGroup = tagged("camp", box());
    hiddenGroup.visible = false;
    root.add(tagged("scenery", hiddenMesh, box()), hiddenGroup);
    const rows = tallyScene(root);
    expect(rows.find((r) => r.group === "scenery")?.calls).toBe(1);
    expect(rows.find((r) => r.group === "camp")).toBeUndefined();
  });

  it("counts an instanced mesh as one call with every copy's triangles", () => {
    const root = new Group();
    const trees = new InstancedMesh(new BoxGeometry(1, 1, 1), mat(), 10);
    root.add(tagged("horizon", trees as unknown as Mesh));
    const row = tallyScene(root).find((r) => r.group === "horizon");
    expect(row).toMatchObject({ calls: 1, triangles: 120, instanced: 1 });
  });

  it("counts one call per material slot", () => {
    const root = new Group();
    const two = new Mesh(new BoxGeometry(1, 1, 1), [mat(), mat()]);
    root.add(tagged("keep", two));
    expect(tallyScene(root)[0].calls).toBe(2);
  });

  it("sorts biggest first, and the order is stable on ties", () => {
    const root = new Group();
    root.add(tagged("b", box()), tagged("a", box()), tagged("big", box(), box()));
    expect(tallyScene(root).map((r) => r.group)).toEqual(["big", "a", "b"]);
  });

  it("returns nothing for an empty scene", () => {
    expect(tallyScene(new Group())).toEqual([]);
  });
});

describe("overlay lines", () => {
  const rows = ["a", "b", "c", "d"].map((g, i) => ({ group: g, calls: 100 - i, triangles: 4000, instanced: 0 }));
  it("prints calls and thousands of triangles", () => {
    expect(groupLine({ group: "scenery", calls: 142, triangles: 31400, instanced: 0 })).toBe("scenery 142 · 31k");
  });
  it("shows the top few and folds the rest into a count", () => {
    expect(topGroups(rows, 3)).toEqual({ shown: rows.slice(0, 3), more: 1 });
    expect(topGroups(rows, 10).more).toBe(0);
  });
});
