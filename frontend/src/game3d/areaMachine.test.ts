import { describe, expect, it } from "vitest";
import { INITIAL_AREA, areaReducer } from "./areaMachine";
import type { AreaAction, AreaState } from "./areaMachine";

const run = (actions: AreaAction[], from: AreaState = INITIAL_AREA) => actions.reduce(areaReducer, from);

describe("area reducer", () => {
  it("starts in the courtyard", () => {
    expect(INITIAL_AREA.current).toEqual({ id: "courtyard" });
    expect(INITIAL_AREA.phase).toBe("idle");
  });

  it("goes in through the gate, into the hall, and back out one step at a time", () => {
    const town = run([{ type: "enter", ref: { id: "town" } }]);
    expect(town.current.id).toBe("town");
    expect(town.from?.id).toBe("courtyard");
    const hall = areaReducer(town, { type: "enter", ref: { id: "townhall" } });
    expect(hall.current.id).toBe("townhall");
    const back = areaReducer(hall, { type: "leave" });
    expect(back.current.id).toBe("town");
    expect(back.from?.id).toBe("townhall");
    expect(areaReducer(back, { type: "leave" }).current.id).toBe("courtyard");
  });

  it("leaves a tower library to the courtyard", () => {
    const s = run([{ type: "enter", ref: { id: "library", holdingId: "h1" } }, { type: "leave" }]);
    expect(s.current.id).toBe("courtyard");
    expect(s.from).toEqual({ id: "library", holdingId: "h1" });
  });

  it("does nothing on leave at the courtyard", () => {
    expect(areaReducer(INITIAL_AREA, { type: "leave" })).toBe(INITIAL_AREA);
  });

  it("ignores entering where you already are, but not another holding", () => {
    const a = run([{ type: "enter", ref: { id: "library", holdingId: "h1" } }]);
    expect(areaReducer(a, { type: "enter", ref: { id: "library", holdingId: "h1" } })).toBe(a);
    expect(areaReducer(a, { type: "enter", ref: { id: "library", holdingId: "h2" } }).current).toEqual({ id: "library", holdingId: "h2" });
  });

  it("falls back to the courtyard for a library with no holding", () => {
    const a = run([{ type: "enter", ref: { id: "library", holdingId: "h1" } }]);
    expect(areaReducer(a, { type: "enter", ref: { id: "library", holdingId: "" } }).current.id).toBe("courtyard");
    expect(areaReducer(INITIAL_AREA, { type: "enter", ref: { id: "library", holdingId: "" } })).toBe(INITIAL_AREA);
  });

  it("ready and fadeDone change nothing while the phase is trivial", () => {
    const a = run([{ type: "enter", ref: { id: "town" } }]);
    expect(areaReducer(a, { type: "ready" })).toBe(a);
    expect(areaReducer(a, { type: "fadeDone" })).toBe(a);
    expect(a.phase).toBe("idle");
  });
});
