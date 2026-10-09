import { describe, expect, it } from "vitest";
import { COUNCIL_KINDS, MAX_PAPERS, councilSeats, seatLabel, seatPositions } from "./councilSeats";
import { COUNCIL_LABEL } from "./rituals";
import type { CouncilItem, CouncilKind } from "./types";

function item(kind: CouncilKind, over: Partial<CouncilItem> = {}): CouncilItem {
  return { kind, tone: "note", title: "t", text: "x", holdings: [], more: 0, facts: [], ...over };
}
const hold = (n: number) => Array.from({ length: n }, (_, i) => ({ holding_id: String(i), name: `H${i}`, weight_pct: "1.0" }));

describe("council seats", () => {
  it("has exactly one seat per agenda kind, in the fixed order", () => {
    const seats = councilSeats({ items: [] });
    expect(seats.map((s) => s.kind)).toEqual(COUNCIL_KINDS);
    expect(seats).toHaveLength(8);
    expect(Object.keys(COUNCIL_LABEL)).toEqual(COUNCIL_KINDS);
  });

  it("an empty agenda is eight neutral chairs: nothing occupied, no count, no papers, no tone", () => {
    for (const s of councilSeats({ items: [] })) {
      expect(s.occupied).toBe(false);
      expect(s.count).toBeNull();
      expect(s.papers).toBe(0);
      expect(s.tone).toBeNull();
      expect(seatLabel(s)).toContain("none found");
    }
  });

  it("marks occupied seats from the items and keeps the tone", () => {
    const seats = councilSeats({ items: [item("cash", { tone: "warning" }), item("tripwire")] });
    expect(seats.find((s) => s.kind === "cash")).toMatchObject({ occupied: true, tone: "warning" });
    expect(seats.find((s) => s.kind === "tripwire")?.occupied).toBe(true);
    expect(seats.filter((s) => s.occupied)).toHaveLength(2);
  });

  it("prints the real count (named + not named) but draws at most five papers", () => {
    const s = councilSeats({ items: [item("review_due", { holdings: hold(3), more: 4 })] }).find((x) => x.kind === "review_due")!;
    expect(s.count).toBe(7);
    expect(s.papers).toBe(MAX_PAPERS);
    const one = councilSeats({ items: [item("review_due", { holdings: hold(1) })] }).find((x) => x.kind === "review_due")!;
    expect(one.count).toBe(1);
    expect(one.papers).toBe(1);
  });

  it("an item that names no holdings is occupied with one paper and no count", () => {
    const s = councilSeats({ items: [item("cash")] }).find((x) => x.kind === "cash")!;
    expect(s).toMatchObject({ occupied: true, count: null, papers: 1 });
  });

  it("places eight distinct seats inside the box", () => {
    const pos = seatPositions(8);
    expect(new Set(pos.map((p) => `${p.leftPct},${p.topPct}`)).size).toBe(8);
    for (const p of pos) {
      expect(p.leftPct).toBeGreaterThan(5);
      expect(p.leftPct).toBeLessThan(95);
      expect(p.topPct).toBeGreaterThan(5);
      expect(p.topPct).toBeLessThan(95);
    }
  });

  it("never uses reward or completion wording in seat labels", () => {
    const all = councilSeats({ items: COUNCIL_KINDS.map((k) => item(k, { holdings: hold(2) })) }).map(seatLabel).join(" ");
    expect(all).not.toMatch(/\b(buy|sell|trim|score|points?|streak|reward|complete|all clear|\d of 8)\b/i);
  });
});
