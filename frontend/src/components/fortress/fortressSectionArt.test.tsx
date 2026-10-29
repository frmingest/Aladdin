import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { GameModeProvider } from "../../lib/gameMode";
import VerdictKeep from "./kit/VerdictKeep";
import WatchBeacon from "./kit/WatchBeacon";
import WallsOnTheRise from "./WallsOnTheRise";
import type { GameTower } from "../../lib/types";

function stub(game: boolean) {
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (k === "aladdin-game-mode" ? (game ? "on" : "off") : null),
    setItem: () => {}, removeItem: () => {}, clear: () => {}, key: () => null, length: 0,
  };
}
afterEach(() => {
  delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
});
const wrap = (el: JSX.Element) => renderToStaticMarkup(<GameModeProvider><MemoryRouter>{el}</MemoryRouter></GameModeProvider>);

describe("VerdictKeep", () => {
  it("flies a flag whose words match the level, game mode on", () => {
    stub(true);
    expect(wrap(<VerdictKeep level="attention" />)).toContain("Flag: Needs a look");
    expect(wrap(<VerdictKeep level="unknown" />)).toContain("Flag: Cannot judge yet");
  });
  it("fogs the keep when the level is unknown and not otherwise", () => {
    stub(true);
    expect(wrap(<VerdictKeep level="unknown" />)).toContain("opacity-45");
    expect(wrap(<VerdictKeep level="sound" />)).not.toContain("opacity-45");
  });
  it("keeps the lamp mark with game mode off", () => {
    stub(false);
    expect(wrap(<VerdictKeep level="mixed" />)).not.toContain("verdict-keep");
  });
});

describe("WatchBeacon", () => {
  it("says a silent watch is out, never lit", () => {
    stub(true);
    const out = wrap(<WatchBeacon status="quiet" watchState="old" />);
    expect(out).toContain('data-state="out"');
    expect(out).toContain("has not reported");
  });
  it("lights only a watch that reported in", () => {
    stub(true);
    expect(wrap(<WatchBeacon status="quiet" watchState="ok" />)).toContain('data-state="lit"');
  });
  it("draws nothing with game mode off", () => {
    stub(false);
    expect(wrap(<WatchBeacon status="quiet" watchState="ok" />)).toBe("");
  });
});

const keep = (wall: GameTower["wall"]): GameTower =>
  ({ holding_id: "h1", ticker: "T", name: "Test AS", instrument_type: "stock", sector: null, structure: "keep", value_nok: null, weight_pct: null, size_class: "medium", moat: "wide", wall, wall_reason: "", wall_inputs: {}, wall_margins: [], freshness: "fresh", analysis_age_days: 1, verdict_rating: null, land: "fog", land_reason: "", margin_of_safety_pct: null, thesis: "intact", tripwires_fired: 0, siege_exposure: "unsurveyed", siege_shock_pct: null, siege_method: null, shared_wall_with: [] }) as GameTower;

describe("WallsOnTheRise pictures", () => {
  it("adds the scaffold and the tower's own bastion in game mode, and dims an unmeasured one", () => {
    stub(true);
    const html = wrap(<WallsOnTheRise towers={[keep("brick")]} selectedId={null} onSelect={() => {}} />);
    expect(html).toContain("scaffold-windlass");
    expect(html).toContain("bastion-brick");
    expect(html).toContain("opacity-40");
  });
  it("keeps the words and the drawn header with game mode off", () => {
    stub(false);
    const html = wrap(<WallsOnTheRise towers={[keep("brick")]} selectedId={null} onSelect={() => {}} />);
    expect(html).not.toContain("bastion-brick");
    expect(html).toContain("Brick walls");
  });
});
