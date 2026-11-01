import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DESK, SHELF } from "./desk";
import { COBBLE_RADIUS, KEEP, RESERVED_ZONES, SPAWN, towerSpots } from "./layout";
import { MARKET, MARKET_CENTER, MARKET_REACH, MARKET_URL } from "./marketPieces";
import type { MarketPiece } from "./marketPieces";
import { NPCS } from "./npcs";
import { PROPS } from "./props";
import { SCENERY } from "./sceneryPieces";
import { STANDING_TORCHES } from "./standingTorches";
import { TOWNSFOLK } from "./townsfolk";

/** A box is checked as its bounding circle: a little strict, never lenient. */
const radius = (m: MarketPiece) => (m.solid.kind === "circle" ? m.solid.r : Math.hypot(m.solid.hx, m.solid.hz));

/** Space between a point and the piece's real footprint (round, or the turned box). */
function gapFrom(m: MarketPiece, p: { x: number; z: number }): number {
  const dx = p.x - m.x;
  const dz = p.z - m.z;
  if (m.solid.kind === "circle") return Math.hypot(dx, dz) - m.solid.r;
  const c = Math.cos(m.yaw);
  const s = Math.sin(m.yaw);
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  return Math.hypot(Math.max(Math.abs(lx) - m.solid.hx, 0), Math.max(Math.abs(lz) - m.solid.hz, 0));
}

function glbNodes(): string[] {
  const buf = readFileSync(join(__dirname, "../../public", MARKET_URL));
  expect(buf.toString("ascii", 0, 4)).toBe("glTF");
  const json = JSON.parse(buf.toString("utf8", 20, 20 + buf.readUInt32LE(12)));
  expect(json.extensionsUsed ?? []).not.toContain("KHR_mesh_quantization");
  expect(json.extensionsUsed ?? []).not.toContain("EXT_meshopt_compression");
  return (json.nodes ?? []).map((n: { name?: string }) => n.name ?? "");
}

describe("marketplace corner", () => {
  it("every piece names a node in market.glb, and ids are unique", () => {
    const nodes = glbNodes();
    for (const m of MARKET) expect(nodes, m.id).toContain(m.model);
    expect(new Set(MARKET.map((m) => m.id)).size).toBe(MARKET.length);
  });

  it("the file stays small and the corner stays a handful of pieces", () => {
    expect(statSync(join(__dirname, "../../public", MARKET_URL)).size).toBeLessThanOrEqual(1024 * 1024);
    expect(MARKET.length).toBeGreaterThanOrEqual(6);
    expect(MARKET.length).toBeLessThanOrEqual(14);
  });

  it("uses blue and neutral pieces only: nothing can read as a status colour", () => {
    for (const m of MARKET) expect(m.model, m.id).not.toMatch(/red|green/);
  });

  it("stays in the south-east, where the marketplace ground was held, on the cobbles", () => {
    for (const m of MARKET) {
      expect(Math.hypot(m.x - MARKET_CENTER.x, m.z - MARKET_CENTER.z), m.id).toBeLessThan(MARKET_REACH);
      expect(Math.hypot(m.x, m.z), m.id).toBeLessThan(COBBLE_RADIUS - 0.5);
    }
  });

  it("is clear of the keep, every tower pad, the siege simulator's ground, people, the desk and the spawn point", () => {
    const spots = towerSpots();
    for (const m of MARKET) {
      const r = radius(m);
      const inKeep = Math.abs(m.x - KEEP.x) < KEEP.width / 2 + 2.5 && Math.abs(m.z - KEEP.z) < KEEP.depth / 2 + 2.5;
      expect(inKeep, m.id).toBe(false);
      for (const s of spots) expect(Math.hypot(m.x - s.x, m.z - s.z), m.id).toBeGreaterThan(1.7 + 2.5 + r * 0.5);
      for (const z of RESERVED_ZONES) expect(Math.hypot(m.x - z.x, m.z - z.z), `${m.id}/${z.id}`).toBeGreaterThan(z.radius + r);
      for (const n of [...NPCS, ...TOWNSFOLK]) expect(Math.hypot(m.x - n.x, m.z - n.z), `${m.id}/${n.id}`).toBeGreaterThan(r + 1.5);
      for (const d of [DESK, SHELF]) expect(Math.hypot(m.x - d.x, m.z - d.z), m.id).toBeGreaterThan(r + 3);
      expect(Math.hypot(m.x - SPAWN.x, m.z - SPAWN.z), m.id).toBeGreaterThan(r + 3);
    }
  });

  it("keeps the gate road open and stands clear of every prop, scenery piece and Standing torch", () => {
    for (const m of MARKET) expect(m.z > 26 && Math.abs(m.x) < 3 + radius(m), m.id).toBe(false);
    const others = [
      ...PROPS.map((p) => ({ id: p.id, x: p.x, z: p.z, r: p.solid })),
      ...SCENERY.filter((p) => p.y === 0).map((p) => ({ id: p.id, x: p.x, z: p.z, r: p.solid })),
      ...STANDING_TORCHES.map((t) => ({ id: t.id, x: t.x, z: t.z, r: 0.3 })),
    ];
    for (const m of MARKET)
      for (const o of others) expect(Math.hypot(m.x - o.x, m.z - o.z), `${m.id}/${o.id}`).toBeGreaterThan(radius(m) * 0.8 + o.r + 0.3);
  });

  it("leaves a walkway: no two pieces overlap, and the middle of the square is open", () => {
    for (let i = 0; i < MARKET.length; i++)
      for (let j = i + 1; j < MARKET.length; j++) {
        const a = MARKET[i];
        const b = MARKET[j];
        expect(Math.hypot(a.x - b.x, a.z - b.z), `${a.id}/${b.id}`).toBeGreaterThan((radius(a) + radius(b)) * 0.7);
      }
    for (const m of MARKET) expect(gapFrom(m, MARKET_CENTER), m.id).toBeGreaterThan(1.5);
  });
});
