import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { GameModeProvider } from "../lib/gameMode";
import ParchmentPanel from "./fortress/kit/ParchmentPanel";
import { PageHeader } from "./ui";

/** PageHeader chooses between the painted banner and the plain header. The node test environment has
 * no localStorage, so a tiny stub supplies the two view preferences. */
function stub(game: boolean, plain: boolean) {
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (k === "aladdin-game-mode" ? (game ? "on" : "off") : k === "aladdin-plain-view" ? (plain ? "on" : "off") : null),
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  };
}
afterEach(() => {
  delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
});

function render(path: string, game: boolean, plain = false) {
  stub(game, plain);
  return renderToStaticMarkup(
    <GameModeProvider>
      <MemoryRouter initialEntries={[path]}>
        <PageHeader title="Room" subtitle="Sub" actions={<a href="/x">Act</a>} />
      </MemoryRouter>
    </GameModeProvider>,
  );
}

describe("PageHeader", () => {
  it("is the painted banner in game mode on a fortress room", () => {
    const html = render("/fortress/council", true);
    expect(html).toContain("game-banner");
    expect(html).toContain("Plain view");
    expect(html).toContain("Act");
  });

  it("stays plain on the Fortress home and the Marketplace, which have their own scene", () => {
    expect(render("/fortress", true)).not.toContain("game-banner");
    expect(render("/fortress/marketplace", true)).not.toContain("game-banner");
    expect(render("/fortress/marketplace/abc", true)).not.toContain("game-banner");
  });

  it("stays plain outside the fortress and with game mode off", () => {
    expect(render("/holdings", true)).not.toContain("game-banner");
    expect(render("/fortress/council", false)).not.toContain("game-banner");
  });

  it("Plain view brings the plain header back and always offers the way back", () => {
    const html = render("/fortress/council", true, true);
    expect(html).not.toContain("game-banner");
    expect(html).toContain("Room");
    expect(html).toContain("Back to the painted view");
  });

  it("renders without a Router (as other tests and pages do)", () => {
    stub(true, false);
    expect(renderToStaticMarkup(<PageHeader title="Room" />)).toContain("Room");
  });
});

describe("ParchmentPanel", () => {
  it("is a parchment folio normally and an ordinary card in Plain view, with the same content", () => {
    stub(true, false);
    const painted = renderToStaticMarkup(<ParchmentPanel>Same facts</ParchmentPanel>);
    expect(painted).toContain("parchment");
    stub(true, true);
    const plain = renderToStaticMarkup(<ParchmentPanel>Same facts</ParchmentPanel>);
    expect(plain).not.toContain("parchment");
    expect(plain).toContain("ui-card");
    expect(plain).toContain("Same facts");
  });
});
