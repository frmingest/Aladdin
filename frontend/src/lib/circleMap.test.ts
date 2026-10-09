import { describe, expect, it } from "vitest";
import {
  bandForLevel,
  bandRadii,
  buildCircleMap,
  CIRCLE_MAP_CHROME,
  CIRCLE_MAP_CHROME_BUDGET,
  CIRCLE_R,
  CLEAR_WORD,
  collapsedText,
  DRAW_MAX_PX,
  DRAW_MIN_PX,
  FOG_FROM,
  FOG_MIN_OPACITY,
  FREE_WEDGE_DEG,
  hudFacts,
  INSIDE_CAPTION,
  LAYOUT_PX,
  MARKER_GAP_PX,
  markerLabel,
  markerSize,
  NAMED_MAX,
  NO_SECTOR_TITLE,
  NOT_JUDGED_TITLE,
  RING_LABEL,
  saveMark,
  sectorDomId,
  SEGMENT_WORD,
  slotAngle,
  circleView,
  type CircleMapModel,
} from "./circleMap";
import { countWords } from "./wordBudget";
import type { Competence, CompetenceLevel, CompetenceSector, CompetenceTower } from "./types";

const sec = (sector: string, level: CompetenceLevel | null, weight: string, held = 1): CompetenceSector => ({
  sector,
  level,
  note: null,
  marked_at: level ? "2026-10-01T10:00:00Z" : null,
  weight_pct: weight,
  holdings: Array.from({ length: held }, (_, i) => ({ holding_id: `${sector}${i}`, name: `${sector} co ${i}`, weight_pct: weight })),
});

const comp = (sectors: CompetenceSector[], towers: CompetenceTower[] = []): Competence => ({
  rules_version: "competence-v1",
  demo: false,
  levels: ["know", "partly", "outside"],
  sectors,
  towers,
  inside_weight_pct: "30.0",
  edge_weight_pct: "10.0",
  outside_weight_pct: "5.0",
  unmarked_weight_pct: "40.0",
  unclassified_weight_pct: "10.0",
  summary: "s",
  note_max_chars: 280,
});

const tower = (id: string, status: CompetenceTower["status"], sector: string | null = null): CompetenceTower => ({
  holding_id: id,
  name: `Name ${id}`,
  sector,
  weight_pct: "3.0",
  status,
});

const many = (n: number, level: CompetenceLevel | null, w = (i: number) => String(2 + (i % 7))) =>
  Array.from({ length: n }, (_, i) => sec(`Sector ${String(i).padStart(2, "0")}`, level, w(i)));

/** Every pair of drawn markers must keep its gap, whatever the width of the map (>= LAYOUT_PX). */
function expectNoOverlap(m: CircleMapModel, widthPx: number) {
  for (let i = 0; i < m.markers.length; i++) {
    for (let j = i + 1; j < m.markers.length; j++) {
      const a = m.markers[i];
      const b = m.markers[j];
      const d = Math.hypot(((a.dx - b.dx) / 100) * widthPx, ((a.dy - b.dy) / 100) * widthPx);
      expect(d, `${a.sector} vs ${b.sector} at ${widthPx}px`).toBeGreaterThanOrEqual(a.sizePx / 2 + b.sizePx / 2 + MARKER_GAP_PX - 1.5);
    }
  }
}

describe("bands and radii", () => {
  it("maps each level to its own band, and no mark to the fog", () => {
    expect(bandForLevel("know")).toBe("inside");
    expect(bandForLevel("partly")).toBe("edge");
    expect(bandForLevel("outside")).toBe("outside");
    expect(bandForLevel(null)).toBe("fog");
  });

  it("keeps each band apart at every marker size: inside < line < outside < fog start < fog < rim", () => {
    const R = LAYOUT_PX / 2;
    for (let d = DRAW_MIN_PX; d <= DRAW_MAX_PX; d++) {
      const m = d / 2;
      for (const r of bandRadii("inside", d)) expect(r + m).toBeLessThan(CIRCLE_R * R);
      expect(bandRadii("edge", d)).toEqual([CIRCLE_R * R]);
      for (const r of bandRadii("outside", d)) {
        expect(r - m).toBeGreaterThan(CIRCLE_R * R);
        expect(r + m).toBeLessThan(FOG_FROM * R);
      }
      for (const r of bandRadii("fog", d)) {
        expect(r - m).toBeGreaterThan(FOG_FROM * R);
        expect(r + m).toBeLessThan(R);
      }
    }
  });

  it("puts a partly-known sector exactly on the circle line", () => {
    const m = buildCircleMap(comp([sec("Energy", "partly", "10")])).markers[0];
    expect(m.band).toBe("edge");
    expect(m.radius).toBeCloseTo(CIRCLE_R, 2);
  });

  it("an outside marker never reaches the fog and a fog marker never leaves the rim, in a full layout", () => {
    const R = LAYOUT_PX / 2;
    const levels: (CompetenceLevel | null)[] = ["outside", null];
    for (const lv of levels) {
      for (const mk of buildCircleMap(comp(many(10, lv, (i) => String(1 + i * 3)))).markers) {
        const edge = Math.hypot(mk.dx, mk.dy) * (LAYOUT_PX / 100);
        if (lv === "outside") expect(edge + mk.sizePx / 2).toBeLessThan(FOG_FROM * R);
        else expect(edge + mk.sizePx / 2).toBeLessThan(R);
      }
    }
  });
});

