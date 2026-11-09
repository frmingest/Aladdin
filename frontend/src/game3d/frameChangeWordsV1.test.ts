import { describe, expect, it } from "vitest";
import { FRAME_CHANGE_BANNED, gameFrameChangeText } from "./frameChangeWordsV1";

/** The backend's own frame-change sentences (`frame_diff.py`), each with the values that must survive. Test data only. */
const SAMPLES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["The weather turned from calm to gathering.", ["calm", "gathering"]],
  ["The weather turned from besieged to unsurveyed.", ["besieged"]],
  ["Vend joined the fortress (4.0% of the realm).", ["Vend", "4.0%"]],
  ["Vend joined the fortress (an unknown share of the realm).", ["Vend"]],
  ["Subsea 7 S.A left the fortress (it held 12.5% of the realm).", ["Subsea 7 S.A", "12.5%"]],
  ["Kongsberg went from 4.0% to 5.5% of the realm.", ["Kongsberg", "4.0%", "5.5%"]],
  ["The walls of Vend were surveyed: granite.", ["Vend", "solid"]],
  ["The walls of Vend can no longer be surveyed (the figures are missing).", ["Vend"]],
  ["The walls of Vend went from brick to granite.", ["Vend", "worn", "solid"]],
  ["The moat of Bouvet was surveyed: wide.", ["Bouvet", "wide"]],
  ["The moat of Bouvet is no longer surveyed.", ["Bouvet"]],
  ["The moat of Bouvet went from narrow to wide.", ["Bouvet", "narrow", "wide"]],
  ["A tripwire fired on Vend.", ["Vend"]],
  ["The breach on Vend cleared (breached to intact).", ["Vend", "standing"]],
  ["The thesis of Vend moved from intact to not analyzed.", ["Vend", "standing", "not checked yet"]],
];

describe("frame-change sentences in game voice", () => {
  it("every sentence the backend writes gets game words and keeps its names and numbers", () => {
    for (const [backend, keep] of SAMPLES) {
      const out = gameFrameChangeText(backend);
      if (FRAME_CHANGE_BANNED.some((re) => re.test(backend))) expect(out, backend).not.toBe(backend);
      for (const re of FRAME_CHANGE_BANNED) expect(out, backend).not.toMatch(re);
      for (const k of keep) expect(out, backend).toContain(k);
    }
  });

  it("reads as plain sentences", () => {
    expect(gameFrameChangeText("Kongsberg went from 4.0% to 5.5% of the realm.")).toBe("Kongsberg's share went from 4.0% to 5.5% of the fortress.");
    expect(gameFrameChangeText("Vend joined the fortress (4.0% of the realm).")).toBe("Vend joined the fortress with a 4.0% share.");
    expect(gameFrameChangeText("The walls of Vend went from brick to granite.")).toBe("The walls of Vend went from worn to solid.");
    expect(gameFrameChangeText("The moat of Bouvet is no longer surveyed.")).toBe("The moat of Bouvet slipped back into fog.");
  });

  it("a sentence it does not know comes back untouched, and a Night Watch tripwire line is not a frame change", () => {
    expect(gameFrameChangeText("Something new the backend learned to say.")).toBe("Something new the backend learned to say.");
    expect(gameFrameChangeText("A tripwire fired on Vend: Net debt / EBITDA.")).toBe("A tripwire fired on Vend: Net debt / EBITDA.");
  });
});
