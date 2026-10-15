import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import BlindfoldScene from "./BlindfoldScene";

const base = {
  points: [
    { label: "Year -3", value: 100 },
    { label: "Year -2", value: 120 },
    { label: "Year -1", value: 90 },
    { label: "Year 0", value: 130 },
  ],
  min: 0,
  max: 200,
};

describe("BlindfoldScene", () => {
  it("is decoration: hidden from assistive technology, no pictures with art off, and no fact only in a picture", () => {
    const html = renderToStaticMarkup(<BlindfoldScene {...base} low={80} high={140} actual={null} />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("<img"); // art is off in a server render; the drawn scene stands alone
    // the stakes are labelled by word as well as by shape
    expect(html).toContain(">Low<");
    expect(html).toContain(">High<");
  });

  it("draws one tide mark per year shown", () => {
    const html = renderToStaticMarkup(<BlindfoldScene {...base} low={null} high={null} actual={null} />);
    expect(html.match(/<circle /g)?.length).toBe(4);
    expect(html).not.toContain(">Low<");
  });

  it("names the answer on the water once it is known", () => {
    const before = renderToStaticMarkup(<BlindfoldScene {...base} low={80} high={140} actual={null} />);
    expect(before).not.toContain("Answer ");
    const after = renderToStaticMarkup(<BlindfoldScene {...base} low={80} high={140} actual={150} />);
    expect(after).toContain("Answer 150");
  });

  it("keeps a stored figure far outside the gauge on the gauge", () => {
    const html = renderToStaticMarkup(<BlindfoldScene {...base} low={80} high={140} actual={99999} />);
    expect(html).toContain("Answer 99,999");
    expect(html).not.toContain("NaN");
  });
});
