import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { GameState, GameVault } from "../lib/types";
import VaultPanel from "./VaultPanel";

function vault(o: Partial<GameVault>): GameVault {
  return {
    level: "stocked", cash_nok: "250000", cash_share_pct: "12.5", accounts_total: 2, accounts_with_cash: 2,
    cash_oldest_as_of: "2026-10-20", gold_oz: "0", silver_oz: "0", cash_stale: false,
    accounts: [{ account_id: "acc-1", name: "ASK", cash_nok: "250000", cash_as_of: "2026-10-20", stale: false }],
    ...o,
  } as GameVault;
}

function html(v: GameVault, demo = false) {
  const state = { demo, vault: v, temperament: null } as unknown as GameState;
  return renderToStaticMarkup(
    <MemoryRouter>
      <VaultPanel state={state} onChanged={() => {}} onClose={() => {}} />
    </MemoryRouter>,
  );
}

describe("VaultPanel (the vault chest's panel)", () => {
  it("shows the flat Vault card's own words and numbers, with a link to the flat page", () => {
    const h = html(vault({}));
    expect(h).toContain("The Vault");
    expect(h).toContain("Stocked vault");
    expect(h).toContain("in cash");
    expect(h).toContain("Update cash");
    expect(h).toContain('href="/fortress"');
    expect(h).toContain("Open the flat page");
  });

  it("keeps fog for cash that was never typed in: no amount, and the card says so", () => {
    const h = html(vault({ level: "unsurveyed", cash_nok: null, cash_share_pct: null, accounts_with_cash: 0, accounts: [{ account_id: "acc-1", name: "ASK", cash_nok: null, cash_as_of: null, stale: false }] }));
    expect(h).toContain("Cash not entered");
    expect(h).toContain("Not entered yet");
    expect(h).toContain("Enter cash");
  });

  it("cannot save on the sample fortress: no cash button, and the card says why", () => {
    const h = html(vault({}), true);
    expect(h).toContain("Demo data: cash cannot be edited while demo mode is on.");
    expect(h).not.toContain("Update cash");
  });

  it("closes with a labelled button", () => {
    expect(html(vault({}))).toContain('aria-label="Close"');
  });
});
