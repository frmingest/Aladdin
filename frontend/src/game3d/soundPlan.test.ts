import { describe, expect, it } from "vitest";
import { AREAS, type AreaId } from "./areas";
import { KEY_ACTIONS } from "./movement";
import { PANEL_KEYS } from "./hudPanels";
import { SOUND_KEY, ambienceLevel, soundLabel } from "./soundPlan";

const ids = Object.keys(AREAS) as AreaId[];

describe("3D sound plan", () => {
  it("follows the siege level out in the open", () => {
    const outdoor = ids.filter((id) => AREAS[id].kind === "outdoor");
    expect(outdoor.length).toBeGreaterThan(0);
    for (const id of outdoor) {
      expect(ambienceLevel(id, "besieged")).toBe("besieged");
      expect(ambienceLevel(id, "calm")).toBe("calm");
    }
  });

  it("shuts the weather out indoors: every room gets the quiet bed", () => {
    const indoor = ids.filter((id) => AREAS[id].kind === "indoor");
    expect(indoor.length).toBeGreaterThan(0);
    for (const id of indoor) expect(ambienceLevel(id, "besieged")).toBeNull();
  });

  it("never turns unknown weather into a storm", () => {
    expect(ambienceLevel("courtyard", null)).toBeNull();
    expect(ambienceLevel("courtyard", undefined)).toBeNull();
  });

  it("uses a key that clashes with nothing", () => {
    expect(KEY_ACTIONS[SOUND_KEY]).toBeUndefined();
    expect(PANEL_KEYS[SOUND_KEY]).toBeUndefined();
    expect(["KeyE", "KeyP", "F3", "KeyB", "KeyG"]).not.toContain(SOUND_KEY);
  });

  it("says plainly whether it is on", () => {
    expect(soundLabel(false).label).toBe("Sound off");
    expect(soundLabel(true).label).toBe("Sound on");
    expect(soundLabel(false).icon).not.toBe(soundLabel(true).icon);
  });
});
