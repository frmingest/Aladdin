import { describe, expect, it } from "vitest";
import { REGISTER, embedUrl } from "./parity3d";
import { STALL_LEAVE_RANGE, STALL_RANGE, nearestStall, stallPrompt, storeDoor } from "./stallDoor";
import { STREET_PLOTS } from "./streetPlan";

const stalls = STREET_PLOTS.slice(0, 3).map((p, i) => ({ holdingId: `h${i}`, x: p.x, z: p.z }));

describe("stall reach", () => {
  it("finds nobody far from every stall", () => {
    expect(nearestStall({ x: 0, z: 0 }, stalls)).toBeNull();
  });
  it("finds the stall you stand next to", () => {
    expect(nearestStall({ x: stalls[1].x + 1, z: stalls[1].z + 1 }, stalls)).toBe("h1");
  });
  it("picks the nearer of two in reach", () => {
    const a = { holdingId: "a", x: 0, z: 0 };
    const b = { holdingId: "b", x: 3, z: 0 };
    expect(nearestStall({ x: 2, z: 0 }, [a, b])).toBe("b");
  });
  it("leaves at a wider range than it arrives", () => {
    expect(STALL_LEAVE_RANGE).toBeGreaterThan(STALL_RANGE);
  });
  it("reaches no stall from another plot", () => {
    for (const s of stalls) {
      const others = stalls.filter((o) => o !== s);
      expect(nearestStall(s, others)).toBeNull();
    }
  });
});

describe("store door", () => {
  it("opens that company's store page in the world frame", () => {
    const d = storeDoor("abc 1");
    expect(d).not.toBeNull();
    expect(embedUrl(d!)).toBe("/fortress/marketplace/abc%201?embed=world");
  });
  it("is null if the register has no store row", () => {
    expect(storeDoor("x", REGISTER.filter((r) => r.via !== "/fortress/marketplace"))).toBeNull();
  });
  it("prompt names the company", () => {
    expect(stallPrompt("Acme")).toContain("Acme");
  });
});
