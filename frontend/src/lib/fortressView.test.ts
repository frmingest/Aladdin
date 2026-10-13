import { describe, expect, it } from "vitest";
import {
  FORTRESS_VIEW_KEY,
  initialFortressView,
  loadFortressView,
  prefersLightView,
  saveFortressView,
} from "./fortressView";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

describe("fortress view preference", () => {
  it("reads back a saved view and ignores junk", () => {
    expect(loadFortressView(memoryStorage({ [FORTRESS_VIEW_KEY]: "plain" }))).toBe("plain");
    expect(loadFortressView(memoryStorage({ [FORTRESS_VIEW_KEY]: "gothic" }))).toBeNull();
    expect(loadFortressView(memoryStorage())).toBeNull();
    expect(loadFortressView(null)).toBeNull();
  });

  it("never throws when storage is blocked", () => {
    const blocked = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(loadFortressView(blocked)).toBeNull();
    expect(() => saveFortressView("plain", blocked)).not.toThrow();
  });

  it("saves the chosen view", () => {
    const s = memoryStorage();
    saveFortressView("ledger", s);
    expect(s.data[FORTRESS_VIEW_KEY]).toBe("ledger");
  });

  it("starts on the scene, on plain for a data-saving browser, and on the saved view first", () => {
    expect(initialFortressView(null, false)).toBe("scene");
    expect(initialFortressView(null, true)).toBe("plain");
    expect(initialFortressView("scene", true)).toBe("scene");
    expect(initialFortressView("ledger", false)).toBe("ledger");
  });

  it("detects Save-Data and prefers-reduced-data", () => {
    expect(prefersLightView({ connection: { saveData: true } }, undefined)).toBe(true);
    expect(prefersLightView({}, () => ({ matches: true }))).toBe(true);
    expect(prefersLightView({}, () => ({ matches: false }))).toBe(false);
    expect(prefersLightView(undefined, undefined)).toBe(false);
    expect(
      prefersLightView({}, () => {
        throw new Error("no matchMedia");
      }),
    ).toBe(false);
  });
});
