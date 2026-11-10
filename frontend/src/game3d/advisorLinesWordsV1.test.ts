import { describe, expect, it } from "vitest";
import { ADVISOR_BANNED, gameAdvisorDisclaimer, gameAdvisorFact, gameAdvisorLine } from "./advisorLinesWordsV1";

/** Every template in `advisor_lines_v1.py`, filled the way `advisors.py` fills it, with the numbers that must survive. */
const LINE_SAMPLES: [string, string[]][] = [
  ["Vend: 2 of the conditions you wrote down as proof the thesis was wrong has fired. Read the thesis again while you are calm, before the price does the arguing for you.", ["Vend", "2"]],
  ["Vend: something changed since the last analysis. Find out what moved before you decide anything about it.", ["Vend"]],
  ["Kongsberg is 12.3% of the portfolio and its walls are timber. A big position should have the strongest balance sheet you own, not the weakest. Invert it: what would have to go wrong for this to hurt?", ["Kongsberg", "12.3%", "patched"]],
  ["Bouvet is 9.0% of the portfolio and the analysis found no moat. Without one, a good year invites competitors in. Be sure that is the bet you meant to make.", ["Bouvet", "9.0%"]],
  ["Vår Energi: a big tower, and the analysis is 41 days old. A conclusion that old is a memory, not a reading. Run it again before you lean on it.", ["Vår Energi", "41 days"]],
  ["The weather is turning and the vault is deep. This is what dry powder is for. Nothing here says you must spend it; being able to wait is the point.", ["deep"]],
  ["The weather is turning and the vault is thin. Ask yourself honestly whether you could sit through a worse quarter without being forced to give up a position.", ["thin"]],
  ["4 positions are each too small to matter. A holding too small to move the result is also too small to be worth your attention. Either it earns real study or it is clutter.", ["4 towers"]],
  ["Vend and Salmon Evolution stand on one cracked wall (correlation 0.85, together 14.2% of the portfolio). In a bad week they are likely to fall together, so count them as one bet.", ["Vend and Salmon Evolution", "0.85", "14.2%"]],
  ["Exxon Mobil is priced below its bear case with strong walls and a moat. That is a reason to study it closely, not a signal. First find out why the market is paying so little.", ["Exxon Mobil", "low case"]],
  ["Apple is 11.0% of the portfolio and trades above its bull case. A wonderful business can still be bought at a poor price; the stored valuation assumes a lot goes right.", ["Apple", "11.0%", "high case"]],
  ["The journal reads strained: 3 recent decisions went against your own rules, out of 8 logged. Read the lines on the temperament card before the next decision, not after it.", ["strained", "3 decisions", "8"]],
  ["The journal reads composed over 12 logged decisions. Keep writing down what would prove you wrong; that habit is what keeps this reading honest.", ["12 logged decisions"]],
  ["I cannot judge your powder: no cash has been entered. Update the vault card so the weather report means something.", ["no cash is in the vault yet"]],
  ["I cannot judge your powder: the cash figure is old. Update the vault card so the weather report means something.", ["cash figure is old"]],
  ["No tripwire has fired and nothing in the survey asks for action. Most of the time the work is waiting, and waiting well is not the same as doing nothing.", []],
];

const FACT_SAMPLES: [string, string][] = [
  ["2 tripwire(s) fired on the thesis monitor", "2 wires rang on your why"],
  ["the thesis monitor flagged it for review", "your why is due a look"],
  ["weight 12.3%", "share 12.3%"],
  ["weight an unknown share", "share in fog"],
  ["wall: rotted", "walls: failing"],
  ["moat: none found by the analysis", "moat: none found"],
  ["moat: wide", "moat: wide"],
  ["analysis age 41 days", "last look 41 days old"],
  ["land: above the bull case", "price: above the high case"],
  ["land: bargain", "price: bargain"],
  ["land: full_price", "price: full price"],
  ["weather: besieged", "weather: besieged"],
  ["weather: unsurveyed", "weather: in fog"],
  ["vault: unsurveyed", "vault: in fog"],
  ["stale: True", "cash figure: old"],
  ["stale: False", "cash figure: fresh"],
  ["5 positions under the tiny-position size", "5 towers under the tiny-tower size"],
  ["9 positions in all", "9 towers in all"],
  ["correlation 0.85", "move-together score 0.85"],
  ["combined weight 14.2%", "together 14.2% of the fortress"],
  ["8 holdings surveyed", "8 towers checked"],
  ["no tripwire fired", "no wire rang"],
];

describe("Council advisor lines in game voice", () => {
  it("every sentence the backend writes gets game words and keeps its names and numbers", () => {
    for (const [backend, keep] of LINE_SAMPLES) {
      const out = gameAdvisorLine(backend);
      expect(out, backend).not.toBe(backend);
      for (const re of ADVISOR_BANNED) expect(out, out).not.toMatch(re);
      for (const k of keep) expect(out, out).toContain(k);
    }
  });

  it("singular counts read as singular, and an unknown share is fog", () => {
    expect(gameAdvisorLine("Vend: 1 of the conditions you wrote down as proof the thesis was wrong has fired. Read the thesis again while you are calm, before the price does the arguing for you."))
      .toContain("1 of the signs you said would prove you wrong has shown up");
    expect(gameAdvisorLine("1 positions are each too small to matter. A holding too small to move the result is also too small to be worth your attention. Either it earns real study or it is clutter."))
      .toMatch(/^1 tower is too small/);
    expect(gameAdvisorLine("Vend is an unknown share of the portfolio and the analysis found no moat. Without one, a good year invites competitors in. Be sure that is the bet you meant to make."))
      .toContain("Vend holds a share in fog");
  });

  it("no line tells the player to trade", () => {
    for (const [backend] of LINE_SAMPLES) expect(gameAdvisorLine(backend)).not.toMatch(/\b(buy|sell|add|trim)\b/i);
  });

  it("a sentence it does not know comes back untouched, so nothing is lost or guessed", () => {
    const unknown = "Vend: a rule the backend added later says something new.";
    expect(gameAdvisorLine(unknown)).toBe(unknown);
  });
});

describe("Council facts and footnote", () => {
  it("each stored fact reads in game words with its numbers intact", () => {
    for (const [backend, game] of FACT_SAMPLES) expect(gameAdvisorFact(backend)).toBe(game);
  });

  it("free-text reasons copied from other cards pass through untouched", () => {
    expect(gameAdvisorFact("Net debt is 3.2x EBITDA")).toBe("Net debt is 3.2x EBITDA");
  });

  it("the footnote keeps saying these are not quotations and not advice", () => {
    const backend = "Written for Aladdin in the spirit of a patient owner and a blunt sceptic. These are not quotations from Warren Buffett or Charlie Munger, and nothing here is advice to trade.";
    const out = gameAdvisorDisclaimer(backend);
    expect(out).toMatch(/Not quotes from Warren Buffett or Charlie Munger/);
    expect(out).toMatch(/not advice to trade/);
    expect(gameAdvisorDisclaimer("something else")).toBe("something else");
  });
});
