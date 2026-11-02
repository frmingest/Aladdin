import { describe, expect, it } from "vitest";
import { towerSpots } from "./layout";
import { exitCameraYaw, exitSpot } from "./towerDoor";
import { hallExit } from "./townHallRoom";
import { archiveExit } from "./recordsHallRoom";
import { GATE_RETURN, GATE_RETURN_YAW } from "./townPlan";

/**
 * S21 lock: where the hero stands when stepping back out of each place, written down BEFORE the area registry
 * replaced the four hand-written teleport effects. If one of these moves, a door now drops you somewhere new.
 */
const RADII = [1.2, 1.5, 1.8, 2.1];
const round = (n: number) => Math.round(n * 1e6) / 1e6;

describe("exit spots (locked before S21)", () => {
  it("tower pads", () => {
    const rows = towerSpots().flatMap((s, i) =>
      RADII.map((r) => {
        const out = exitSpot(s, r);
        return [i, r, round(out.x), round(out.z), round(exitCameraYaw(s, out))];
      }),
    );
    expect(rows).toMatchSnapshot();
  });
  it("town hall, records hall and the gate", () => {
    const h = hallExit();
    const a = archiveExit();
    expect({
      hall: [round(h.x), round(h.z), round(h.yaw)],
      archive: [round(a.x), round(a.z), round(a.yaw)],
      gate: [GATE_RETURN.x, GATE_RETURN.z, GATE_RETURN_YAW],
    }).toMatchSnapshot();
  });
});
