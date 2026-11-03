import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import WhereToPanel from "./WhereToPanel";

const noop = () => {};

describe("WhereToPanel filter by routes", () => {
  it("shows only the named pages of a place", () => {
    const html = renderToStaticMarkup(<WhereToPanel onPick={noop} onClose={noop} only="townhall" onlyRoutes={["/risk", "/margin-of-safety"]} />);
    expect(html).toContain("<strong>Storm</strong>");
    expect(html).toContain("<strong>Cushion</strong>");
    expect(html).not.toContain("The Wide Weather");
    expect(html).not.toContain("The Big Board");
  });

  it("still shows the whole place when no routes are named", () => {
    const html = renderToStaticMarkup(<WhereToPanel onPick={noop} onClose={noop} only="townhall" />);
    expect(html).toContain("<strong>The Wide Weather</strong>");
    expect(html).toContain("<strong>The Big Board</strong>");
  });

  it("uses the world name on the face and keeps the flat app's name in a hover", () => {
    const html = renderToStaticMarkup(<WhereToPanel onPick={noop} onClose={noop} only="townhall" />);
    expect(html).toContain("<strong>Cushion</strong>");
    expect(html).toContain("Plain view name: Margin of safety");
    expect(html).not.toContain("<strong>Margin of safety</strong>");
    expect(html).not.toContain("<strong>Thesis monitor</strong>");
  });
});
