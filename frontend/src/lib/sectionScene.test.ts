import { describe, expect, it } from "vitest";
import { accountPips, beaconFor, bastionId, pennantFor, spreadScene, vaultScene } from "./sectionScene";

describe("pennantFor", () => {
  it("gives each level its own shape, so colour is never alone", () => {
    const shapes = (["sound", "mixed", "attention", "unknown"] as const).map((l) => pennantFor(l).shape);
    expect(new Set(shapes).size).toBe(4);
  });
  it("draws unknown as a blank flag, never a default-good one", () => {
    expect(pennantFor("unknown").shape).toBe("blank");
    expect(pennantFor("sound").tone).not.toMatch(/positive/);
  });
});

describe("beaconFor", () => {
  it("is lit only for a watch that reported on time and found nothing", () => {
    expect(beaconFor("quiet", "ok")).toBe("lit");
    expect(beaconFor("attention", "ok")).toBe("alert");
  });
  it("never draws a silent watch as lit", () => {
    expect(beaconFor("quiet", "old")).toBe("out");
    expect(beaconFor("quiet", "never")).toBe("out");
    expect(beaconFor("unknown", "ok")).toBe("out");
  });
});

describe("vaultScene", () => {
  it("fogs an unentered vault instead of drawing it empty", () => {
    expect(vaultScene("unsurveyed")).toEqual({ fill: 0, fog: true });
    expect(vaultScene("empty").fog).toBe(false);
  });
  it("ranks the levels deep to empty", () => {
    const f = (["deep", "stocked", "thin", "empty"] as const).map((l) => vaultScene(l).fill);
    expect([...f].sort((a, b) => b - a)).toEqual(f);
  });
});

describe("accountPips and bastionId", () => {
  it("counts filled and hollow pips and caps long lists", () => {
    expect(accountPips(2, 4)).toEqual({ filled: 2, hollow: 2, more: 0 });
    expect(accountPips(20, 20)).toEqual({ filled: 12, hollow: 0, more: 8 });
    expect(accountPips(0, 0)).toEqual({ filled: 0, hollow: 0, more: 0 });
  });
  it("names the scene's own bastion for a rung", () => {
    expect(bastionId("brick")).toBe("bastion-brick");
  });
});

describe("spreadScene", () => {
  it("draws the largest first and as wide as its share", () => {
    const s = spreadScene([10, 50, 40], 2.8);
    expect(s.towers).toHaveLength(3);
    expect(s.towers[0].w).toBeGreaterThan(s.towers[1].w);
    expect(s.towers[1].w).toBeGreaterThan(s.towers[2].w);
    expect(s.towers[0].h).toBeGreaterThan(s.towers[2].h);
  });
  it("gives a holding with no weight a fogged tower, never zero and never counted in the top five", () => {
    const s = spreadScene([30, null, 70], 1.7);
    expect(s.unweighted).toBe(1);
    expect(s.towers.filter((t) => t.fog)).toHaveLength(1);
    expect(s.towers.at(-1)?.fog).toBe(true);
    expect(s.topFive?.x).toBe(s.towers[0].x);
  });
  it("shows no equal-weight row when the effective count is unknown, and no towers without weights", () => {
    expect(spreadScene([40, 60], null).ghosts).toBeNull();
    expect(spreadScene([null, null], 2).towers).toEqual([]);
  });
  it("rounds the effective holdings into equal ghost towers across the same width", () => {
    const g = spreadScene([20, 20, 20, 20, 20], 4.6).ghosts!;
    expect(g).toHaveLength(5);
    expect(new Set(g.map((x) => x.w.toFixed(3))).size).toBe(1);
  });
  it("turns a long tail into a count, not slivers", () => {
    const s = spreadScene(Array.from({ length: 30 }, () => 3), 30);
    expect(s.towers).toHaveLength(12);
    expect(s.tail).toBe(18);
    expect(s.ghosts).toHaveLength(12);
  });
});
