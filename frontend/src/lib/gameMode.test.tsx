import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameModeProvider, useGameMode } from "./gameMode";

function Probe() {
  return <span>{useGameMode().gameMode ? "game-on" : "game-off"}</span>;
}

function withStorage(value: string | null | "throw") {
  vi.stubGlobal("localStorage", {
    getItem: () => {
      if (value === "throw") throw new Error("blocked");
      return value;
    },
    setItem: () => {},
  });
}

describe("game mode default", () => {
  afterEach(() => vi.unstubAllGlobals());

  const html = () =>
    renderToStaticMarkup(
      <GameModeProvider>
        <Probe />
      </GameModeProvider>,
    );

  it("starts on for a browser that never chose", () => {
    withStorage(null);
    expect(html()).toContain("game-on");
  });

  it("starts on when storage is blocked", () => {
    withStorage("throw");
    expect(html()).toContain("game-on");
  });

  it("remembers an explicit off", () => {
    withStorage("off");
    expect(html()).toContain("game-off");
  });
});
