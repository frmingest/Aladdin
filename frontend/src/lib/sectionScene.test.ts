import { describe, expect, it } from "vitest";
import { accountPips, beaconFor, bastionId, pennantFor, vaultScene } from "./sectionScene";

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
