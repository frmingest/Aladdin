import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RavenMark from "./RavenMark";

describe("RavenMark", () => {
  it("keeps its position and its bob animation on different elements", () => {
    // A CSS animation that sets `transform` replaces a transform attribute on
    // the same element, which threw the raven to the corner of the scene.
    const html = renderToStaticMarkup(
      <svg>
        <RavenMark x={120} y={48} />
      </svg>,
    );
    const placed = html.indexOf('transform="translate(120 48)"');
    const bobbing = html.indexOf('class="fortress-raven"');
    expect(placed).toBeGreaterThan(-1);
    expect(bobbing).toBeGreaterThan(placed);
    // The animated group carries no transform attribute of its own.
    const bobTag = html.slice(
      html.lastIndexOf("<g", bobbing),
      html.indexOf(">", bobbing),
    );
    expect(bobTag).not.toContain("transform=");
  });
});
