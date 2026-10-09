import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { GameModeProvider } from "../lib/gameMode";
import type { Competence, CompetenceSector } from "../lib/types";
import { focusSectorControl } from "../lib/circleMap";
import { CompetenceView } from "./CompetencePage";

const sec = (sector: string, level: CompetenceSector["level"], w: string): CompetenceSector => ({
  sector, level, note: null, marked_at: level ? "2026-10-01T10:00:00Z" : null, weight_pct: w,
  holdings: [{ holding_id: sector, name: `${sector} Co`, weight_pct: w }],
});
const data = (demo = false): Competence => ({
  rules_version: "competence-v1", demo, levels: ["know", "partly", "outside"],
  sectors: [sec("Energy", "know", "20"), sec("Tech", null, "10")],
  towers: [{ holding_id: "Energy", name: "Energy Co", sector: "Energy", weight_pct: "20", status: "inside" }],
  inside_weight_pct: "20.0", edge_weight_pct: "0.0", outside_weight_pct: "0.0", unmarked_weight_pct: "10.0", unclassified_weight_pct: "0.0",
  summary: "s", note_max_chars: 280,
});

function stub(game: boolean, plain: boolean) {
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (k === "aladdin-game-mode" ? (game ? "on" : "off") : k === "aladdin-plain-view" ? (plain ? "on" : "off") : null),
    setItem: () => {}, removeItem: () => {}, clear: () => {}, key: () => null, length: 0,
  };
}
afterEach(() => {
  delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
});
const render = (game: boolean, plain: boolean, demo = false) => {
  stub(game, plain);
  return renderToStaticMarkup(
    <GameModeProvider>
      <MemoryRouter>
        <CompetenceView data={data(demo)} onSaved={() => {}} />
      </MemoryRouter>
    </GameModeProvider>,
  );
};

describe("Circle page views", () => {
  it("game mode shows the ring map with the three-state control and no select", () => {
    const html = render(true, false);
    expect(html).toContain("circle-marker");
    expect(html).toContain('type="radio"');
    expect(html).not.toContain("<select");
  });

  it("Plain view and normal mode show the old content: bar legend, selects, holdings list, no map", () => {
    for (const html of [render(true, true), render(false, false)]) {
      expect(html).toContain("<select");
      expect(html).toContain("Your stock holdings against your marks");
      expect(html).toContain("Energy Co");
      expect(html).not.toContain("circle-marker");
      expect(html).not.toContain('type="radio"');
    }
  });

  it("demo data is read-only in the ring view: radios and Save disabled, no Clear", () => {
    const html = render(true, false, true);
    expect(html).toContain("Demo data");
    expect(html).not.toMatch(/<input type="radio"(?![^>]*disabled)/);
    expect(html).not.toContain("Clear mark");
    expect(html).toMatch(/class="mark-save" disabled/);
  });
});

describe("press a marker", () => {
  function fakeDoc(hasRadio: boolean) {
    const log: string[] = [];
    const radio = { focus: () => log.push("radio") } as unknown as HTMLElement;
    const row = {
      scrollIntoView: () => log.push("scroll"),
      focus: () => log.push("row"),
      querySelector: (q: string) => (hasRadio && q.includes(":checked") ? radio : hasRadio ? radio : null),
    };
    return { log, radio, row, doc: { getElementById: (id: string) => (id === "circle-sector-energy" || id === "circle-marks" ? row : null) } as Pick<Document, "getElementById"> };
  }
  it("scrolls to the sector's row and focuses its radio", () => {
    const f = fakeDoc(true);
    expect(focusSectorControl(f.doc, "Energy", true)).toBe(f.radio);
    expect(f.log).toEqual(["scroll", "radio"]);
  });
  it("focuses the row itself when the control is read-only (demo), and the list for the tag", () => {
    const f = fakeDoc(false);
    expect(focusSectorControl(f.doc, "Energy", true)).toBe(f.row);
    expect(focusSectorControl(f.doc, null, true)).toBe(f.row);
    expect(focusSectorControl(f.doc, "Nope", true)).toBeNull();
  });
});
