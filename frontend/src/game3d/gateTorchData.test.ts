import { describe, expect, it } from "vitest";
import { wallSegments } from "./layout";
import { BEAM_Y, GATE_TORCHES, POST_HEIGHT, POST_X, POST_Z, gateOpeningHalfWidth, torchesLit } from "./gateTorchData";

describe("gate torches", () => {
  it("light left to right with the level: 0 dark, 3 all lit, never more lit than the level", () => {
    for (const level of [0, 1, 2, 3] as const) {
      const lit = torchesLit(level);
      expect(lit).toHaveLength(3);
      expect(lit.filter(Boolean).length).toBe(level);
    }
    expect(torchesLit(1)).toEqual([true, false, false]);
    expect(torchesLit(2)).toEqual([true, true, false]);
    expect(torchesLit(0)).toEqual([false, false, false]);
  });

  it("has three torches with distinct ids, in west, centre, east order", () => {
    expect(GATE_TORCHES.map((t) => t.id)).toEqual(["west", "centre", "east"]);
    expect(GATE_TORCHES[0].x).toBeLessThan(GATE_TORCHES[1].x);
    expect(GATE_TORCHES[1].x).toBeLessThan(GATE_TORCHES[2].x);
  });

  it("keeps the posts inside the gate opening, clear of the wall and the walking road", () => {
    expect(POST_X).toBeLessThan(gateOpeningHalfWidth() - 0.5);
    expect(POST_X).toBeGreaterThan(3 + 1); // the gate road is 6 wide
    for (const s of wallSegments()) {
      // Distance from each post to the wall piece's centre line, along its own axis.
      for (const px of [-POST_X, POST_X]) {
        const dx = px - s.x;
        const dz = POST_Z - s.z;
        const along = dx * Math.cos(s.rotY) - dz * Math.sin(s.rotY);
        const across = dx * Math.sin(s.rotY) + dz * Math.cos(s.rotY);
        const inside = Math.abs(along) < s.length / 2 + 0.5 && Math.abs(across) < 0.8 + 0.5;
        expect(inside, `post ${px} touches wall piece at ${s.x.toFixed(1)}`).toBe(false);
      }
    }
  });

  it("leaves room to walk under the beam", () => {
    expect(BEAM_Y).toBeGreaterThan(POST_HEIGHT);
    expect(BEAM_Y - 0.9).toBeGreaterThan(5); // the hanging lantern is well above the hero (about 1.8)
  });
});
