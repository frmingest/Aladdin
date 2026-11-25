import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { MOAT_Y } from "./towerLook";

// #510: the moat and stream rings blinked because they sat within 0.01 of the cobble plaza top (0.06) and gate road top (0.07).
describe("moat ring height", () => {
  it("clears the plaza and the gate road by a safe margin", () => {
    const court = readFileSync(new URL("./Courtyard.tsx", import.meta.url), "utf8");
    expect(court).toContain("0.06, 48"); // cobble cylinder is 0.06 tall, centred at 0.03: top at 0.06
    expect(MOAT_Y - 0.07).toBeGreaterThanOrEqual(0.04);
  });
  it("is used by the tower moat and the stream band", () => {
    for (const f of ["./TowerMesh.tsx", "./StreamBand.tsx"]) {
      expect(readFileSync(new URL(f, import.meta.url), "utf8")).toContain("MOAT_Y");
    }
  });
});
