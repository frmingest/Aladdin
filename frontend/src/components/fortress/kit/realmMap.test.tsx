import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { CARTOGRAPHER_BODY_BUDGET, CARTOGRAPHER_CHROME_BUDGET, MAP_COPY, PATCH_LOOK, fogSlots } from "../../../lib/realmMap";
import { commissionsFor, surveyTower } from "../../../lib/survey";
import type { SurveyInputs, TowerFog } from "../../../lib/survey";
import type { Competence, DecisionRecord, GameState, GameTower } from "../../../lib/types";
import { countWords } from "../../../lib/wordBudget";
import page from "../../../pages/CartographerPage.tsx?raw";
import bodySource from "./RealmMapBody.tsx?raw";
import mapSource from "./WorldMap.tsx?raw";
import realmMapCss from "./realmMap.css?raw";
import CommissionSeal, { FlagMark } from "./CommissionSeal";
import { FogDefs, PatchMark, TowerPicture } from "./FogPatch";
import RealmMapBody from "./RealmMapBody";
import TowerSlate from "./TowerSlate";

const kitSources = import.meta.glob("./*.tsx", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

function tower(over: Partial<GameTower>): GameTower {
  return {
    holding_id: "h1", ticker: "AAA", name: "Alpha", instrument_type: "equity", sector: "Energy",
    structure: "tower", value_nok: "1000", weight_pct: "40", size_class: "large", moat: "wide", wall: "basalt",
    wall_reason: "", wall_inputs: {}, freshness: "fresh", analysis_age_days: 10, verdict_rating: "hold",
    land: "full_price", land_reason: "", margin_of_safety_pct: "5", thesis: "intact", tripwires_fired: 0,
    siege_exposure: "sheltered", siege_shock_pct: null, siege_method: null, shared_wall_with: [], ...over,
  } as GameTower;
}

const towers = [
  tower({ holding_id: "a", name: "Alpha", weight_pct: "50", freshness: "weathered" }),
  tower({ holding_id: "b", name: "Beta", weight_pct: "30", freshness: "overgrown", land: "fog", land_reason: "No valuation could be read." }),
  tower({ holding_id: "c", name: "Gamma", weight_pct: "20", freshness: "fresh" }),
];
const state: GameState = {
  mapping_version: "v1", as_of: null, demo: false, total_value_nok: "0", towers,
  diworsification: {} as GameState["diworsification"],
  vault: { accounts_total: 2, accounts_with_cash: 1, cash_stale: false } as GameState["vault"],
  siege: null, notes: [],
};
const inputs: SurveyInputs = {
  state,
  competence: { towers: towers.map((t) => ({ holding_id: t.holding_id, name: t.name, sector: "S", weight_pct: null, status: "inside" })) } as Competence,
  records: [{ holding_id: "c", invalidation: "x" } as DecisionRecord],
  documents: {},
  opened: new Set(),
};
const surveyed: TowerFog[] = towers.map((t) => surveyTower(t, inputs));
const commissions = commissionsFor(surveyed, state);

const body = (painted: boolean, demo = false) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <RealmMapBody towers={surveyed} commissions={commissions} demo={demo} painted={painted} />
    </MemoryRouter>,
  );

