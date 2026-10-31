import { describe, expect, it } from "vitest";
import {
  BackSide,
  Bone,
  BoxGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
} from "three";
import { INK } from "./Inked";
import { OUTLINE_FLAG, OUTLINE_WORLD, addOutlines, makeOutlineMaterial, patchOutlineVertex } from "./outline";

function skinnedBox(name: string): SkinnedMesh {
  const geometry = new BoxGeometry(1, 1, 1);
  const count = geometry.getAttribute("position").count;
  geometry.setAttribute("skinIndex", new Uint16BufferAttribute(new Array(count * 4).fill(0), 4));
  geometry.setAttribute("skinWeight", new Float32BufferAttribute(Array.from({ length: count * 4 }, (_, i) => (i % 4 === 0 ? 1 : 0)), 4));
  const mesh = new SkinnedMesh(geometry, new MeshStandardMaterial());
  mesh.name = name;
  const bone = new Bone();
  mesh.add(bone);
  mesh.bind(new Skeleton([bone]));
  return mesh;
}

describe("outline shell for skinned models", () => {
  it("puts the extrusion right after begin_vertex, before skinning", () => {
    const shader = { vertexShader: "void main(){\n#include <begin_vertex>\n#include <skinning_vertex>\n}" };
    patchOutlineVertex(shader, 0.05);
    const begin = shader.vertexShader.indexOf("#include <begin_vertex>");
    const push = shader.vertexShader.indexOf("transformed += normalize( normal ) * 0.050000;");
    const skin = shader.vertexShader.indexOf("#include <skinning_vertex>");
    expect(begin).toBeGreaterThanOrEqual(0);
    expect(push).toBeGreaterThan(begin);
    expect(skin).toBeGreaterThan(push);
  });

  it("draws the back faces in the ink colour, with a program key per thickness", () => {
    const a = makeOutlineMaterial(0.02);
    const b = makeOutlineMaterial(0.04);
    expect(a.side).toBe(BackSide);
    expect(a.color.getHexString()).toBe(INK.slice(1).toLowerCase());
    expect(a.customProgramCacheKey()).not.toBe(b.customProgramCacheKey());
  });

  it("adds one shell per visible mesh, sharing the skeleton, and skips hidden meshes", () => {
    const root = new Group();
    const body = skinnedBox("Body");
    const sword = skinnedBox("1H_Sword");
    sword.visible = false;
    root.add(body, sword);

    addOutlines(root, 0.03);

    const shells = root.children.filter((c) => c.userData[OUTLINE_FLAG]) as SkinnedMesh[];
    expect(shells).toHaveLength(1);
    expect(shells[0].name).toBe("Body_outline");
    expect(shells[0].skeleton).toBe(body.skeleton);
    expect(shells[0].castShadow).toBe(false);
    expect(root.children).toHaveLength(3);
  });

  it("outlines plain meshes too, and never outlines a shell", () => {
    const root = new Group();
    root.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()));
    addOutlines(root, 0.03);
    expect(root.children).toHaveLength(2);
    const before = root.children.length;
    addOutlines(root, 0.03);
    // the second call sees the first call's shell and skips it, so only the real mesh gains one
    expect(root.children.length).toBe(before + 1);
  });

  it("removes its shells again", () => {
    const root = new Group();
    root.add(skinnedBox("Body"));
    const remove = addOutlines(root, 0.03);
    expect(root.children).toHaveLength(2);
    remove();
    expect(root.children).toHaveLength(1);
  });

  it("keeps the outline thin in world units", () => {
    expect(OUTLINE_WORLD).toBeGreaterThan(0);
    expect(OUTLINE_WORLD).toBeLessThan(0.1);
  });
});