describe("no two markers overlap", () => {
  const cases: [string, Competence][] = [
    ["12 know", comp(many(12, "know"))],
    ["12 partly", comp(many(12, "partly"))],
    ["12 outside", comp(many(12, "outside"))],
    ["12 unmarked", comp(many(12, null))],
    ["15 mixed", comp(many(15, "know").map((s, i) => ({ ...s, level: (["know", "partly", "outside", null] as const)[i % 4] })))],
    ["24 all unmarked", comp(many(24, null))],
    ["30 heavy know", comp(many(30, "know", () => "30"))],
    ["with holdings that have no sector", comp(many(12, null), [tower("1", "unclassified"), tower("2", "unclassified")])],
  ];
  for (const [name, c] of cases) {
    it(`${name}: at the phone width, a tablet and a wide map`, () => {
      const m = buildCircleMap(c);
      for (const w of [LAYOUT_PX, 350, 560]) expectNoOverlap(m, w);
    });
  }

  it("sends what does not fit to the tag, and counts every level and weight in it", () => {
    const m = buildCircleMap(comp(many(14, "partly")));
    expect(m.markers.length + (m.collapsed?.count ?? 0)).toBe(14);
    expect(m.collapsed).not.toBeNull();
    expect(m.collapsed!.levels).toEqual([{ band: "edge", count: m.collapsed!.count, weightPct: expect.any(Number) }]);
    expect(m.rows).toHaveLength(14);
  });

  it("does not hide outside or unmarked sectors behind known ones: they are placed first", () => {
    const sectors = [...many(10, "know", () => "9"), ...Array.from({ length: 4 }, (_, i) => sec(`Zed ${i}`, i % 2 ? "outside" : null, "1"))];
    const m = buildCircleMap(comp(sectors));
    for (const z of m.markers.filter((x) => x.sector.startsWith("Zed"))) expect(["outside", "fog"]).toContain(z.band);
    expect(m.markers.filter((x) => x.sector.startsWith("Zed"))).toHaveLength(4);
  });
});

describe("tag text", () => {
  it("uses singular and plural correctly and gives a count and weight per level", () => {
    const one = collapsedText({ count: 1, levels: [{ band: "fog", count: 1, weightPct: 2 }], sectors: ["A"] });
    expect(one.title).toBe("1 smaller sector");
    expect(one.detail).toBe("1 unmarked (2.0%)");
    const two = collapsedText({ count: 3, levels: [{ band: "outside", count: 2, weightPct: 4.5 }, { band: "inside", count: 1, weightPct: 1 }], sectors: [] });
    expect(two.title).toBe("3 smaller sectors");
    expect(two.detail).toBe("2 outside (4.5%), 1 inside (1.0%)");
  });
});

