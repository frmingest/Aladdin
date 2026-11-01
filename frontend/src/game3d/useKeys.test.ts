import { describe, expect, it } from "vitest";
import { NO_KEYS } from "./movement";
import { applyKey, typingInField } from "./useKeys";

const el = (tagName: string, isContentEditable = false) => ({ tagName, isContentEditable }) as unknown as EventTarget;

describe("typingInField", () => {
  it("is true for text fields, selects and editable content, so hotkeys (P, Q, T, E) stand down", () => {
    for (const tag of ["INPUT", "TEXTAREA", "SELECT"]) expect(typingInField(el(tag))).toBe(true);
    expect(typingInField(el("DIV", true))).toBe(true);
  });
  it("is false for the page, buttons and nothing", () => {
    expect(typingInField(el("BODY"))).toBe(false);
    expect(typingInField(el("BUTTON"))).toBe(false);
    expect(typingInField(null)).toBe(false);
  });
});

describe("applyKey (no stuck keys)", () => {
  it("lets a key go even when the release happens in a text field", () => {
    const keys = { ...NO_KEYS };
    expect(applyKey(keys, { code: "KeyA" }, true, false)).toBe(true);
    expect(keys.left).toBe(true);
    applyKey(keys, { code: "KeyA" }, false, true); // released while a search box has focus
    expect(keys.left).toBe(false);
  });
  it("does not start walking from typing or from a shortcut", () => {
    const keys = { ...NO_KEYS };
    expect(applyKey(keys, { code: "KeyD" }, true, true)).toBe(false);
    expect(applyKey(keys, { code: "KeyD", ctrlKey: true }, true, false)).toBe(false);
    expect(applyKey(keys, { code: "KeyD", altKey: true }, true, false)).toBe(false);
    expect(applyKey(keys, { code: "KeyD", metaKey: true }, true, false)).toBe(false);
    expect(keys.right).toBe(false);
  });
  it("ignores keys that are not movement", () => {
    expect(applyKey({ ...NO_KEYS }, { code: "KeyE" }, true, false)).toBe(false);
  });
});
