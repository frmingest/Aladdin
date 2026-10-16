import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import WinterScene, { ICICLE_SPOTS, candleSpots } from "./WinterScene";
import { CANDLES, type WinterSceneState } from "../../../lib/winter";

const state = (over: Partial<WinterSceneState> = {}): WinterSceneState => ({
  progress: 0,
  candlesLit: CANDLES,
  frost: 0,
  icicles: 0,
  atBottom: false,
  ...over,
});

describe("WinterScene", () => {
  it("is decoration: hidden from assistive technology, no pictures with art off, facts also printed as words", () => {
    const html = renderToStaticMarkup(<WinterScene state={state({ candlesLit: 3, frost: 0.4, icicles: 2 })} />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("<img"); // art is off in a server render; the drawn scene stands alone
    expect(html).toContain("3 of 5 candles lit");
    expect(html).toContain("Frost: 40% of the worst day");
  });

  it("draws every candle and marks which are lit and which are out by shape, not colour", () => {
    const html = renderToStaticMarkup(<WinterScene state={state({ candlesLit: 2 })} />);
    expect(html.match(/data-candle="lit"/g)?.length).toBe(2);
    expect(html.match(/data-candle="out"/g)?.length).toBe(3);
    expect(html.match(/<ellipse /g)?.length).toBe(2); // a flame only on a lit candle
    expect(html.match(/stroke-dasharray="2 2"/g)?.length).toBe(3); // a smoke wisp only on a candle that is out
  });

  it("has no frost at the peak and a frost layer once the day is deeper", () => {
    expect(renderToStaticMarkup(<WinterScene state={state()} />)).not.toContain('fill="url(#ws-frost)"');
    expect(renderToStaticMarkup(<WinterScene state={state({ frost: 0.5, icicles: 2 })} />)).toContain('fill="url(#ws-frost)"');
  });

  it("hangs the icicle copies where the table says, and no more than three", () => {
    expect(Object.keys(ICICLE_SPOTS).map(Number)).toEqual([0, 1, 2, 3]);
    for (const [n, spots] of Object.entries(ICICLE_SPOTS)) expect(spots).toHaveLength(Number(n));
    const html = renderToStaticMarkup(<WinterScene state={state({ frost: 1, icicles: 9 })} />);
    expect(html.match(/<polygon points="[^"]*,0 /g)?.length).toBe(3);
  });

  it("stands the candles on the table in a row, never off the scene", () => {
    const spots = candleSpots();
    expect(spots).toHaveLength(CANDLES);
    for (const s of spots) {
      expect(s.x).toBeGreaterThan(0);
      expect(s.x).toBeLessThan(1);
      expect(s.y).toBeGreaterThan(0.2);
      expect(s.y).toBeLessThan(1);
    }
    expect(renderToStaticMarkup(<WinterScene state={state()} />)).not.toContain("NaN");
  });
});
