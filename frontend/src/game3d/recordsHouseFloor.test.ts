import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { HOUSE_FLOOR_Y, HOUSE_RUG_Y, PADDOCK_Y } from "./holdingLandLogic";

// #516: the records house floor sat 0.01 above the paddock and the rug 0.02 above the floor, so the floor under the shelves
// z-fought and blinked. Flat layers stand at least 0.04 apart (the moat rule, #510).
describe("records house floor layers", () => {
  it("stand at least 0.04 apart", () => {
    expect(PADDOCK_Y).toBeGreaterThanOrEqual(0.02); // the grass disc is at 0
    expect(HOUSE_FLOOR_Y - PADDOCK_Y).toBeGreaterThanOrEqual(0.04 - 1e-9);
    expect(HOUSE_RUG_Y - HOUSE_FLOOR_Y).toBeGreaterThanOrEqual(0.04 - 1e-9);
  });
  it("are the heights the land draws", () => {
    const src = readFileSync(new URL("./HoldingLand.tsx", import.meta.url), "utf8");
    for (const name of ["PADDOCK_Y", "HOUSE_FLOOR_Y", "HOUSE_RUG_Y"]) expect(src).toContain(`${name}, `);
  });
});
