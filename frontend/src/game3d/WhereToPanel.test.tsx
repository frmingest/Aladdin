import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import WhereToPanel from "./WhereToPanel";

const noop = () => {};

describe("WhereToPanel filter by routes", () => {
  it("shows only the named pages of a place", () => {
    const html = renderToStaticMarkup(<WhereToPanel onPick={noop} onClose={noop} only="townhall" onlyRoutes={["/risk", "/margin-of-safety"]} />);
    expect(html).toContain("Risk");
    expect(html).toContain("Margin of safety");
    expect(html).not.toContain("Macro");
    expect(html).not.toContain("Dashboard");
  });

  it("still shows the whole place when no routes are named", () => {
    const html = renderToStaticMarkup(<WhereToPanel onPick={noop} onClose={noop} only="townhall" />);
    expect(html).toContain("Macro");
    expect(html).toContain("Dashboard");
  });
});
