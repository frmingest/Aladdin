import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeCloser } from "./closer";

describe("makeCloser (the document reader's close timer)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("calls the newest callback, even if the parent swapped it while the reader was closing", () => {
    const first = vi.fn();
    const second = vi.fn();
    let current = first;
    const closer = makeCloser();
    closer.start(400, () => current);
    current = second; // a re-render handed in a fresh onClosed
    vi.advanceTimersByTime(400);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("only the first start counts (Escape pressed twice closes once)", () => {
    const cb = vi.fn();
    const closer = makeCloser();
    expect(closer.start(300, () => cb)).toBe(true);
    expect(closer.start(300, () => cb)).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("cancel (the reader being removed) stops a pending close", () => {
    const cb = vi.fn();
    const closer = makeCloser();
    closer.start(300, () => cb);
    closer.cancel();
    vi.advanceTimersByTime(1000);
    expect(cb).not.toHaveBeenCalled();
  });
});
