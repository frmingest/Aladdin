import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import TemperamentCard from "../components/fortress/TemperamentCard";
import VaultCard from "../components/fortress/VaultCard";
import type { GameTemperament, GameVault } from "../lib/types";
import {
  TEMPER_V2, VAULT_V2, VAULT_WATCH_BANNED, WATCH_STATE_V2, WATCH_STATUS_V2, WATCH_V2, stampLineV2,
} from "./vaultWatchWordsV2";
import { stampLine } from "../lib/nightWatch";
import type { NightWatch } from "../lib/types";

const vault = {
  level: "stocked", cash_nok: "250000", cash_share_pct: "12.5", accounts_with_cash: 2, accounts_total: 3,
  cash_oldest_as_of: "2026-10-01", cash_stale: true, gold_oz: "2", silver_oz: "10", accounts: [],
} as unknown as GameVault;
const temper = {
  level: "steady", needle_pct: 55, low_confidence: true, summary: "s", restores: 2, drains: 1,
  events: [{ rule: "patience", on: "2026-10-01", holding_name: "Acme", kind: "restore", explanation: "e", source: "snapshots" }],
  turnover: [{ account_name: "ASK", from_at: "2026-09-01", to_at: "2026-10-01", added: 1, removed: 0, resized: 2, turnover_pct: "10" }],
} as unknown as GameTemperament;

const page = (el: JSX.Element) => renderToStaticMarkup(<MemoryRouter>{el}</MemoryRouter>);
const visible = (html: string) => html.replace(/<[^>]*>/g, " ");

describe("Vault, temperament and Night Watch game voice (3D)", () => {
  it("game voice has no system words on the page face", () => {
    const text = visible(page(<><VaultCard vault={vault} onChanged={() => {}} voice="game" /><TemperamentCard temperament={temper} voice="game" /></>));
    for (const re of VAULT_WATCH_BANNED) expect(text).not.toMatch(re);
    expect(text).toContain(VAULT_V2.stale);
    expect(text).toContain(TEMPER_V2.countsOnly);
  });

  it("unknown is fog in both cards, never 'not entered' or a calm word", () => {
    const fogVault = { ...vault, level: "unsurveyed", cash_nok: null, cash_share_pct: null, accounts_with_cash: 0 } as unknown as GameVault;
    const fogTemper = { ...temper, level: "unsurveyed", needle_pct: null, events: [], turnover: [] } as unknown as GameTemperament;
    const text = visible(page(<><VaultCard vault={fogVault} voice="game" /><TemperamentCard temperament={fogTemper} voice="game" /></>));
    expect(text).toContain("Cash in fog");
    expect(text).toContain("Too little to read");
    for (const re of VAULT_WATCH_BANNED) expect(text).not.toMatch(re);
  });

  it("the flat Fortress keeps its neutral wording", () => {
    const text = visible(page(<><VaultCard vault={vault} /><TemperamentCard temperament={temper} /></>));
    expect(text).toContain("of cash plus portfolio");
    expect(text).toContain("Low confidence");
    expect(text).toContain("portfolio snapshots");
    expect(text).not.toContain(VAULT_V2.stale);
  });

  it("numbers stay exact in game voice", () => {
    const text = visible(page(<TemperamentCard temperament={temper} voice="game" />));
    expect(text).toContain("55 / 100");
    expect(text).toContain("▲ 2 calmed");
    expect(text).toContain("▼ 1 rattled");
    expect(text).toContain("1 tower added, 0 removed, 2 resized");
  });

  it("every Night Watch state has a game word and the stamp keeps its numbers", () => {
    for (const w of [...Object.values(WATCH_STATUS_V2), ...Object.values(WATCH_STATE_V2), WATCH_V2.loading, WATCH_V2.note]) {
      for (const re of VAULT_WATCH_BANNED) expect(w).not.toMatch(re);
    }
    const w = { watch_age_hours: 3, frames_stored: 120 } as unknown as NightWatch;
    expect(stampLineV2(w)).toBe("Last look 3 hours ago · 120 readings saved");
    expect(stampLine(w)).toBe("Watch: 3 hours ago · 120 frames stored");
  });
});
