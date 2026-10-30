import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import Game3DPage from "./Game3DPage";

describe("Game3DPage without WebGL", () => {
  it("offers the flat fortress instead of a blank canvas", () => {
    // The test environment has no WebGL, same as an old or locked-down browser.
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Game3DPage />
      </MemoryRouter>,
    );
    expect(html).toContain('href="/fortress"');
    expect(html).toContain("can&#x27;t open");
    expect(html).not.toContain("<canvas");
  });
});
