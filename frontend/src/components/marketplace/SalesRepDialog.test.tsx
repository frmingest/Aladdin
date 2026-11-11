import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import SalesRepDialog from "./SalesRepDialog";

function render(voice: "flat" | "game", demoMode = false) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <SalesRepDialog voice={voice} demoMode={demoMode} rows={[]} onClose={() => {}} onAdded={() => {}} />
    </MemoryRouter>,
  );
}

describe("SalesRepDialog first paint", () => {
  it("opens on the shelves (wide), not on the typed form, while the catalogue loads", () => {
    const html = render("flat");
    expect(html).toContain("Stocking the shelves");
    expect(html).toContain("max-w-4xl");
    expect(html).not.toContain("Ticker (Yahoo Finance symbol)");
  });

  it("is the same dialog in /game3d (game voice) and on the flat Marketplace", () => {
    const flat = render("flat");
    const game = render("game");
    for (const html of [flat, game]) {
      expect(html).toContain("Stocking the shelves");
      expect(html).toContain("Sal&#x27;s booth");
    }
    expect(flat).toContain("fetches filings");
    expect(game).toContain("fetches reports");
  });

  it("says why in demo mode", () => {
    expect(render("game", true)).toContain("Demo mode is on");
  });
});
