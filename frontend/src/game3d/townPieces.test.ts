import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { TOWN_FILES, TOWN_MAKER, TOWN_PALETTE_URL, TOWN_PIECES, TOWN_SCALE, TOWN_SIZES, townSizeOf } from "./townPieces";
import type { TownGroup } from "./townPieces";

const PUBLIC = join(__dirname, "../../public");
const GROUPS = Object.keys(TOWN_FILES) as TownGroup[];

interface Json {
  extensionsUsed?: string[];
  animations?: unknown[];
  nodes?: { name?: string; children?: number[]; mesh?: number; translation?: number[]; rotation?: number[]; scale?: number[] }[];
  meshes?: { primitives: { attributes: { POSITION: number } }[] }[];
  accessors?: { min?: number[]; max?: number[] }[];
  materials?: { name?: string; pbrMetallicRoughness?: { baseColorFactor?: number[]; baseColorTexture?: unknown } }[];
  images?: { bufferView?: number; mimeType?: string }[];
  bufferViews?: { byteOffset?: number; byteLength: number }[];
}

/** Reads a .glb's JSON header and its binary chunk, without any 3D code. */
function glb(url: string): { json: Json; bin: Buffer } {
  const buf = readFileSync(join(PUBLIC, url));
  expect(buf.toString("ascii", 0, 4)).toBe("glTF");
  const jsonLength = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString("utf8", 20, 20 + jsonLength)) as Json;
  const binStart = 20 + jsonLength + 8;
  return { json, bin: buf.subarray(binStart) };
}

/** Native bounds of a top-level node: its meshes and children, with plain translations only (checked below). */
function boundsOf(json: Json, index: number): { min: number[]; max: number[] } | null {
  const node = json.nodes![index];
  const t = node.translation ?? [0, 0, 0];
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  const merge = (b: { min: number[]; max: number[] } | null) => {
    if (!b) return;
    min = min.map((v, i) => Math.min(v, b.min[i] + t[i]));
    max = max.map((v, i) => Math.max(v, b.max[i] + t[i]));
  };
  if (node.mesh !== undefined)
    for (const p of json.meshes![node.mesh].primitives) {
      const a = json.accessors![p.attributes.POSITION];
      merge({ min: a.min!, max: a.max! });
    }
  for (const c of node.children ?? []) merge(boundsOf(json, c));
  return Number.isFinite(min[0]) ? { min, max } : null;
}

/** Tiny PNG reader (8-bit, not interlaced): enough to look at every pixel of the palette. */
function readPng(bytes: Buffer): { width: number; height: number; rgba: Uint8Array } {
  expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
  let p = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat: Buffer[] = [];
  while (p < bytes.length) {
    const len = bytes.readUInt32BE(p);
    const type = bytes.toString("ascii", p + 4, p + 8);
    const data = bytes.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      expect(data[8]).toBe(8);
      colorType = data[9];
      expect(data[12]).toBe(0);
    }
    if (type === "IDAT") idat.push(data);
    p += 12 + len;
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  expect(channels).toBeGreaterThan(0);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= channels ? out[y * stride + x - channels] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0;
      const pa = Math.abs(b - c);
      const pb = Math.abs(a - c);
      const pc = Math.abs(a + b - 2 * c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      out[y * stride + x] = (v + (f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : paeth)) & 255;
    }
  }
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = out[i * channels];
    rgba[i * 4 + 1] = out[i * channels + 1];
    rgba[i * 4 + 2] = out[i * channels + 2];
    rgba[i * 4 + 3] = channels === 4 ? out[i * channels + 3] : 255;
  }
  return { width, height, rgba };
}

function hueSat(r: number, g: number, b: number): { h: number; s: number } {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  if (!d) return { h: 0, s: 0 };
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: d / mx };
}

