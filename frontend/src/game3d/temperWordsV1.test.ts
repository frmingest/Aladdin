import { describe, expect, it } from "vitest";
import { TEMPERAMENT_RULE_LABEL } from "../lib/fortress";
import { TEMPER_BANNED, TEMPER_RULE_LABEL_V1, gameTemperExplanation, gameTemperSummary } from "./temperWordsV1";

// Every template `services/game/temperament.py` writes, with a few real-looking values.
const EXPLANATIONS: Array<[string, string[]]> = [
  ["Buy while the latest analysis said Avoid.", ["Buy", "Avoid"]],
  ["Add logged without writing what would prove it wrong.", ["Add"]],
  ["Sold while the latest analysis said Strong Buy and no tripwire had fired.", ["Strong Buy"]],
  ["Sell after a tripwire on this holding had fired.", ["Sell"]],
  ["Went back and wrote the 6-month review of this decision.", ["6-month"]],
  ["Went back and wrote the 12-month review of this decision.", ["12-month"]],
  ["4 trades on this holding within 60 days (2026-08-01 to 2026-09-12).", ["4 trades", "60 days", "2026-08-01", "2026-09-12"]],
  ["Kept the position while the price fell 12.5% between snapshots (2026-07-01 to 2026-08-01), with no tripwire fired.", ["12.5%", "2026-07-01", "2026-08-01"]],
];

describe("temperament event explanations in game voice", () => {
  it("every backend template gets game words and keeps its numbers", () => {
    for (const [backend, keep] of EXPLANATIONS) {
      const out = gameTemperExplanation(backend);
      expect(out).not.toBe(backend);
      for (const re of TEMPER_BANNED) expect(out).not.toMatch(re);
      for (const piece of keep) expect(out).toContain(piece);
    }
  });

  it("a sentence it does not know comes back untouched", () => {
    const unknown = "Something the backend has not said before.";
    expect(gameTemperExplanation(unknown)).toBe(unknown);
  });
});

describe("temperament summary in game voice", () => {
  it("rewrites each backend summary and keeps every count", () => {
    const a = gameTemperSummary("3 logged decision(s) and 2 snapshot comparison(s) in the last 90 days; none met a temperament rule, so there is nothing to judge.");
    expect(a).toBe("3 decisions and 2 looks compared in the last 90 days; none fit a rule, so there is nothing to weigh.");
    const b = gameTemperSummary("No logged decisions or snapshot comparisons in the last 90 days. The meter fills in as you use the decision journal.");
    expect(b).toBe("Nothing written or compared in the last 90 days. The needle moves as you use the journal.");
    const c = gameTemperSummary("5 of 7 judged event(s) restored the meter, based on 4 logged decision(s) and 1 snapshot comparison(s) in the last 90 days.");
    expect(c).toBe("5 of 7 moments calmed the needle, from 4 decisions and 1 look compared in the last 90 days.");
    for (const out of [a, b, c]) for (const re of TEMPER_BANNED) expect(out).not.toMatch(re);
  });

  it("keeps the low-confidence tail, and singular counts read as singular", () => {
    const out = gameTemperSummary(
      "1 of 1 judged event(s) restored the meter, based on 1 logged decision(s) and 0 snapshot comparison(s) in the last 90 days. Fewer than 3 logged decisions: a low-confidence reading.",
    );
    expect(out).toBe("1 of 1 moment calmed the needle, from 1 decision and 0 looks compared in the last 90 days. Fewer than 3 decisions so far, so the reading is shaky.");
  });

  it("an unknown summary comes back as it was", () => {
    expect(gameTemperSummary("A summary from a newer backend.")).toBe("A summary from a newer backend.");
  });
});

describe("rule names", () => {
  it("covers every rule the flat page knows, so none falls back by accident", () => {
    expect(Object.keys(TEMPER_RULE_LABEL_V1).sort()).toEqual(Object.keys(TEMPERAMENT_RULE_LABEL).sort());
  });
});
