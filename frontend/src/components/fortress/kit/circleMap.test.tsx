import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CIRCLE_MAP_WORD_BUDGET, INSIDE_CAPTION, MARKER_MIN_PX } from "../../../lib/circleMap";
import { countWords } from "../../../lib/wordBudget";
import type { Competence, CompetenceLevel, CompetenceSector } from "../../../lib/types";
import CircleGlyph from "./CircleGlyph";
import CircleMap from "./CircleMap";
import MarkControl, { BoundaryStone } from "./MarkControl";

const sec = (sector: string, level: CompetenceLevel | null, weight: string, held = 1): CompetenceSector => ({
  sector,
  level,
  note: null,
  marked_at: level ? "2026-10-01T10:00:00Z" : null,
  weight_pct: weight,
  holdings: Array.from({ length: held }, (_, i) => ({ holding_id: `${sector}${i}`, name: `${sector} co`, weight_pct: weight })),
});

const data = (sectors: CompetenceSector[], over: Partial<Competence> = {}): Competence => ({
  rules_version: "competence-v1",
  demo: false,
  levels: ["know", "partly", "outside"],
  sectors,
  towers: [
    { holding_id: "u", name: "Loose Co", sector: null, weight_pct: "4.0", status: "unclassified" },
    { holding_id: "f", name: "A fund", sector: null, weight_pct: "6.0", status: "not_applicable" },
  ],
  inside_weight_pct: "25.0",
  edge_weight_pct: "10.0",
  outside_weight_pct: "5.0",
  unmarked_weight_pct: "50.0",
  unclassified_weight_pct: "4.0",
  summary: "s",
  note_max_chars: 280,
  ...over,
});

const render = (c: Competence) =>
  renderToStaticMarkup(<CircleMap data={c} onPress={() => {}} />);

const mixed = data([
  sec("Energy", "know", "20"),
  sec("Banks", "partly", "10"),
  sec("Telecom", "outside", "5"),
  sec("Software", null, "15"),
  sec("Mining", null, "0", 0),
]);

describe("Circle ring map", () => {
  it("draws one button per sector on the ring, each at least 44 px, with level and share in its name", () => {
    const html = render(mixed);
    const buttons = html.match(/<button[^>]*class="circle-marker"[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(4);
    for (const b of buttons) {
      const w = Number(/--px:(\d+)px/.exec(b)![1]);
      expect(w).toBeGreaterThanOrEqual(MARKER_MIN_PX);
    }
    expect(html).toContain("Energy: I know this, 20.0% of the portfolio");
    expect(html).toContain("Software: Unmarked, 15.0% of the portfolio");
  });

  it("shows the unmarked sector as a dashed outline with a real ? and never fainter than the others", () => {
    const html = render(mixed);
    expect(html).toContain("stroke-dasharray");
    expect(html).toContain(">?<");
    const opacities = [...html.matchAll(/class="circle-marker"[^>]*opacity:([0-9.]+)/g)].map((m) => Number(m[1]));
    expect(opacities.length).toBe(4);
    expect(Math.min(...opacities)).toBeGreaterThanOrEqual(0.85);
  });

  it("draws the circle as an outline only, and the inside stays empty when nothing is known", () => {
    const html = render(data([sec("Software", null, "15"), sec("Telecom", "outside", "5")]));
    const circleLine = /<path d="M25 50[^"]*"[^>]*>/.exec(html)![0];
    expect(circleLine).toContain('fill="none"');
    expect(html).not.toMatch(/filter|glow|drop-shadow|feTurbulence/i);
  });

  it("states that inside is not a verdict, once", () => {
    const html = render(mixed);
    expect(html.split(INSIDE_CAPTION)).toHaveLength(2);
  });

  it("keeps funds and gold unplaced and holdings with no sector in the fog tag", () => {
    const html = render(mixed);
    expect(html).toContain("Not judged");
    expect(html).toContain("1 funds or gold");
    expect(html).toContain("No sector set, 4.0%");
    expect(html).toContain("Loose Co");
    expect((html.match(/class="circle-marker"/g) ?? []).length).toBe(4);
  });

  it("prints the four facts separately, each with its own shape", () => {
    const html = render(mixed);
    for (const x of ["25.0%", "10.0%", "5.0%", "50.0%"]) expect(html).toContain(x);
    expect(html).toContain('aria-label="Your holdings against your marks"');
  });

  it("uses no green anywhere and no colour-only status", () => {
    const html = render(mixed);
    expect(html).not.toMatch(/text-positive|bg-positive|#2e7d32|#3a8f4b|#4ade6a|text-negative|bg-negative|bg-caution/);
  });

  it("collapses a crowded ring into a count that keeps the unmarked ones visible", () => {
    const many = data(Array.from({ length: 15 }, (_, i) => sec(`Sector ${String(i).padStart(2, "0")}`, i === 14 ? null : "know", String(30 - i))));
    const html = render(many);
    expect(html).toContain("3 smaller sectors");
    expect(html).toContain("1 unmarked");
    expect((html.match(/class="circle-marker"/g) ?? []).length).toBe(12);
  });

  it("stays within its own word budget for a typical portfolio", () => {
    expect(countWords(render(mixed))).toBeLessThanOrEqual(CIRCLE_MAP_WORD_BUDGET);
  });

  it("prints no buy, sell, score, streak or reward wording", () => {
    expect(render(mixed)).not.toMatch(/\b(buy|sell|score|streak|reward|points|well done|complete)\b/i);
  });

  it("the ground and the glyphs are decorative", () => {
    expect(render(mixed)).toContain("aria-hidden");
    expect(renderToStaticMarkup(<CircleGlyph level="know" />)).toContain('aria-hidden="true"');
  });
});

describe("three-state control and stones", () => {
  it("is three real radios with a shape and a word each, and none checked while unmarked", () => {
    const html = renderToStaticMarkup(<MarkControl sector="Energy" groupId="g" value="" disabled={false} onChange={() => {}} />);
    expect((html.match(/type="radio"/g) ?? []).length).toBe(3);
    expect(html).not.toContain("checked");
    for (const w of ["Know", "Edge", "Outside"]) expect(html).toContain(w);
    expect(html).toContain("<svg");
    expect(html).not.toContain("Clear mark");
  });

  it("checks the saved level and offers to clear it; read-only in demo", () => {
    const on = renderToStaticMarkup(<MarkControl sector="Energy" groupId="g" value="partly" disabled={false} onChange={() => {}} />);
    expect(on).toContain("checked");
    expect(on).toContain("Clear mark");
    const demo = renderToStaticMarkup(<MarkControl sector="Energy" groupId="g" value="partly" disabled onChange={() => {}} />);
    expect(demo).toContain("disabled");
    expect(demo).not.toContain("Clear mark");
  });

  it("a stone shows the level, the date and a note glyph; unmarked is a dashed ? stone", () => {
    const known = renderToStaticMarkup(<BoundaryStone level="know" markedAt="2026-10-01T10:00:00Z" hasNote />);
    expect(known).toContain("Know");
    expect(known).toContain('aria-label="has a note"');
    const none = renderToStaticMarkup(<BoundaryStone level={null} markedAt={null} hasNote={false} />);
    expect(none).toContain("Unmarked");
    expect(none).toContain('data-unmarked="true"');
    expect(none).toContain(">?<");
  });
});
