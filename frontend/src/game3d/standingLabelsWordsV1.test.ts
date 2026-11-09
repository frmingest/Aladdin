import { describe, expect, it } from "vitest";
import { STANDING_BANNED, STANDING_KNOWN, gameStandingText, withGameStandingLabels } from "./standingLabelsWordsV1";
import type { StandingWordsV3 } from "./standingWordsV3";

describe("Standing labels in game voice", () => {
  it("every known backend string gets game words, and none keeps a banned one", () => {
    for (const backend of STANDING_KNOWN) {
      const out = gameStandingText(backend);
      expect(out).not.toBe(backend);
      for (const re of STANDING_BANNED) expect(out).not.toMatch(re);
    }
  });

  it("a string it does not know, and every number-bearing fact, comes back untouched", () => {
    for (const s of ["2 wires fired, not yet looked at", "3 look-backs written, none due", "Too soon to look back: the first opens in 41 days", "No journal entries yet. Nothing to look back on"]) {
      expect(gameStandingText(s)).toBe(s);
    }
  });

  it("rewrites next, watch and ledger of the Quest log words and leaves the rest as it was", () => {
    const base: StandingWordsV3 = { headline: "Level 2 of 5: The Survey", next: "Lift the fog: fetch reports, queue the analysis.", lit: 2, watch: "The watch has not reported. Nothing is known.", ledger: null };
    const out = withGameStandingLabels(base);
    expect(out.headline).toBe(base.headline);
    expect(out.lit).toBe(2);
    expect(out.next).toBe("Lift the fog: fetch reports, then ask for the analysis.");
    expect(out.watch).toBe("The Watch hasn't reported. Everything is in fog.");
    expect(out.ledger).toBeNull();
  });
});
