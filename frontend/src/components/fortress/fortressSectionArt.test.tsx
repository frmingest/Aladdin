import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { GameModeProvider } from "../../lib/gameMode";
import VerdictKeep from "./kit/VerdictKeep";
import WatchBeacon from "./kit/WatchBeacon";
import WallsOnTheRise from "./WallsOnTheRise";
import SpreadSkyline from "./kit/SpreadSkyline";
import DeskLamp from "./kit/DeskLamp";
import FortressReports from "./FortressReports";
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

describe("SpreadSkyline", () => {
  it("draws the skyline with the top-five bracket and says when the equal split is unknown", () => {
    stub(true);
    const html = wrap(<SpreadSkyline weights={[40, 25, 15, 10, 6, 4]} effective={null} shacks={0} />);
    expect(html).toContain("spread-skyline");
    expect(html).toContain("equal split not known");
  });
  it("shows a shack per tiny position, capped, and fogs a holding with no weight", () => {
    stub(true);
    const html = wrap(<SpreadSkyline weights={[60, null, 40]} effective={1.9} shacks={9} />);
    expect((html.match(/shack/g) ?? []).length).toBeGreaterThanOrEqual(6);
    expect(html).toContain(">?<");
  });
  it("draws nothing with no weights at all", () => {
    stub(true);
    expect(wrap(<SpreadSkyline weights={[null]} effective={1} shacks={0} />)).toBe("");
  });
});

describe("DeskLamp", () => {
  it("draws a flame only while the snapshot keeps the lamp lit or dim", () => {
    stub(true);
    expect(wrap(<DeskLamp state="lit" label="x" fallback={null} />)).toContain("fill-accent");
    expect(wrap(<DeskLamp state="out" label="x" fallback={null} />)).not.toContain("fill-accent");
  });
});

describe("Report tabs", () => {
  const state = { advisors: null, siege: null, temperament: null } as never;
  it("puts the fixed calm and panic pair on Temperament in game mode, and nothing with it off", () => {
    stub(true);
    const on = wrap(<FortressReports state={state} ravens={null} seen={new Set()} onSeen={() => {}} />);
    expect(on).toContain("temperament-calm");
    expect(on).toContain("temperament-panic");
    stub(false);
    const off = wrap(<FortressReports state={state} ravens={null} seen={new Set()} onSeen={() => {}} />);
    expect(off).not.toContain("temperament-calm");
    expect(off).toContain("Temperament");
  });
});
