import { describe, expect, it, vi } from "vitest";
import type { Standing, StandingWire } from "../lib/types";
import { WIRE_BUTTON, WIRE_FAILED, WIRE_SAMPLE, WIRE_TITLE, lookAtWire, wireLine, wiresToShow } from "./wireWords";

const wire = (o: Partial<StandingWire> = {}): StandingWire => ({ id: "w1", ticker: "AKRBP.OL", label: "Margin below 10%", ...o });
const standing = (o: Partial<Standing> = {}): Standing => ({
  version: "v2", demo: false, level: 3, max_level: 4, title: "Reasons", next_step: null, gates: [], gaps: [],
  wires: [wire()], ...o,
});

describe("wire words", () => {
  it("name the ticker in game voice and stay within the word budgets", () => {
    expect(wireLine(wire())).toBe("A wire fired on AKRBP.OL. Look at it.");
    expect(wireLine(wire({ ticker: "  " }))).toBe("A wire fired. Look at it.");
    expect(wireLine(wire()).split(/\s+/).length).toBeLessThanOrEqual(12);
    expect(WIRE_BUTTON.split(/\s+/).length).toBeLessThanOrEqual(3);
    expect(WIRE_TITLE.split(/\s+/).length).toBeLessThanOrEqual(5);
  });

  it("never gives advice, buy or sell words, a score or cheering", () => {
    const all = [wireLine(wire()), WIRE_BUTTON, WIRE_FAILED, WIRE_SAMPLE, WIRE_TITLE].join(" ");
    expect(all).not.toMatch(/\b(buy|sell|trim|should|great job|well done|congrat|xp|points|streak)/i);
  });
});

describe("wiresToShow", () => {
  it("lists the fired, unseen wires of a real fortress", () => {
    expect(wiresToShow(standing(), false)).toHaveLength(1);
  });
  it("lists nothing while loading, when unreadable, for the sample, or from an older backend", () => {
    expect(wiresToShow(null, false)).toEqual([]);
    expect(wiresToShow(standing(), true)).toEqual([]);
    expect(wiresToShow(standing({ demo: true }), false)).toEqual([]);
    expect(wiresToShow(standing({ wires: undefined }), false)).toEqual([]);
  });
});

describe("lookAtWire", () => {
  it("marks the wire seen, then reads the Standing again", async () => {
    const acknowledge = vi.fn().mockResolvedValue({});
    const reread = vi.fn().mockResolvedValue(undefined);
    expect(await lookAtWire(wire(), { demo: false, acknowledge, reread })).toEqual({ ok: true });
    expect(acknowledge).toHaveBeenCalledWith("w1");
    expect(reread).toHaveBeenCalledTimes(1);
  });

  it("on the sample fortress marks nothing and says so", async () => {
    const acknowledge = vi.fn();
    const reread = vi.fn();
    expect(await lookAtWire(wire(), { demo: true, acknowledge, reread })).toEqual({ ok: false, message: WIRE_SAMPLE });
    expect(acknowledge).not.toHaveBeenCalled();
    expect(reread).not.toHaveBeenCalled();
  });

  it("when the call fails the wire stays unseen: it says so and does not re-read as if it had worked", async () => {
    const reread = vi.fn();
    const out = await lookAtWire(wire(), { demo: false, acknowledge: () => Promise.reject(new Error("503")), reread });
    expect(out).toEqual({ ok: false, message: WIRE_FAILED });
    expect(reread).not.toHaveBeenCalled();
  });

  it("when only the re-read fails the mark still counts", async () => {
    const out = await lookAtWire(wire(), {
      demo: false, acknowledge: () => Promise.resolve({}), reread: () => Promise.reject(new Error("offline")),
    });
    expect(out).toEqual({ ok: true });
  });
});
