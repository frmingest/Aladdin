import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { GameModeProvider } from "../lib/gameMode";
import ParchmentPanel from "./fortress/kit/ParchmentPanel";
import { LoadError, PageHeader } from "./ui";

/** PageHeader chooses between the painted banner and the plain header. The node test environment has
 * no localStorage, so a tiny stub supplies the two view preferences. */
function stub(game: boolean) {
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (k === "aladdin-game-mode" ? (game ? "on" : "off") : null),
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

function render(path: string, game: boolean) {
  stub(game);
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
    expect(html).not.toContain("Plain view");
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

  it("renders without a Router (as other tests and pages do)", () => {
    stub(true);
    expect(renderToStaticMarkup(<PageHeader title="Room" />)).toContain("Room");
  });
});

describe("ParchmentPanel", () => {
  it("is a parchment folio with the same content", () => {
    stub(true);
    const painted = renderToStaticMarkup(<ParchmentPanel>Same facts</ParchmentPanel>);
    expect(painted).toContain("parchment");
    expect(painted).toContain("Same facts");
  });
});

describe("LoadError", () => {
  it("is an alert with the message and a retry button", () => {
    const html = renderToStaticMarkup(<LoadError message="The server could not load the map." onRetry={() => {}} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("The server could not load the map.");
    expect(html).toContain("Try again");
  });
  it("offers no retry when trying again cannot help, or when there is nothing to call", () => {
    expect(renderToStaticMarkup(<LoadError message="Refused." retryable={false} onRetry={() => {}} />)).not.toContain("Try again");
    expect(renderToStaticMarkup(<LoadError message="Refused." />)).not.toContain("Try again");
  });
});
