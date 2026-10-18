import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { GameModeProvider } from "../../lib/gameMode";
import type { GameState } from "../../lib/types";
import { EmptyState } from "../ui";
import { GameHud } from "./GameFrame";

// Game mode is the art switch: the provider defaults to ON, the bare context is OFF.
const on = (n: React.ReactNode) => renderToStaticMarkup(<MemoryRouter><GameModeProvider>{n}</GameModeProvider></MemoryRouter>);
const off = (n: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{n}</MemoryRouter>);

const hud = (level: string) =>
  ({ total_value_nok: 1, vault: { cash_nok: null }, towers: [], siege: { level }, temperament: null }) as unknown as GameState;

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

describe("Empty chest", () => {
  it("adds the empty chest only when asked and only in Game mode", () => {
    expect(on(<EmptyState chest>Nothing yet</EmptyState>)).toContain("<img");
    expect(on(<EmptyState>Nothing yet</EmptyState>)).not.toContain("<img");
    expect(off(<EmptyState chest>Nothing yet</EmptyState>)).not.toContain("<img");
  });
});
