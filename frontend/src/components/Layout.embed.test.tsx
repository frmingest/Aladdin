import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DemoModeProvider } from "../lib/demoMode";
import { GameModeProvider } from "../lib/gameMode";
import Layout from "./Layout";

function page(url: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}>
      <DemoModeProvider>
        <GameModeProvider>
          <Layout>
            <p>the page</p>
          </Layout>
        </GameModeProvider>
      </DemoModeProvider>
    </MemoryRouter>,
  );
}

describe("Layout embed flag (the 3D world panel)", () => {
  it("shows only the page when loaded with ?embed=world", () => {
    const h = page("/holdings?embed=world");
    expect(h).toContain("the page");
    expect(h).not.toContain("<nav");
    expect(h).not.toContain("Skip to content");
  });
});
