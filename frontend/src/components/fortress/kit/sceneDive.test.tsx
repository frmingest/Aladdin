import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SCENES } from "../../../lib/mapScenes";
import SceneDive from "./SceneDive";

const base = { name: "Xetra-Gold", origin: { x: 320, y: 210 }, radius: 700, onBack: () => undefined, onImageError: () => undefined };

describe("SceneDive", () => {
  it("is a named region with the scene, the holding's name and one Back button", () => {
    const html = renderToStaticMarkup(<SceneDive {...base} scene="mines" phase="open" />);
    expect(html).toContain('role="region"');
    expect(html).toContain(`aria-label="${SCENES.mines.kicker}: Xetra-Gold"`);
    expect(html).toContain(SCENES.mines.src);
    expect(html).toContain("Xetra-Gold");
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toContain("Back to the map");
  });

  it("hands the iris its origin and reach as custom properties, and the phase as data", () => {
    const html = renderToStaticMarkup(<SceneDive {...base} scene="forge" phase="in" />);
    expect(html).toContain("--ox:320px");
    expect(html).toContain("--oy:210px");
    expect(html).toContain("--r:700px");
    expect(html).toContain('data-phase="in"');
    expect(html).toContain('data-scene="forge"');
  });

  it("draws the picture as decoration: no alt text, no fact, nothing but the name and the place", () => {
    const html = renderToStaticMarkup(<SceneDive {...base} scene="farm" phase="open" />);
    expect(html).toContain('alt=""');
    expect(html).not.toMatch(/%|fog|clear|weight/i);
  });
});
