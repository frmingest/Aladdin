import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { GameModeProvider } from "../../lib/gameMode";
import NightWatchCard from "./NightWatchCard";

describe("NightWatchCard while the dispatch loads", () => {
  it("holds its place (no layout shift for the scene below) instead of rendering nothing", () => {
    const html = renderToStaticMarkup(
      <GameModeProvider>
        <MemoryRouter>
          <NightWatchCard />
        </MemoryRouter>
      </GameModeProvider>,
    );
    expect(html).toContain("Night Watch");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("min-h-[6.5rem]");
  });
});
