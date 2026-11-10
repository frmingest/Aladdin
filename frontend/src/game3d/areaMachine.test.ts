import { describe, expect, it } from "vitest";
import { INITIAL_AREA, areaReducer, isMoving } from "./areaMachine";
import type { AreaAction, AreaState } from "./areaMachine";

const run = (actions: AreaAction[], from: AreaState = INITIAL_AREA) => actions.reduce(areaReducer, from);
/** One whole move: fade out, arrive in the dark, floor ready, fade in. */
const settle = (s: AreaState) => run([{ type: "fadeDone" }, { type: "ready" }, { type: "fadeDone" }], s);
const go = (s: AreaState, action: AreaAction) => settle(areaReducer(s, action));

describe("area reducer", () => {
  it("starts in the courtyard", () => {
    expect(INITIAL_AREA.current).toEqual({ id: "courtyard" });
    expect(INITIAL_AREA.phase).toBe("idle");
  });

  it("goes into the Hall of Records straight from the meadow outside the gate, and back out in one step", () => {
    const records = go(INITIAL_AREA, { type: "enter", ref: { id: "records" } });
    expect(records.current.id).toBe("records");
    expect(records.from?.id).toBe("courtyard");
    const back = go(records, { type: "leave" });
    expect(back.current.id).toBe("courtyard");
    expect(back.from?.id).toBe("records");
  });

  it("goes into the Town Hall straight from the meadow outside the gate, and back out in one step", () => {
    const hall = go(INITIAL_AREA, { type: "enter", ref: { id: "townhall" } });
    expect(hall.current.id).toBe("townhall");
    expect(hall.from?.id).toBe("courtyard");
    const back = go(hall, { type: "leave" });
    expect(back.current.id).toBe("courtyard");
    expect(back.from?.id).toBe("townhall");
  });

  it("walks fadingOut, loading, fadingIn, idle, and stays in the old place until the screen is dark", () => {
    const out = areaReducer(INITIAL_AREA, { type: "enter", ref: { id: "siege" } });
    expect(out.phase).toBe("fadingOut");
    expect(out.current.id).toBe("courtyard");
    expect(out.next?.id).toBe("siege");
    const loading = areaReducer(out, { type: "fadeDone" });
    expect(loading.phase).toBe("loading");
    expect(loading.current.id).toBe("siege");
    expect(loading.next).toBeNull();
    const inn = areaReducer(loading, { type: "ready" });
    expect(inn.phase).toBe("fadingIn");
    expect(areaReducer(inn, { type: "fadeDone" }).phase).toBe("idle");
  });

  it("does not stack: a second enter or leave during a move is ignored", () => {
    const out = areaReducer(INITIAL_AREA, { type: "enter", ref: { id: "siege" } });
    expect(areaReducer(out, { type: "enter", ref: { id: "holding", holdingId: "h1" } })).toBe(out);
    expect(areaReducer(out, { type: "leave" })).toBe(out);
    const loading = areaReducer(out, { type: "fadeDone" });
    expect(areaReducer(loading, { type: "enter", ref: { id: "townhall" } })).toBe(loading);
  });

  it("ignores ready and fadeDone when no move is under way", () => {
    expect(areaReducer(INITIAL_AREA, { type: "ready" })).toBe(INITIAL_AREA);
    expect(areaReducer(INITIAL_AREA, { type: "fadeDone" })).toBe(INITIAL_AREA);
    expect(areaReducer(INITIAL_AREA, { type: "fail" })).toBe(INITIAL_AREA);
  });

  it("cuts straight to idle when asked (reduced motion), even in the middle of a move", () => {
    const cut = areaReducer(INITIAL_AREA, { type: "enter", ref: { id: "siege" }, instant: true });
    expect(cut).toEqual({ current: { id: "siege" }, from: { id: "courtyard" }, phase: "idle", next: null, failed: false });
    const out = areaReducer(INITIAL_AREA, { type: "enter", ref: { id: "siege" } });
    const mid = areaReducer(out, { type: "enter", ref: { id: "records" }, instant: true });
    expect(mid.phase).toBe("idle");
    expect(mid.current.id).toBe("records");
    expect(areaReducer(cut, { type: "leave", instant: true }).current.id).toBe("courtyard");
  });

  it("sends you back if the new place never appears, and says so until the next move", () => {
    const loading = areaReducer(areaReducer(INITIAL_AREA, { type: "enter", ref: { id: "siege" } }), { type: "fadeDone" });
    const back = areaReducer(loading, { type: "fail" });
    expect(back.current.id).toBe("courtyard");
    expect(back.phase).toBe("fadingIn");
    expect(back.failed).toBe(true);
    const idle = areaReducer(back, { type: "fadeDone" });
    expect(areaReducer(idle, { type: "enter", ref: { id: "siege" } }).failed).toBe(false);
  });

  it("leaves a holding's land to the courtyard", () => {
    const s = go(go(INITIAL_AREA, { type: "enter", ref: { id: "holding", holdingId: "h1" } }), { type: "leave" });
    expect(s.current.id).toBe("courtyard");
    expect(s.from).toEqual({ id: "holding", holdingId: "h1" });
  });

  it("does nothing on leave at the courtyard", () => {
    expect(areaReducer(INITIAL_AREA, { type: "leave" })).toBe(INITIAL_AREA);
  });

  it("ignores entering where you already are, but not another holding", () => {
    const a = go(INITIAL_AREA, { type: "enter", ref: { id: "holding", holdingId: "h1" } });
    expect(areaReducer(a, { type: "enter", ref: { id: "holding", holdingId: "h1" } })).toBe(a);
    expect(areaReducer(a, { type: "enter", ref: { id: "holding", holdingId: "h2" } }).next).toEqual({ id: "holding", holdingId: "h2" });
  });

  it("falls back to the courtyard for a land with no holding", () => {
    const a = go(INITIAL_AREA, { type: "enter", ref: { id: "holding", holdingId: "h1" } });
    expect(areaReducer(a, { type: "enter", ref: { id: "holding", holdingId: "" } }).next?.id).toBe("courtyard");
    expect(areaReducer(INITIAL_AREA, { type: "enter", ref: { id: "holding", holdingId: "" } })).toBe(INITIAL_AREA);
  });
});

describe("hold still", () => {
  it("holds the hero (no walking, no E) in every phase but idle", () => {
    const out = areaReducer(INITIAL_AREA, { type: "enter", ref: { id: "siege" } });
    const loading = areaReducer(out, { type: "fadeDone" });
    const inn = areaReducer(loading, { type: "ready" });
    expect([INITIAL_AREA, out, loading, inn, areaReducer(inn, { type: "fadeDone" })].map(isMoving)).toEqual([false, true, true, true, false]);
  });
});
