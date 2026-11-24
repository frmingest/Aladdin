import { describe, expect, it } from "vitest";
import { PIP, V1_WALL, landFor, practiceTiers, wallFor } from "./practiceCompanyV1";

/**
 * The practice can never teach a meaning the real fortress does not use (#493, spec section 1). The tiers below must follow
 * from Pip's numbers under the real thresholds in `backend/app/domain/game_mapping/v1.py` (granite up to 1x a year's
 * earnings, brick up to 2.5x, timber up to 4x, interest cover under 3x one tier down; the active v2 keeps them) and the land
 * zones in `backend/app/services/valuation/board.py` `_zone`. This test lives in the frontend, so it cannot see a backend
 * change: a new mapping version with other wall thresholds, or an edit to `rules.py` or `_zone`, needs `practiceCompanyV2.ts`
 * and this test changed with it (a backend cross-check is an open follow-up, see the PR).
 */
describe("Pip's Lemonade under the real v1 rules", () => {
  it("carries the v1 thresholds", () => {
    expect(V1_WALL).toEqual({ graniteMax: 1.0, brickMax: 2.5, timberMax: 4.0, weakCover: 3 });
  });

  it("before the storm: owes 5, made 10, so granite; a narrow moat; price 7 under the low guess 8, so a bargain", () => {
    const t = practiceTiers("calm");
    expect(t.wall).toBe("granite");
    expect(t.moat).toBe("narrow");
    expect(t.land).toBe("bargain");
    expect(t.price).toBe(7);
    expect(t.room).toBe(3);
    expect(t.roomShare).toBe(0.3);
    expect(practiceTiers("storm").roomShare).toBe(0.51);
    expect(practiceTiers("secondStorm").roomShare).toBe(0.46);
  });

  it("after the storm: the price is 4.9 exactly and nothing about the business moved", () => {
    const t = practiceTiers("storm");
    expect(t.price).toBe(4.9);
    expect(t.wall).toBe("granite");
    expect(t.land).toBe("bargain");
    expect(t.worth).toEqual(PIP.worth);
  });

  it("after the second storm: owes 15 against 10 a year, 1.5x, so brick; worth falls a coin a piece; still a bargain at 4.9", () => {
    const t = practiceTiers("secondStorm");
    expect(t.owes).toBe(15);
    expect(t.wall).toBe("brick");
    expect(t.worth).toEqual({ low: 7, middle: 9, high: 11 });
    expect(t.price).toBe(4.9);
    expect(t.land).toBe("bargain");
  });

  it("the wall rule matches the backend at its edges", () => {
    expect(wallFor(0, 10, 0)).toBe("basalt");
    expect(wallFor(5, 0, 0)).toBe("rotted");
    expect(wallFor(10, 10, 0)).toBe("granite");
    expect(wallFor(25, 10, 0)).toBe("brick");
    expect(wallFor(40, 10, 0)).toBe("timber");
    expect(wallFor(41, 10, 0)).toBe("rotted");
    // Weak interest cover (10 / 4 = 2.5x) drops granite to brick, and never goes below rotted.
    expect(wallFor(5, 10, 4)).toBe("brick");
    expect(wallFor(50, 10, 4)).toBe("rotted");
    // Unknown stays unknown, never a weak wall.
    expect(wallFor(Number.NaN, 10, 0.5)).toBe("unsurveyed");
    expect(wallFor(5, Number.NaN, 0.5)).toBe("unsurveyed");
  });

  it("the land rule matches the backend's zones", () => {
    const w = { low: 8, middle: 10, high: 12 };
    expect(landFor(7, w)).toBe("bargain");
    expect(landFor(9, w)).toBe("discount");
    expect(landFor(11, w)).toBe("full_price");
    expect(landFor(13, w)).toBe("overpriced");
    // The edges, as board.py's _zone draws them: strict below the low guess, inclusive at the middle and the high.
    expect(landFor(8, w)).toBe("discount");
    expect(landFor(10, w)).toBe("discount");
    expect(landFor(12, w)).toBe("full_price");
  });
});
