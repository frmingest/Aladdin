import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { GameModeProvider } from "../lib/gameMode";
import { View3DToggle } from "./Layout";

function toggle(url: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}>
      <GameModeProvider>
        <View3DToggle />
      </GameModeProvider>
    </MemoryRouter>,
  );
}

describe("3D view switch beside the Game mode switch (#443)", () => {
  it("is a labelled switch, off on a flat page", () => {
    const html = toggle("/fortress");
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-label="3D view"');
    expect(html).toContain('aria-checked="false"');
  });

  it("is on in the 3D courtyard, also on a sub-path", () => {
    expect(toggle("/game3d")).toContain('aria-checked="true"');
    expect(toggle("/game3d?x=1")).toContain('aria-checked="true"');
  });
});
