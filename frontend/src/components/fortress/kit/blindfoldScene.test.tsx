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
    expect(before).not.toContain(">Answer<");
    const after = renderToStaticMarkup(<BlindfoldScene {...base} low={80} high={140} actual={150} />);
    expect(after).toContain(">Answer<");
    expect(after).toContain(">150<");
  });

  it("keeps a stored figure far outside the gauge on the gauge", () => {
    const html = renderToStaticMarkup(<BlindfoldScene {...base} low={80} high={140} actual={99999} />);
    expect(html).toContain(">99,999<");
    expect(html).not.toContain("NaN");
  });

  it("offers draggable, keyboard-reachable stakes only while a move handler is given and the answer is hidden", () => {
    const playing = renderToStaticMarkup(<BlindfoldScene {...base} low={80} high={140} actual={null} onChange={() => {}} />);
    expect(playing.match(/role="slider"/g)?.length).toBe(2);
    expect(playing).toContain('aria-label="Low stake"');
    expect(playing).toContain('aria-label="High stake"');
    const watching = renderToStaticMarkup(<BlindfoldScene {...base} low={80} high={140} actual={null} />);
    expect(watching).not.toContain('role="slider"');
    const done = renderToStaticMarkup(<BlindfoldScene {...base} low={80} high={140} actual={150} onChange={() => {}} />);
    expect(done).not.toContain('role="slider"');
  });

  it("stamps the result with a shape and a word, not colour alone", () => {
    const hit = renderToStaticMarkup(<BlindfoldScene {...base} low={80} high={140} actual={110} position="inside" />);
    expect(hit).toContain("Caught it!");
    expect(hit).toContain("\u25CF");
    expect(renderToStaticMarkup(<BlindfoldScene {...base} low={80} high={140} actual={190} position="above" />)).toContain("Missed: above");
    expect(renderToStaticMarkup(<BlindfoldScene {...base} low={80} high={140} actual={10} position="below" />)).toContain("Missed: below");
  });
});
