import { afterEach, describe, expect, it, vi } from "vitest";
import { NO_NEARS } from "./near";
import { nearStore } from "./nearStore";

afterEach(() => nearStore.reset());

describe("nearStore: where 'what am I near' is kept", () => {
  it("starts with nothing near", () => {
    expect(nearStore.get()).toEqual(NO_NEARS);
  });
  it("writes only the fields that changed and tells whoever listens", () => {
    const heard = vi.fn();
    const stop = nearStore.subscribe(heard);
    nearStore.patch({ desk: true });
    expect(nearStore.get()).toEqual({ ...NO_NEARS, desk: true });
    nearStore.patch({ npc: "oracle" });
    expect(nearStore.get()).toEqual({ ...NO_NEARS, desk: true, npc: "oracle" });
    expect(heard).toHaveBeenCalledTimes(2);
    stop();
    nearStore.patch({ desk: false });
    expect(heard).toHaveBeenCalledTimes(2);
  });
  it("forgets everything on a new place, and stays quiet when there was nothing to forget", () => {
    const heard = vi.fn();
    const stop = nearStore.subscribe(heard);
    nearStore.reset();
    expect(heard).not.toHaveBeenCalled();
    nearStore.patch({ vault: true });
    nearStore.reset();
    expect(nearStore.get()).toBe(NO_NEARS);
    expect(heard).toHaveBeenCalledTimes(2);
    stop();
  });
});
