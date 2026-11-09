import { describe, expect, it } from "vitest";
import { gameWatchText, WATCH_LINE_BANNED } from "./watchLinesWordsV1";
import { WATCH_LINE_SAMPLES } from "./watchLinesSamples";

describe("Night Watch lines in game voice", () => {
  it("every sentence the backend writes gets game words and keeps its numbers", () => {
    for (const [backend, numbers] of WATCH_LINE_SAMPLES) {
      const out = gameWatchText(backend);
      if (WATCH_LINE_BANNED.some((re) => re.test(backend))) expect(out).not.toBe(backend);
      for (const re of WATCH_LINE_BANNED) expect(out).not.toMatch(re);
      for (const num of numbers) expect(out).toContain(num);
    }
  });

  it("singular counts read as singular", () => {
    expect(gameWatchText("1 earlier tripwire(s) are still firing on 1 tower(s).")).toBe("1 earlier tripwire is still lit on 1 tower.");
    expect(gameWatchText("1 tripwire(s) are firing.")).toBe("1 tripwire is lit.");
    expect(gameWatchText("1 new report(s) landed overnight: Subsea 7 S.A ×80.")).toBe("1 raven landed overnight: Subsea 7 S.A ×80.");
  });

  it("a sentence it does not know comes back untouched, so nothing is lost or guessed", () => {
    const unknown = "Apple went from 4.0% to 5.5% of the realm.";
    expect(gameWatchText(unknown)).toBe(unknown);
    expect(gameWatchText("A tripwire fired on Vend: Net debt / EBITDA.")).toBe("A tripwire fired on Vend: Net debt / EBITDA.");
  });
});

describe("Night Watch headline and quiet line", () => {
  it("the flat wording stays in the backend; game voice rewrites only on the 3D card", () => {
    const flat = "One fortress frame is stored; changes show from the second one.";
    expect(gameWatchText(flat)).toBe("One look is saved; changes show from the second.");
    expect(gameWatchText("2 tripwire(s) fired overnight.")).toBe("2 tripwires fired overnight.");
    expect(gameWatchText("The watch has not reported in, so quiet cannot be claimed.")).not.toMatch(/quiet cannot/);
  });
});
