import { describe, expect, it } from "vitest";
import {
  SOURCE_NOTE,
  changesOn,
  clampIndex,
  describeFrame,
  frameTitle,
  headline,
  miniLayout,
  newestIndex,
  nextPlayIndex,
} from "./chronicle";
import type { Chronicle, ChronicleFrame, ChronicleTower } from "./types";

const tower = (name: string, weight: string | null, over: Partial<ChronicleTower> = {}): ChronicleTower => ({
  holding_id: name, ticker: name.toUpperCase(), name, structure: "keep", size_class: "medium", weight_pct: weight,
  wall: "granite", moat: "wide", land: "fog", thesis: "intact", ...over,
});
const frame = (day: string, towers: ChronicleTower[], over: Partial<ChronicleFrame> = {}): ChronicleFrame => ({
  day, at: `${day}T05:00:00Z`, source: "stored", total_value_nok: "1000", weather: "calm", towers, ...over,
});
const chronicle = (frames: ChronicleFrame[]): Chronicle => ({
  rules_version: "v1", demo: false, frames, changes: [], stored_frames: frames.filter((f) => f.source === "stored").length,
  positions_only_frames: frames.filter((f) => f.source !== "stored").length, first_stored_day: null, hidden_frames: 0, notes: [],
});

describe("frame navigation", () => {
  it("opens on the newest frame and clamps junk", () => {
    const c = chronicle([frame("2026-09-01", []), frame("2026-09-02", [])]);
    expect(newestIndex(c)).toBe(1);
    expect(newestIndex(chronicle([]))).toBe(-1);
    expect(clampIndex(-3, 5)).toBe(0);
    expect(clampIndex(99, 5)).toBe(4);
    expect(clampIndex(Number.NaN, 5)).toBe(4);
    expect(clampIndex(2.6, 5)).toBe(3);
    expect(clampIndex(0, 0)).toBe(-1);
  });

  it("plays forward and stops at the newest frame instead of wrapping", () => {
    expect(nextPlayIndex(0, 3)).toEqual({ index: 1, done: false });
    expect(nextPlayIndex(1, 3)).toEqual({ index: 2, done: true });
    expect(nextPlayIndex(2, 3)).toEqual({ index: 2, done: true });
    expect(nextPlayIndex(0, 0)).toEqual({ index: -1, done: true });
  });
});

describe("changes and wording", () => {
  it("returns only the changes that arrived on that day", () => {
    const c = chronicle([]);
    c.changes = [
      { day: "2026-09-02", kind: "tower_added", holding_id: null, holding_name: null, text: "A joined." },
      { day: "2026-09-03", kind: "tower_removed", holding_id: null, holding_name: null, text: "B left." },
    ];
    expect(changesOn(c, "2026-09-03").map((x) => x.text)).toEqual(["B left."]);
    expect(changesOn(c, "2026-09-09")).toEqual([]);
  });

  it("titles a frame and describes it, saying when the weather was not recorded", () => {
    expect(frameTitle(frame("2026-09-02", []))).toMatch(/2026/);
    expect(frameTitle(frame("not-a-date", []))).toBe("not-a-date");
    expect(describeFrame(frame("2026-09-02", [tower("A", "50")]))).toContain("1 tower. Weather calm.");
    expect(describeFrame(frame("2026-09-02", [], { source: "positions_only" }))).toContain("Weather not recorded.");
  });

  it("says what a positions-only frame can and cannot show", () => {
    expect(SOURCE_NOTE.positions_only).toContain("cannot be rebuilt");
    expect(SOURCE_NOTE.stored).toContain("what the Fortress showed");
  });

  it("headlines the replay, and an empty one honestly", () => {
    const c = chronicle([frame("2026-09-01", [], { source: "positions_only" }), frame("2026-09-02", [])]);
    expect(headline(c)).toContain("2 frames");
    expect(headline(c)).toContain("1 stored, 1 rebuilt from imports");
    expect(headline(chronicle([]))).toBe("Nothing to replay yet.");
  });
});

describe("miniLayout", () => {
  it("puts the biggest tower first and makes it the widest", () => {
    const f = frame("2026-09-02", [tower("Small", "5"), tower("Big", "40"), tower("Unknown", null)]);
    const placed = miniLayout(f);
    expect(placed.map((p) => p.tower.name)).toEqual(["Big", "Small", "Unknown"]);
    expect(placed[0].w).toBeGreaterThan(placed[1].w);
    expect(placed.every((p, i) => i === 0 || p.x > placed[i - 1].x)).toBe(true);
  });

  it("marks every tower of a positions-only frame as a ghost and none of a stored one", () => {
    const towers = [tower("A", "50"), tower("B", "50")];
    expect(miniLayout(frame("d", towers, { source: "positions_only" })).every((p) => p.ghost)).toBe(true);
    expect(miniLayout(frame("d", towers)).some((p) => p.ghost)).toBe(false);
  });

  it("scales a crowded frame to fit the width", () => {
    const towers = Array.from({ length: 40 }, (_, i) => tower(`T${i}`, "5"));
    const placed = miniLayout(frame("d", towers), 760);
    const last = placed[placed.length - 1];
    expect(last.x + last.w).toBeLessThanOrEqual(760);
  });

  it("copes with an empty frame", () => {
    expect(miniLayout(frame("d", []))).toEqual([]);
  });
});
