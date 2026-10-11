import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ART_MANIFEST } from "./artManifest";

// Guards the packed art (scripts/art/pack.py): every id in the source manifest
// has a file and a generated entry, nothing unlisted ships, and the budget
// holds. Reads the repo from disk, so it runs in CI without the masters.

const FRONTEND = resolve(__dirname, "../..");
const ART_DIR = join(FRONTEND, "src/assets/art");
const SOURCE = JSON.parse(readFileSync(resolve(FRONTEND, "../scripts/art/manifest.json"), "utf-8")) as {
  objects: { id: string }[];
};
const MAX_FILE_KB = 60;
// Raised from 1200 in Design Master Sprint 6 (23 more pictures). Pictures load only when a view uses them.
const MAX_TOTAL_KB = 1700;
const MAX_PUBLIC_IMAGE_KB = 150;

const sourceIds = SOURCE.objects.map((o) => o.id);
const files = readdirSync(ART_DIR).filter((f) => f.endsWith(".webp"));

describe("packed object art", () => {
  it("has a file and a generated entry for every manifest id", () => {
    for (const id of sourceIds) {
      expect(existsSync(join(ART_DIR, `${id}.webp`)), `${id}.webp`).toBe(true);
    }
    expect(Object.keys(ART_MANIFEST).sort()).toEqual([...sourceIds].sort());
  });

  it("ships no picture the manifest does not list", () => {
    expect(files.map((f) => f.replace(/\.webp$/, "")).sort()).toEqual([...sourceIds].sort());
  });

  it("keeps each picture and the whole set inside the budget", () => {
    const sizes = files.map((f) => statSync(join(ART_DIR, f)).size / 1024);
    sizes.forEach((kb, i) => expect(kb, files[i]).toBeLessThanOrEqual(MAX_FILE_KB));
    expect(sizes.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(MAX_TOTAL_KB);
  });

  it("records real dimensions and no baked-in text", () => {
    for (const art of Object.values(ART_MANIFEST)) {
      expect(art.width).toBeGreaterThan(0);
      expect(art.height).toBeGreaterThan(0);
      expect(art.alt).toBe("");
    }
  });

  it("keeps masters and big images out of public/, which Vite ships", () => {
    const stack = [join(FRONTEND, "public")];
    while (stack.length) {
      const dir = stack.pop()!;
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) stack.push(path);
        else if (/\.(png|jpe?g|webp|gif)$/i.test(name)) {
          expect(statSync(path).size / 1024, path).toBeLessThanOrEqual(MAX_PUBLIC_IMAGE_KB);
        }
      }
    }
  });
});