describe("Cartographer's table pieces", () => {
  it("a tower picture draws one patch per slot: cloud for fog, ring for clear, dashed ring for not judged", () => {
    const slots = fogSlots(surveyed[2]);
    const html = renderToStaticMarkup(<TowerPicture slots={slots} hatchId="h" />);
    expect((html.match(/data-patch=/g) ?? []).length).toBe(5);
    const fogCount = slots.filter((s) => s.state === "fog").length;
    expect((html.match(/data-patch="fog"/g) ?? []).length).toBe(fogCount);
    expect(html).toContain("url(#h)");
    expect(html).not.toMatch(/<filter|feTurbulence|feGaussianBlur|filter=/);
  });

  it("fog carries a ? and a hatch, clear a dot, not judged a dash and a dashed edge", () => {
    expect(renderToStaticMarkup(<PatchMark state="fog" hatchId="h" />)).toContain(">?<");
    expect(renderToStaticMarkup(<PatchMark state="clear" hatchId="h" />)).not.toContain("stroke-dasharray");
    expect(renderToStaticMarkup(<PatchMark state="not_judged" hatchId="h" />)).toContain("stroke-dasharray");
    expect(renderToStaticMarkup(<FogDefs id="h" />)).toContain("<pattern");
  });

  it("the slate prints a word, the label and the reason for each of the five checks", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <TowerSlate tower={surveyed[0]} hatchId="h" onClose={() => {}} />
      </MemoryRouter>,
    );
    for (const c of surveyed[0].checks) {
      expect(html).toContain(PATCH_LOOK[c.state].word);
      expect(html).toContain(c.label);
      expect(html).toContain(c.reason);
    }
    expect(html).toContain('href="/holdings/a"');
    expect(html).not.toMatch(/\bof \d\b|surveyed/i);
  });

  it("a seal carries its number and a shape; the flag is hidden from assistive tech", () => {
    expect(renderToStaticMarkup(<CommissionSeal shape="hexagon" n={2} />)).toMatch(/data-seal="hexagon"[\s\S]*>2</);
    const flag = renderToStaticMarkup(<FlagMark shape="diamond" n={3} />);
    expect(flag).toContain('aria-hidden="true"');
    expect(flag).toContain(">3<");
  });
});