describe("the town kit files", () => {
  for (const group of GROUPS) {
    it(`${group}: every listed piece is a top-level node, plain float geometry, no animation`, () => {
      const { json } = glb(TOWN_FILES[group]);
      const names = (json.nodes ?? []).map((n) => n.name ?? "");
      for (const id of TOWN_PIECES[group]) expect(names, id).toContain(id);
      expect(new Set(TOWN_PIECES[group]).size).toBe(TOWN_PIECES[group].length);
      expect(json.extensionsUsed ?? []).not.toContain("KHR_mesh_quantization");
      expect(json.extensionsUsed ?? []).not.toContain("EXT_meshopt_compression");
      expect(json.animations ?? []).toHaveLength(0);
    });
  }

  it("ids are unique across the whole kit's buildings and Kenney groups never clash within a group", () => {
    for (const g of GROUPS) expect(new Set(TOWN_PIECES[g]).size).toBe(TOWN_PIECES[g].length);
  });

  it("stays small: no file over 1 MB, the whole kit under 1.6 MB", () => {
    let total = 0;
    for (const g of GROUPS) {
      const bytes = statSync(join(PUBLIC, TOWN_FILES[g])).size;
      expect(bytes, g).toBeLessThanOrEqual(1024 * 1024);
      total += bytes;
    }
    expect(total).toBeLessThanOrEqual(1.6 * 1024 * 1024);
  });

  it("no node or material name says red or green (nothing can read as a status colour)", () => {
    for (const g of GROUPS) {
      const { json } = glb(TOWN_FILES[g]);
      for (const n of json.nodes ?? []) expect(n.name ?? "", g).not.toMatch(/red|green/i);
      for (const m of json.materials ?? []) expect(m.name ?? "", g).not.toMatch(/red|green/i);
    }
  });
});

describe("one retinted palette", () => {
  const palette = readFileSync(join(PUBLIC, TOWN_PALETTE_URL));

  it("every Kenney file embeds exactly the one palette image; the Builder file has no texture at all", () => {
    for (const g of GROUPS) {
      const { json, bin } = glb(TOWN_FILES[g]);
      const images = json.images ?? [];
      if (TOWN_MAKER[g] === "builder") {
        expect(images, g).toHaveLength(0);
        continue;
      }
      expect(images, g).toHaveLength(1);
      const view = json.bufferViews![images[0].bufferView!];
      const bytes = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
      expect(Buffer.compare(bytes, palette), g).toBe(0);
    }
  });

  it("has no red cell and no teal-green cell left (they became blue and teal); leaf greens and timber stay", () => {
    const { width, height, rgba } = readPng(palette);
    expect([width, height]).toEqual([512, 512]);
    let red = 0;
    let tealGreen = 0;
    let blue = 0;
    let teal = 0;
    let leaf = 0;
    for (let i = 0; i < width * height; i++) {
      const { h, s } = hueSat(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
      if (s < 0.4) continue;
      if (h >= 340 || h <= 8) red++;
      else if (h >= 160 && h <= 176) tealGreen++;
      else if (h >= 205 && h <= 225) blue++;
      else if (h >= 183 && h <= 193) teal++;
      else if (h >= 145 && h <= 159) leaf++;
    }
    expect(red).toBe(0);
    expect(tealGreen).toBe(0);
    expect(blue).toBeGreaterThan(500);
    expect(teal).toBeGreaterThan(500);
    expect(leaf).toBeGreaterThan(500);
  });

  it("Builder roofs are teal: no orange 'Brown' roof material is left", () => {
    const { json } = glb(TOWN_FILES.buildings);
    const names = (json.materials ?? []).map((m) => m.name ?? "");
    expect(names).not.toContain("Brown");
    expect(names).not.toContain("Red");
    expect(names).toContain("RoofTeal");
  });
});

describe("sizes", () => {
  it("each measured native size matches the file, and the drawn size sits beside 2.0-tall people", () => {
    for (const [id, s] of Object.entries(TOWN_SIZES)) {
      const { json } = glb(TOWN_FILES[s.group]);
      const index = (json.nodes ?? []).findIndex((n) => n.name === id);
      expect(index, id).toBeGreaterThanOrEqual(0);
      const b = boundsOf(json, index)!;
      expect(b.max[0] - b.min[0], `${id} w`).toBeCloseTo(s.w, 1);
      expect(b.max[1] - b.min[1], `${id} h`).toBeCloseTo(s.h, 1);
      expect(b.max[2] - b.min[2], `${id} d`).toBeCloseTo(s.d, 1);
    }
    const stall = townSizeOf("stall_awning_blue");
    expect(stall.h).toBeGreaterThan(2.8);
    expect(stall.h).toBeLessThan(3.4);
    const house = townSizeOf("house");
    expect(house.w).toBeGreaterThan(8);
    expect(house.w).toBeLessThan(10);
    expect(house.h).toBeGreaterThan(4);
    expect(TOWN_SCALE.kenney).toBeLessThan(TOWN_SCALE.builder);
  });
});