describe("fixed angles", () => {
  const names = ["Utilities", "Energy", "Materials", "Banks", "Health", "Telecom"];
  const build = (levels: (CompetenceLevel | null)[]) => buildCircleMap(comp(names.map((n, i) => sec(n, levels[i % levels.length], String(5 + i)))));

  it("fixes the angle by the sector's place in the full name-sorted list, whatever the marks", () => {
    const a = build(["know", "outside"]).markers;
    const b = build([null, "partly", "outside"]).markers;
    const common = a.filter((x) => b.some((y) => y.sector === x.sector));
    expect(common.length).toBeGreaterThanOrEqual(4);
    for (const x of common) expect(b.find((y) => y.sector === x.sector)!.angleDeg).toBe(x.angleDeg);
  });

  it("marking a sector, or a quiet sector becoming active, never moves another marker's angle", () => {
    const base = [sec("A", "know", "10"), sec("B", null, "10"), sec("C", null, "0", 0), sec("D", "outside", "10")];
    const before = buildCircleMap(comp(base)).markers;
    const marked = buildCircleMap(comp(base.map((s) => (s.sector === "C" ? { ...s, level: "know" as const } : s)))).markers;
    for (const m of before) expect(marked.find((x) => x.sector === m.sector)!.angleDeg).toBe(m.angleDeg);
    expect(marked.some((x) => x.sector === "C")).toBe(true);
  });

  it("goes round in name order and leaves the free wedge at the bottom empty", () => {
    const m = buildCircleMap(comp(many(12, "know", () => "3"))).markers;
    for (const x of m) expect(Math.abs(x.angleDeg - 180)).toBeGreaterThanOrEqual(FREE_WEDGE_DEG / 2 - 0.5);
    expect(slotAngle(0, 1)).toBeCloseTo(0, 5);
    const spread = buildCircleMap(comp(names.map((n, i) => sec(n, (["know", "partly", "outside", null] as const)[i % 4], "5")))).markers.filter((x) => x.kind === "sector");
    expect(spread.map((x) => x.sector)).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("changing a mark changes the band, not the angle", () => {
    const before = buildCircleMap(comp([sec("A", null, "10"), sec("B", "know", "10")])).markers;
    const after = buildCircleMap(comp([sec("A", "know", "10"), sec("B", "know", "10")])).markers;
    expect(after[0].angleDeg).toBe(before[0].angleDeg);
    expect(after[0].band).toBe("inside");
    expect(before[0].band).toBe("fog");
    expect(after[0].radius).toBeLessThan(before[0].radius);
  });

  it("draws nothing for an empty circle", () => {
    const m = buildCircleMap(comp([]));
    expect(m.markers).toEqual([]);
    expect(m.collapsed).toBeNull();
  });
});

describe("marker size comes from weight only", () => {
  it("is bounded, grows with the real weight, and 35% is visibly bigger than 5%", () => {
    expect(markerSize(0)).toBe(DRAW_MIN_PX);
    expect(markerSize(1000)).toBe(DRAW_MAX_PX);
    expect(markerSize(-3)).toBe(DRAW_MIN_PX);
    expect(markerSize(5)).toBeLessThan(markerSize(15));
    expect(markerSize(35) - markerSize(5)).toBeGreaterThanOrEqual(8);
  });

  it("an unmarked sector is exactly as big as a known one of the same share, and a 0% one is not bigger than a 2% one", () => {
    const m = buildCircleMap(comp([sec("A", null, "12"), sec("B", "know", "12"), sec("C", null, "0", 1), sec("D", "know", "2")])).markers;
    const get = (n: string) => m.find((x) => x.sector === n)!;
    expect(get("A").sizePx).toBe(get("B").sizePx);
    expect(get("C").sizePx).toBeLessThanOrEqual(get("D").sizePx);
    for (const x of m) expect(x.opacity).toBeGreaterThanOrEqual(FOG_MIN_OPACITY);
  });
});

describe("what is on the ring and what is not", () => {
  it("names only the heaviest markers", () => {
    const m = buildCircleMap(comp(many(8, "know", (i) => String(i + 1))));
    expect(m.markers.filter((x) => x.showName)).toHaveLength(NAMED_MAX);
  });

  it("sectors with nothing held and no mark are only rows behind a disclosure; a mark keeps a sector on the ring", () => {
    const m = buildCircleMap(comp([sec("Held", null, "5"), sec("Quiet", null, "0", 0), sec("MarkedEmpty", "know", "0", 0)]));
    expect(m.markers.map((x) => x.sector)).toEqual(["Held", "MarkedEmpty"]);
    expect(m.quiet.map((x) => x.sector)).toEqual(["Quiet"]);
    expect(m.rows.map((x) => x.sector)).toEqual(["Held", "MarkedEmpty"]);
  });

  it("draws holdings with no sector as one dashed marker at the rim sized by their weight, and keeps funds unplaced", () => {
    const m = buildCircleMap(
      comp([sec("A", "know", "5")], [tower("1", "inside", "A"), tower("2", "unclassified"), tower("3", "unclassified"), tower("4", "not_applicable"), tower("5", "not_applicable"), tower("6", "not_applicable")]),
    );
    const ns = m.markers.find((x) => x.kind === "nosector")!;
    expect(ns.band).toBe("fog");
    expect(ns.level).toBeNull();
    expect(ns.sizePx).toBe(markerSize(10));
    expect(ns.heldCount).toBe(2);
    expect(ns.label).toContain("2 holdings");
    expect(m.markers.filter((x) => x.kind === "sector")).toHaveLength(1);
    expect(m.noSector.names).toEqual(["Name 2", "Name 3"]);
    expect(m.notJudged.count).toBe(3);
    expect(buildCircleMap(comp([sec("A", "know", "5")], [tower("4", "not_applicable")])).markers.some((x) => x.kind === "nosector")).toBe(false);
  });

  it("a big no-sector share is drawn as big as a known sector of the same share", () => {
    const c = comp([sec("A", "know", "40")], [tower("2", "unclassified")]);
    c.unclassified_weight_pct = "40.0";
    const m = buildCircleMap(c).markers;
    expect(m.find((x) => x.kind === "nosector")!.sizePx).toBe(m.find((x) => x.sector === "A")!.sizePx);
  });

  it("an empty inside is nothing: no know sector, no inside marker", () => {
    expect(buildCircleMap(comp([sec("A", null, "5"), sec("B", "outside", "5")])).markers.some((x) => x.band === "inside")).toBe(false);
  });
});

describe("page logic", () => {
  it("shows the ring map only in game mode and not in Plain view", () => {
    expect(circleView(true, false)).toBe("ring");
    expect(circleView(true, true)).toBe("plain");
    expect(circleView(false, false)).toBe("plain");
    expect(circleView(false, true)).toBe("plain");
  });

  it("saves with PUT (trimmed note, null when empty) and clears with DELETE, nothing else", async () => {
    const calls: unknown[][] = [];
    const client = {
      putCompetence: async (...a: unknown[]) => (calls.push(["PUT", ...a]), "put"),
      deleteCompetence: async (...a: unknown[]) => (calls.push(["DELETE", ...a]), "del"),
    };
    expect(await saveMark(client as never, "Energy", "know", "  why  ")).toBe("put");
    expect(await saveMark(client as never, "Energy", "partly", "   ")).toBe("put");
    expect(await saveMark(client as never, "Energy", "", "ignored")).toBe("del");
    expect(calls).toEqual([
      ["PUT", "Energy", "know", "why"],
      ["PUT", "Energy", "partly", null],
      ["DELETE", "Energy"],
    ]);
  });
});

describe("the strip of four facts", () => {
  it("shows the four backend figures separately, in order, and no sum", () => {
    const f = hudFacts(comp([]));
    expect(f.map((x) => [x.label, x.value])).toEqual([
      ["Inside", "30.0%"],
      ["On the edge", "10.0%"],
      ["Outside", "5.0%"],
      ["Unmarked", "40.0%"],
    ]);
  });

  it("a missing figure is unknown, never zero", () => {
    expect(hudFacts({ ...comp([]), unmarked_weight_pct: "x" })[3].value).toBe("unknown");
  });
});

describe("labels and wording", () => {
  it("names the sector, the level in words and the share, with one name per state", () => {
    expect(markerLabel(sec("Energy", "partly", "12.34", 2))).toBe("Energy: On the edge, 12.3% of the portfolio");
    expect(markerLabel(sec("Energy", null, "0", 0))).toBe("Energy: Unmarked, nothing held");
    expect(SEGMENT_WORD).toEqual({ know: "Inside", partly: "On the edge", outside: "Outside" });
    expect(RING_LABEL.edge).toBe("On the edge");
  });

  it("makes stable DOM ids", () => {
    expect(sectorDomId("Health Care")).toBe("circle-sector-health-care");
    expect(sectorDomId("***")).toBe("circle-sector-x");
  });

  it("prints no buy, sell, score, streak, reward or verdict wording", () => {
    const words = [...CIRCLE_MAP_CHROME, ...Object.values(SEGMENT_WORD), CLEAR_WORD, NO_SECTOR_TITLE, NOT_JUDGED_TITLE, INSIDE_CAPTION, markerLabel(sec("Energy", "know", "5"))].join(" ");
    expect(words).not.toMatch(/\b(buy|sell|add|trim|invest|purchase|good|bad|win|wins|score|scores|streak|reward|points?|complete|completion|safe|strong|weak|green|red|amber)\b/i);
    expect(INSIDE_CAPTION).toBe("Inside means you know the sector, not that the holding is sound.");
  });

  it("keeps the fixed chrome inside its own word budget", () => {
    expect(CIRCLE_MAP_CHROME.reduce((n, s) => n + countWords(s), 0)).toBeLessThanOrEqual(CIRCLE_MAP_CHROME_BUDGET);
  });
});
