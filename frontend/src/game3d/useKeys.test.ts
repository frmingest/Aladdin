import { describe, expect, it } from "vitest";
import { typingInField } from "./useKeys";

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