describe("Cartographer's table body", () => {
  it("painted: patches, one tower button per holding with a roving tab stop, no flags until pressed", () => {
    const html = body(true);
    expect((html.match(/class="wm-tower"/g) ?? []).length).toBe(3);
    expect((html.match(/tabindex="0"/g) ?? []).length).toBe(1);
    expect(html).toContain("data-patch=\"fog\"");
    expect(html).not.toContain("data-flag");
    expect(html).toContain('aria-label="Commissions"');
    expect(html).toContain('aria-label="Show on the map: Refresh the analysis"');
    expect(html).toContain('aria-pressed="false"');
  });

  it("painted: the text list stays closed, the holdings chips are always visible, the commission list stays the truth", () => {
    const html = body(true);
    expect(html).not.toContain('aria-label="Fog by tower"');
    expect(html).toContain("Show the survey as a list");
    expect(html).not.toContain("Show which towers");
    for (const c of commissions) expect(html).toContain(c.title);
  });

  it("the cash commission is a seal button that plants its flag on the Keep", () => {
    const html = body(true);
    expect(commissions.some((c) => c.id === "vault")).toBe(true);
    expect(html).toContain("Show on the map: Enter or update the cash figure");
  });

  it("plain view shows the same facts as ordinary cards: every check with its word and reason", () => {
    const html = body(false);
    expect(html).toContain('aria-label="Fog by tower"');
    expect(html).not.toContain("<svg");
    for (const t of surveyed) {
      for (const c of t.checks) {
        expect(html).toContain(c.label);
        expect(html).toContain(c.reason.replace(/'/g, "&#x27;"));
      }
    }
    expect(html).toContain(MAP_COPY.browserNote);
  });

  it("no progress count, no percentage of surveyed, no green, in any mode", () => {
    for (const html of [body(true), body(false), body(true, true)]) {
      expect(html).not.toMatch(/\b\d+ of \d+ (surveyed|checks|towers|clear)\b/i);
      expect(html).not.toMatch(/surveyed|revealed/i);
      expect(html).not.toMatch(/\d\s*%\s*(clear|surveyed|revealed)/i);
      expect(html).not.toMatch(/positive|green/i);
      expect(html).not.toMatch(/\b(well done|streak|reward|unlock|level up)\b/i);
    }
  });

  it("shows the demo pill only for demo data", () => {
    expect(body(true, true)).toContain(MAP_COPY.demo);
    expect(body(true, false)).not.toContain(MAP_COPY.demo);
  });
});

describe("links and keys", () => {
  it("every link the old page rendered is still in the painted and plain markup", () => {
    const want = new Set<string>();
    for (const t of surveyed) want.add(`/holdings/${t.holdingId}`);
    for (const c of commissions) {
      for (const h of c.holdings) {
        if (!h.holdingId) continue;
        want.add(c.id === "report" ? `/holdings/${h.holdingId}?tab=documents` : c.id === "valuation" ? `/holdings/${h.holdingId}?tab=analysis` : `/holdings/${h.holdingId}`);
      }
      if (c.to) want.add(c.to);
    }
    want.add("/fortress");
    const plainHtml = body(false);
    for (const href of want) expect(plainHtml, href).toContain(`href="${href.replace(/&/g, "&amp;")}"`);
    const painted = body(true);
    for (const c of commissions) {
      if (c.to) expect(painted).toContain(`href="${c.to}"`);
      for (const h of c.holdings) {
        const to = c.id === "report" ? `?tab=documents` : c.id === "valuation" ? `?tab=analysis` : "";
        expect(painted).toContain(`href="/holdings/${h.holdingId}${to}"`);
      }
    }
  });

  it("holding links and chips are 44 px targets", () => {
    expect(bodySource).toMatch(/holdingTo\(commission\.id, h\.holdingId\)\} className="inline-flex min-h-\[44px\]/);
    expect(bodySource).toMatch(/inline-flex min-h-\[44px\] items-center text-sm font-semibold/);
  });

  it("the hint names the seals", () => {
    const html = body(true);
    expect(html).toContain(MAP_COPY.hintSeal);
  });

  it("pressed state and Escape-with-focus-return are wired (source guard)", () => {
    expect(mapSource).toMatch(/aria-pressed=\{selectedId === st\.id\}/);
    expect(bodySource).toMatch(/aria-pressed=\{planted\}/);
    expect(mapSource).toMatch(/e\.key === "Escape"[\s\S]{0,80}onEscape\(\)/);
    expect(bodySource).toMatch(/onEscape=\{\(\) => selectedId !== null && closeSlate\(\)\}/);
    expect(bodySource).toMatch(/function closeSlate\(\)[\s\S]{0,200}wm-btn-\$\{id\}[\s\S]{0,20}focus\(\)/);
  });
});

describe("word budget", () => {
  it("the chrome (subtitle, intro, key, hint, demo pill) stays within its own budget", () => {
    const key = Object.values(PATCH_LOOK).map((l) => l.word).join(" ");
    const chrome = [MAP_COPY.subtitle, MAP_COPY.intro, MAP_COPY.hint, MAP_COPY.demo, key].join(" ");
    expect(countWords(chrome)).toBeLessThanOrEqual(CARTOGRAPHER_CHROME_BUDGET);
    expect(countWords(MAP_COPY.intro)).toBeLessThanOrEqual(17);
  });

  it("the default painted body (tower names fixed, lists closed) stays within the page budget", () => {
    const names = surveyed.map((t) => t.name).join(" ");
    expect(countWords(body(true, true)) - countWords(names)).toBeLessThanOrEqual(CARTOGRAPHER_BODY_BUDGET);
  });
});

describe("source guard", () => {
  it("the page and every kit file avoid the positive (green) tokens", () => {
    const files = { "CartographerPage.tsx": page, ...kitSources };
    for (const [name, src] of Object.entries(files)) {
      if (name.endsWith(".test.tsx")) continue;
      expect(src, name).not.toMatch(/bg-positive|text-positive|border-positive/);
    }
    expect(Object.keys(kitSources).some((k) => k.endsWith("FogPatch.tsx"))).toBe(true);
  });

  it("no green colour value in the new kit, CSS or map palette", () => {
    const isGreen = (r: number, g: number, b: number) => g > r + 15 && g > b + 15;
    const all = { ...kitSources, css: realmMapCss, page };
    for (const [name, src] of Object.entries(all)) {
      if (name.endsWith(".test.tsx")) continue;
      for (const m of src.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
        const n = parseInt(m[1], 16);
        expect(isGreen((n >> 16) & 255, (n >> 8) & 255, n & 255), `${name} ${m[0]}`).toBe(false);
      }
      for (const m of src.matchAll(/rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/g)) {
        expect(isGreen(+m[1], +m[2], +m[3]), `${name} ${m[0]}`).toBe(false);
      }
    }
  });

  it("the page no longer imports fogLevel or surveyText (the bar and the count are gone)", () => {
    expect(page).not.toMatch(/fogLevel|surveyText/);
  });
});
