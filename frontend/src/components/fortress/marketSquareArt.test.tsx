import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { GameModeProvider } from "../../lib/gameMode";
import MarketSquare from "./MarketSquare";
import VaultCard from "./VaultCard";
import type { GameVault } from "../../lib/types";

/** Pictures follow Game mode (no separate switch), so the stub turns game mode on or off. */
function stub(game: boolean) {
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (k === "aladdin-game-mode" ? (game ? "on" : "off") : null),
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  };
}
afterEach(() => {
  delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
});

const square = () => (
  <svg>
    <MarketSquare y={0} count={3} inRange={1} tones={["gold", "amber", "plain"]} hot={false} onOpen={() => {}} onHover={() => {}} />
  </svg>
);

describe("Marketplace in the Fortress view", () => {
  it("draws the main building and one smaller booth per store with game mode on", () => {
    stub(true);
    const html = renderToStaticMarkup(<GameModeProvider>{square()}</GameModeProvider>);
    expect(html).toContain("market-hall");
    expect((html.match(/market-booth/g) ?? []).length).toBe(3);
    expect(html).toContain("Marketplace · 3 stores");
  });

  it("keeps the drawn hall and stalls with game mode off", () => {
    stub(false);
    const html = renderToStaticMarkup(<GameModeProvider>{square()}</GameModeProvider>);
    expect(html).not.toContain("market-hall");
    expect(html).toContain("MARKETPLACE");
  });
});

const vault = (level: GameVault["level"]): GameVault =>
  ({ level, cash_nok: null, cash_share_pct: null, accounts_with_cash: 0, accounts_total: 0, cash_oldest_as_of: null, cash_stale: false, gold_oz: "0", silver_oz: "0", accounts: [] }) as unknown as GameVault;

describe("Vault picture", () => {
  const render = (level: GameVault["level"]) =>
    renderToStaticMarkup(
      <GameModeProvider>
        <MemoryRouter>
          <VaultCard vault={vault(level)} demo={false} />
        </MemoryRouter>
      </GameModeProvider>,
    );

  it("draws the empty cutaway for every level, so no picture can claim money", () => {
    stub(true);
    for (const level of ["deep", "stocked", "thin", "empty", "unsurveyed"] as const) {
      const html = render(level);
      expect(html).toContain("vault-cutaway");
      expect(html).not.toContain("vault-stocked");
    }
  });

  it("keeps the drawn vault with game mode off", () => {
    stub(false);
    const html = render("stocked");
    expect(html).not.toContain("vault-cutaway");
    expect(html).toContain("<svg");
  });
});
