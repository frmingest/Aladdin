import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SceneCamera from "./SceneCamera";

describe("SceneCamera", () => {
  it("starts fitted: scene at the container width, Fit disabled, and says the label size in words", () => {
    const html = renderToStaticMarkup(
      <SceneCamera selectedId={null}>
        <p>scene</p>
      </SceneCamera>,
    );
    expect(html).toContain("scene");
    expect(html).toContain('aria-label="Scene camera"');
    expect(html).toContain("100%");
    expect(html).toContain("smallest label");
    expect(html).toContain("press Read labels");
    expect(html).toContain("width:100%;min-width:720px");
    // Fit is disabled at fit, and so is Zoom out.
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Fit<\/button>/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Zoom out"/);
  });

  it("hides the controls from print", () => {
    const html = renderToStaticMarkup(<SceneCamera selectedId={null}>x</SceneCamera>);
    expect(html).toContain("print:hidden");
  });
});
