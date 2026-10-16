import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { GameModeProvider } from "../../lib/gameMode";
import { councilSeats } from "../../lib/councilSeats";
import type { Chronicle, GameState } from "../../lib/types";
import { EmptyState } from "../ui";
import { GameHud } from "./GameFrame";
import CouncilChamber from "./kit/CouncilChamber";
import TimeStrata from "./kit/TimeStrata";

// Game mode is the art switch: the provider defaults to ON, the bare context is OFF.
const on = (n: React.ReactNode) => renderToStaticMarkup(<MemoryRouter><GameModeProvider>{n}</GameModeProvider></MemoryRouter>);
const off = (n: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{n}</MemoryRouter>);

const hud = (level: string) =>
  ({ total_value_nok: 1, vault: { cash_nok: null }, towers: [], siege: { level }, temperament: null }) as unknown as GameState;

describe("Council seat badges", () => {
  const seats = councilSeats({ items: [] });
  const chamber = <CouncilChamber seats={seats} onJump={() => {}} />;

  it("draws one decorative badge per seat that has one (7 of 8) with art on, none with art off", () => {
    const html = on(chamber);
    // each seat renders twice (wide and phone layout); the badges are all alt=""
    expect(html.match(/badge-/g)?.length ?? 0).toBeGreaterThanOrEqual(7);
    expect(off(chamber)).not.toContain("badge-");
  });

  it("keeps the words and the 'none found' line: a badge never says whether a seat is occupied", () => {
    expect(on(chamber)).toContain("none found");
  });
});

describe("Sky badge in the top bar", () => {
  it("shows a picture for calm, gathering and besieged, with the word beside it", () => {
    for (const [level, word] of [["calm", "Calm skies"], ["gathering", "Storm clouds gathering"], ["besieged", "Under siege"]] as const) {
      const html = on(<GameHud state={hud(level)} />);
      expect(html).toContain("<img");
      expect(html).toContain(word);
    }
  });

  it("keeps the drawn icon for 'not surveyed' and with art off", () => {
    expect(on(<GameHud state={hud("unsurveyed")} />)).not.toContain("<img");
    expect(off(<GameHud state={hud("calm")} />)).not.toContain("<img");
  });
});

describe("Chronicle gap and empty chest", () => {
  const chronicle = {
    rules_version: "t", demo: false, frames: [], changes: [], stored_frames: 0, positions_only_frames: 0, first_stored_day: null,
    hidden_frames: 0, gaps: [{ first_day: "2026-10-02", last_day: "2026-10-04", days: 3, text: "No frame was stored for 3 days." }], notes: [],
  } as Chronicle;

  it("covers a gap with the plot picture (art on), and the gap words stay", () => {
    const html = on(<TimeStrata chronicle={chronicle} />);
    expect(html).toContain("strata-sconce");
    expect(html).toContain("No frame was stored for 3 days.");
    expect(off(<TimeStrata chronicle={chronicle} />)).not.toContain("<img");
  });

  it("adds the empty chest only when asked and only in Game mode", () => {
    expect(on(<EmptyState chest>Nothing yet</EmptyState>)).toContain("<img");
    expect(on(<EmptyState>Nothing yet</EmptyState>)).not.toContain("<img");
    expect(off(<EmptyState chest>Nothing yet</EmptyState>)).not.toContain("<img");
  });
});
