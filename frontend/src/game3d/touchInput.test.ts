import { afterEach, describe, expect, it } from "vitest";
import {
  NO_STICK,
  STICK_RADIUS,
  knobOffset,
  loadStickSide,
  pinchZoom,
  releaseStick,
  saveStickSide,
  sealLabel,
  sealWord,
  setStick,
  stickCentre,
  stickInput,
  touchStick,
} from "./touchInput";

const R = STICK_RADIUS;

describe("stickInput (#485)", () => {
  it("stands still while the thumb rests near the centre", () => {
    expect(stickInput(0, 0)).toEqual(NO_STICK);
    expect(stickInput(R * 0.1, 0)).toEqual(NO_STICK);
  });

  it("walks forward when pushed up the screen, and sideways when pushed across", () => {
    const up = stickInput(0, -R / 2);
    expect(up.fwd).toBeCloseTo(0.5, 6);
    expect(up.side).toBeCloseTo(0, 6);
    expect(up.run).toBe(false);
    const right = stickInput(R / 2, 0);
    expect(right.side).toBeCloseTo(0.5, 6);
    expect(right.fwd).toBeCloseTo(0, 6);
    const back = stickInput(0, R / 2);
    expect(back.fwd).toBeCloseTo(-0.5, 6);
  });

  it("runs when pushed to the rim, and pushing past the rim is the same as the rim", () => {
    expect(stickInput(0, -R * 0.8).run).toBe(false);
    expect(stickInput(0, -R * 0.9).run).toBe(true);
    const far = stickInput(R * 3, -R * 3);
    expect(Math.hypot(far.fwd, far.side)).toBeCloseTo(1, 6);
    expect(far.run).toBe(true);
  });

  it("holds the knob inside the rim, in the thumb's direction", () => {
    expect(knobOffset(10, -5)).toEqual({ x: 10, y: -5 });
    const k = knobOffset(R * 2, 0);
    expect(k.x).toBeCloseTo(R, 6);
    expect(k.y).toBeCloseTo(0, 6);
  });

  it("puts the stick on the thumb, but never so near an edge that the rose is cut off", () => {
    expect(stickCentre(100, 120, 250, 240)).toEqual({ x: 100, y: 120 });
    expect(stickCentre(5, 238, 250, 240)).toEqual({ x: R, y: 240 - R });
  });
});

describe("the shared stick value", () => {
  afterEach(() => releaseStick());
  it("is written by the stick and put back to rest on release", () => {
    setStick({ fwd: 0.4, side: -0.2, run: false });
    expect(touchStick).toEqual({ fwd: 0.4, side: -0.2, run: false });
    releaseStick();
    expect(touchStick).toEqual(NO_STICK);
  });
});

describe("sealWord: the seal shows the prompt's own word, only for an E action", () => {
  it("takes the first word of what E does", () => {
    expect(sealWord("Press E to talk to Barren Wuffet")).toBe("Talk");
    expect(sealWord("Press E to read the signpost")).toBe("Read");
    expect(sealWord("Press E to open Sal's counter")).toBe("Open");
    expect(sealWord("Press E to pull Toll Gate")).toBe("Pull");
    expect(sealWord("Press E to STAMP")).toBe("STAMP");
  });

  it("shows no seal for a prompt that is not an E action, or no prompt", () => {
    expect(sealWord("Pull a lever first, then STAMP")).toBeNull();
    expect(sealWord("Shut while you look back. Press H for today")).toBeNull();
    expect(sealWord("Stamping...")).toBeNull();
    expect(sealWord(null)).toBeNull();
    expect(sealWord("")).toBeNull();
  });

  it("names the whole action for a screen reader", () => {
    expect(sealLabel("Press E to talk to Barren Wuffet")).toBe("Talk to Barren Wuffet");
  });
});

describe("pinchZoom", () => {
  it("moves the camera in when the fingers spread and out when they close", () => {
    expect(pinchZoom(7, 100, 200)).toBeLessThan(7);
    expect(pinchZoom(7, 200, 100)).toBeGreaterThan(7);
    expect(pinchZoom(7, 150, 150)).toBe(7);
  });
});

describe("stick side (left hands)", () => {
  const memory = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };
  it("defaults to the left, and keeps a swap", () => {
    const store = memory();
    expect(loadStickSide(store)).toBe("left");
    saveStickSide("right", store);
    expect(loadStickSide(store)).toBe("right");
  });
  it("falls back to the left when storage is missing or throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("no storage");
      },
      setItem: () => {
        throw new Error("no storage");
      },
    };
    expect(loadStickSide(null)).toBe("left");
    expect(loadStickSide(broken)).toBe("left");
    expect(() => saveStickSide("right", broken)).not.toThrow();
  });
});
