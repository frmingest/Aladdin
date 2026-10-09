import { describe, expect, it } from "vitest";
import {
  BAND_RADII,
  bandForLevel,
  buildCircleMap,
  CIRCLE_MAP_CHROME,
  CIRCLE_MAP_CHROME_BUDGET,
  CIRCLE_R,
  CLEAR_WORD,
  FOG_FROM,
  FOG_MIN_OPACITY,
  FOG_MIN_PX,
  FREE_WEDGE_DEG,
  hudFacts,
  INSIDE_CAPTION,
  markerLabel,
  markerSize,
  MARKER_MAX_PX,
  MARKER_MIN_PX,
  MAX_MARKERS,
  NAMED_MAX,
  NO_SECTOR_TITLE,
  NOT_JUDGED_TITLE,
  RING_LABEL,
  sectorDomId,
  SEGMENT_WORD,
  slotAngle,
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

describe("bands and radii", () => {
  it("maps each level to its own band, and no mark to the fog", () => {
    expect(bandForLevel("know")).toBe("inside");
    expect(bandForLevel("partly")).toBe("edge");
    expect(bandForLevel("outside")).toBe("outside");
    expect(bandForLevel(null)).toBe("fog");
  });

  it("orders the bands radially: inside < the line < outside < fog, with the fog band beyond the open ground", () => {
    expect(Math.max(...BAND_RADII.inside)).toBeLessThan(CIRCLE_R);
    expect(BAND_RADII.edge).toEqual([CIRCLE_R, CIRCLE_R, CIRCLE_R]);
    expect(Math.min(...BAND_RADII.outside)).toBeGreaterThan(CIRCLE_R);
    expect(Math.max(...BAND_RADII.outside)).toBeLessThanOrEqual(FOG_FROM);
    expect(Math.min(...BAND_RADII.fog)).toBeGreaterThan(FOG_FROM);
    expect(Math.max(...BAND_RADII.fog)).toBeLessThan(1);
  });

  it("puts a partly-known sector exactly on the circle line", () => {
    const m = buildCircleMap(comp([sec("Energy", "partly", "10")])).markers[0];
    expect(m.band).toBe("edge");
    expect(m.radius).toBe(CIRCLE_R);
    expect(Math.hypot(m.dx, m.dy)).toBeCloseTo(CIRCLE_R * 50, 0);
  });
});

describe("layout", () => {
  const names = ["Utilities", "Energy", "Materials", "Banks", "Health", "Telecom"];
  const build = (levels: (CompetenceLevel | null)[]) => buildCircleMap(comp(names.map((n, i) => sec(n, levels[i % levels.length], String(5 + i)))));

  it("fixes the angle by sector name: alphabetical slots, the same whatever the marks are", () => {
    const a = build(["know"]);
    const b = build([null, "outside", "partly"]);
    const angles = (m: ReturnType<typeof build>) => Object.fromEntries(m.markers.map((x) => [x.sector, x.angleDeg]));
    expect(angles(a)).toEqual(angles(b));
    const ordered = [...a.markers].sort((x, y) => x.angleDeg - y.angleDeg);
    // the markers go round in name order (starting at the lower left, clockwise through the top)
    const byName = [...names].sort((x, y) => x.localeCompare(y));
    expect(a.markers.map((m) => m.sector)).toEqual(byName);
    expect(a.markers.map((m) => m.pin)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(ordered.length).toBe(6);
  });

  it("leaves the free wedge at the bottom empty for the zone names", () => {
    const m = buildCircleMap(comp(Array.from({ length: 12 }, (_, i) => sec(`S${String(i).padStart(2, "0")}`, "know", "3")))).markers;
    for (const x of m) expect(Math.abs(x.angleDeg - 180)).toBeGreaterThanOrEqual(FREE_WEDGE_DEG / 2 - 0.5);
    expect(slotAngle(0, 1)).toBeCloseTo(0, 5);
  });

  it("changing a mark only changes the spoke length, never the angle", () => {
    const before = buildCircleMap(comp([sec("A", null, "10"), sec("B", "know", "10")])).markers;
    const after = buildCircleMap(comp([sec("A", "know", "10"), sec("B", "know", "10")])).markers;
    expect(after[0].angleDeg).toBe(before[0].angleDeg);
    expect(after[0].band).toBe("inside");
    expect(before[0].band).toBe("fog");
    expect(after[0].radius).toBeLessThan(before[0].radius);
  });

  it("keeps every marker on the page: dx and dy stay inside the half-width", () => {
    for (const m of build(["know", "partly", "outside", null]).markers) {
      expect(Math.hypot(m.dx, m.dy)).toBeLessThan(50);
    }
  });

  it("draws nothing for an empty circle: no markers, no collapse", () => {
    const m = buildCircleMap(comp([]));
    expect(m.markers).toEqual([]);
    expect(m.collapsed).toBeNull();
  });
});

describe("marker size", () => {
  it("is bounded and grows with the real weight", () => {
    expect(markerSize(0, "inside")).toBe(MARKER_MIN_PX);
    expect(markerSize(1000, "inside")).toBe(MARKER_MAX_PX);
    expect(markerSize(5, "inside")).toBeLessThan(markerSize(15, "inside"));
    expect(markerSize(-3, "inside")).toBe(MARKER_MIN_PX);
    expect(MARKER_MIN_PX).toBeGreaterThanOrEqual(44);
  });

  it("is proportional in area: four times the weight is about twice the added diameter", () => {
    const d = (w: number) => markerSize(w, "inside") - MARKER_MIN_PX;
    expect(d(20) / d(5)).toBeCloseTo(2, 0);
  });

  it("never draws unknown smaller than known, at any weight", () => {
    for (let w = 0; w <= 40; w += 0.5) {
      expect(markerSize(w, "fog")).toBeGreaterThanOrEqual(markerSize(w, "inside"));
      expect(markerSize(w, "fog")).toBeGreaterThanOrEqual(markerSize(w, "edge"));
      expect(markerSize(w, "fog")).toBeGreaterThanOrEqual(markerSize(w, "outside"));
    }
    expect(markerSize(0, "fog")).toBeGreaterThanOrEqual(FOG_MIN_PX);
  });

  it("an unmarked marker is full size and at least 0.85 opaque, like every other marker", () => {
    const { markers } = buildCircleMap(comp([sec("A", null, "12"), sec("B", "know", "12"), sec("C", null, "0.4")]));
    for (const m of markers) expect(m.opacity).toBeGreaterThanOrEqual(FOG_MIN_OPACITY);
    const a = markers.find((m) => m.sector === "A")!;
    const b = markers.find((m) => m.sector === "B")!;
    expect(a.sizePx).toBeGreaterThanOrEqual(b.sizePx);
  });
});

describe("what is on the ring and what is not", () => {
  it("collapses beyond twelve markers into one count, keeping the heaviest and losing no fact", () => {
    const sectors = Array.from({ length: 15 }, (_, i) => sec(`Sector ${String(i).padStart(2, "0")}`, i % 3 === 0 ? null : "know", String(30 - i)));
    const m = buildCircleMap(comp(sectors));
    expect(m.markers).toHaveLength(MAX_MARKERS);
    expect(m.collapsed?.count).toBe(3);
    expect(m.collapsed?.sectors).toEqual(["Sector 12", "Sector 13", "Sector 14"]);
    expect(m.collapsed?.unmarked).toBe(1);
    // the rows still list all fifteen
    expect(m.rows).toHaveLength(15);
    expect(m.markers.some((x) => x.sector === "Sector 14")).toBe(false);
  });

  it("does not collapse at exactly twelve", () => {
    const m = buildCircleMap(comp(Array.from({ length: 12 }, (_, i) => sec(`S${i}`, "know", "2"))));
    expect(m.markers).toHaveLength(12);
    expect(m.collapsed).toBeNull();
  });

  it("names only the largest markers; the others carry a number", () => {
    const m = buildCircleMap(comp(Array.from({ length: 10 }, (_, i) => sec(`S${i}`, "know", String(i + 1)))));
    expect(m.markers.filter((x) => x.showName)).toHaveLength(NAMED_MAX);
    expect(m.markers.filter((x) => x.showName).every((x) => x.weightPct >= 5)).toBe(true);
  });

  it("sectors with nothing held and no mark are only rows behind a disclosure; a mark keeps a sector on the ring", () => {
    const m = buildCircleMap(comp([sec("Held", null, "5"), sec("Quiet", null, "0", 0), sec("MarkedEmpty", "know", "0", 0)]));
    expect(m.markers.map((x) => x.sector)).toEqual(["Held", "MarkedEmpty"]);
    expect(m.quiet.map((x) => x.sector)).toEqual(["Quiet"]);
    expect(m.rows.map((x) => x.sector)).toEqual(["Held", "MarkedEmpty"]);
  });

  it("keeps holdings with no sector in the fog tag and funds and gold unplaced as not judged", () => {
    const m = buildCircleMap(
      comp(
        [sec("A", "know", "5")],
        [tower("1", "inside", "A"), tower("2", "unclassified"), tower("3", "unclassified"), tower("4", "not_applicable"), tower("5", "not_applicable"), tower("6", "not_applicable")],
      ),
    );
    expect(m.markers).toHaveLength(1);
    expect(m.noSector.count).toBe(2);
    expect(m.noSector.names).toEqual(["Name 2", "Name 3"]);
    expect(m.noSector.weightText).toBe("10.0%");
    expect(m.notJudged.count).toBe(3);
  });

  it("an empty inside is nothing: no know sector, no inside marker", () => {
    const m = buildCircleMap(comp([sec("A", null, "5"), sec("B", "outside", "5")]));
    expect(m.markers.some((x) => x.band === "inside")).toBe(false);
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
    expect(f.some((x) => /total|coverage|sum/i.test(x.label))).toBe(false);
  });

  it("a missing figure is unknown, never zero", () => {
    expect(hudFacts({ ...comp([]), unmarked_weight_pct: "x" })[3].value).toBe("unknown");
  });
});

describe("labels and wording", () => {
  it("names the sector, the level in words and the share", () => {
    expect(markerLabel(sec("Energy", "partly", "12.34", 2))).toBe("Energy: On the edge, 12.3% of the portfolio");
    expect(markerLabel(sec("Energy", null, "0", 0))).toBe("Energy: Unmarked, nothing held");
  });

  it("makes stable DOM ids", () => {
    expect(sectorDomId("Health Care")).toBe("circle-sector-health-care");
    expect(sectorDomId("Consumer (Staples)")).toBe("circle-sector-consumer-staples");
    expect(sectorDomId("***")).toBe("circle-sector-x");
  });

  it("prints no buy, sell, score, streak, reward or verdict wording, and the caption says inside is not a verdict", () => {
    const words = [
      ...CIRCLE_MAP_CHROME,
      ...Object.values(RING_LABEL),
      ...Object.values(SEGMENT_WORD),
      CLEAR_WORD,
      NO_SECTOR_TITLE,
      NOT_JUDGED_TITLE,
      INSIDE_CAPTION,
      markerLabel(sec("Energy", "know", "5")),
      markerLabel(sec("Energy", null, "5")),
    ].join(" ");
    expect(words).not.toMatch(/\b(buy|sell|add|trim|invest|purchase|good|bad|win|wins|score|scores|streak|reward|points?|complete|completion|safe|strong|weak)\b/i);
    expect(INSIDE_CAPTION).toBe("Inside means you know the sector, not that the holding is sound.");
  });

  it("uses the colour words nowhere in the labels (status is position, pattern and words)", () => {
    expect([...Object.values(RING_LABEL), ...Object.values(SEGMENT_WORD)].join(" ")).not.toMatch(/green|red|amber|yellow/i);
  });

  it("keeps the fixed chrome inside its own word budget", () => {
    expect(CIRCLE_MAP_CHROME.reduce((n, s) => n + countWords(s), 0)).toBeLessThanOrEqual(CIRCLE_MAP_CHROME_BUDGET);
  });
});
