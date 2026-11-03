import { describe, expect, it } from "vitest";
import { LAYER_ORDER, canGoBack, escapeTarget, topLayer } from "./layers";

describe("layers", () => {
  it("nothing open: Esc closes nothing and B goes back", () => {
    expect(topLayer({})).toBeNull();
    expect(escapeTarget({})).toBeNull();
    expect(canGoBack({})).toBe(true);
  });

  it("closes the layer on top first", () => {
    expect(escapeTarget({ desk: true, books: true })).toBe("books");
    expect(escapeTarget({ where: true, worldPage: true })).toBe("worldPage");
    expect(escapeTarget({ where: true })).toBe("where");
    expect(escapeTarget({ vault: true, talking: true })).toBe("talking");
  });

  it("leaves a self-closing layer to its own Esc handler", () => {
    expect(escapeTarget({ report: true, shelf: true })).toBeNull();
    expect(escapeTarget({ lamp: true, desk: true })).toBeNull();
    expect(escapeTarget({ booth: true })).toBeNull();
  });

  it("B waits while anything is open", () => {
    for (const id of LAYER_ORDER) expect(canGoBack({ [id]: true })).toBe(false);
  });
});
