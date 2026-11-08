import { describe, expect, it } from "vitest";
import { FIELD_BANNERS, FIELD_FOG_Z, FIELD_SPAWN, FIELD_TENT, FIELD_WALL_Z } from "./siegeField";
import { SIEGE_STONE, STORM_STONE, WINCH } from "./siegeFieldTools";
import { labelFor, labelOpacity, labelPx } from "./labelPlan";
import { yardFogTag } from "./siegeYardWordsV3";
import * as v2 from "./siegeYardWordsV2";

/** The Siege Field's near-only tags, at the heights and size factors SiegeField.tsx gives them. */
const TAGS = [
  { id: "tent", x: FIELD_TENT.x, y: 6, z: FIELD_TENT.z },
  { id: "winch", x: WINCH.x, y: 4.7, z: WINCH.z },
  { id: "storm stone", x: STORM_STONE.x, y: 3.3, z: STORM_STONE.z },
  { id: "siege stone", x: SIEGE_STONE.x, y: 3.3, z: SIEGE_STONE.z },
  { id: "fog", x: 0, y: 7.4, z: FIELD_FOG_Z },
  ...FIELD_BANNERS.map((b) => ({ id: b.id, x: b.x, y: 6, z: FIELD_WALL_Z })),
];
const FACTOR = 16;
const FOV = 60; // Scene.tsx

function shownFrom(cam: { x: number; y: number; z: number }): string[] {
  return TAGS.filter((t) => {
    const d = Math.hypot(t.x - cam.x, t.y - cam.y, t.z - cam.z);
    const look = labelFor({ kind: "name", distance: d, focused: false, fog: false });
    return labelOpacity(look, labelPx(FACTOR, FOV, d), false, false) > 0;
  }).map((t) => t.id);
}

describe("Siege Field tags from the camp", () => {
  it("shows at most about three tags where you arrive, standing or with the camera behind you", () => {
    expect(shownFrom({ x: FIELD_SPAWN.x, y: 1.7, z: FIELD_SPAWN.z }).length).toBeLessThanOrEqual(3);
    expect(shownFrom({ x: FIELD_SPAWN.x, y: 4, z: FIELD_SPAWN.z + 6 }).length).toBeLessThanOrEqual(3);
  });

  it("shows the nearby tools there, not the tent or the far wall", () => {
    const here = shownFrom({ x: FIELD_SPAWN.x, y: 1.7, z: FIELD_SPAWN.z });
    expect(here).toContain("winch");
    expect(here).not.toContain("tent");
    expect(here).not.toContain("fog");
  });
});

describe("the fog tag", () => {
  it("is a short tag, not a sentence, and counts honestly", () => {
    expect(yardFogTag(1)).toBe("1 tower in fog");
    expect(yardFogTag(3)).toBe("3 towers in fog");
    expect(yardFogTag(3).split(" ").length).toBeLessThanOrEqual(4);
  });

  it("leaves the full sentence in the panel's words (version 2 is untouched)", () => {
    expect(v2.yardFogTitle(1)).toContain("Too little price history");
  });
});
