import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FRESH_MS, invalidateAll, loadQuery, peek, peekError, setCached } from "./queryCache";

let n = 0;
const key = () => `k${++n}`;

beforeEach(() => {
  vi.useRealTimers();
  invalidateAll({ hard: true });
});

describe("loadQuery", () => {
  it("stores the result and serves it without fetching again while fresh", async () => {
    const k = key();
    const fetcher = vi.fn().mockResolvedValue({ v: 1 });
    await loadQuery(k, fetcher);
    await loadQuery(k, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(peek(k)).toEqual({ v: 1 });
  });

  it("re-fetches once the data is older than freshMs, keeping the old data meanwhile", async () => {
    vi.useFakeTimers();
    const k = key();
    const fetcher = vi.fn().mockResolvedValueOnce("old").mockResolvedValueOnce("new");
    await loadQuery(k, fetcher);
    vi.advanceTimersByTime(DEFAULT_FRESH_MS + 1);
    const pending = loadQuery(k, fetcher);
    expect(peek(k)).toBe("old");
    await pending;
    expect(peek(k)).toBe("new");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("shares one request between concurrent callers", async () => {
    const k = key();
    let resolve!: (v: string) => void;
    const fetcher = vi.fn(() => new Promise<string>((r) => (resolve = r)));
    const a = loadQuery(k, fetcher);
    const b = loadQuery(k, fetcher);
    resolve("x");
    await Promise.all([a, b]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("force fetches even when fresh", async () => {
    const k = key();
    const fetcher = vi.fn().mockResolvedValue(1);
    await loadQuery(k, fetcher);
    await loadQuery(k, fetcher, { force: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("keeps the data on screen when a re-fetch fails, and reports the error", async () => {
    const k = key();
    await loadQuery(k, () => Promise.resolve("kept"));
    await loadQuery(k, () => Promise.reject(new Error("boom")), { force: true, errorText: "Could not load." });
    expect(peek(k)).toBe("kept");
    expect(peekError(k)).toBe("Could not load.");
    await loadQuery(k, () => Promise.resolve("again"), { force: true });
    expect(peekError(k)).toBeNull();
  });

  it("uses the page's fallback text for a network failure but the backend's text for an HTTP error", async () => {
    const a = key();
    const b = key();
    await loadQuery(a, () => Promise.reject(new TypeError("Failed to fetch")), { errorText: "Could not load the board." });
    const http = Object.assign(new Error("holding not found"), { status: 404 });
    await loadQuery(b, () => Promise.reject(http), { errorText: "Could not load the board." });
    expect(peekError(a)).toBe("Could not load the board.");
    expect(peekError(b)).toBe("holding not found");
  });

  it("a failed first load is retried on the next call", async () => {
    const k = key();
    const fetcher = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce("up");
    await loadQuery(k, fetcher);
    expect(peek(k)).toBeUndefined();
    await loadQuery(k, fetcher);
    expect(peek(k)).toBe("up");
  });
});

describe("invalidateAll", () => {
  it("makes cached data stale (kept visible) so the next load fetches", async () => {
    const k = key();
    const fetcher = vi.fn().mockResolvedValueOnce("a").mockResolvedValueOnce("b");
    await loadQuery(k, fetcher);
    invalidateAll();
    expect(peek(k)).toBe("a");
    await loadQuery(k, fetcher);
    expect(peek(k)).toBe("b");
  });

  it("hard invalidation drops the data", async () => {
    const k = key();
    await loadQuery(k, () => Promise.resolve("secret"));
    invalidateAll({ hard: true });
    expect(peek(k)).toBeUndefined();
  });

  it("does not store the result of a request that started before the invalidation", async () => {
    const k = key();
    let resolve!: (v: string) => void;
    const slow = loadQuery(k, () => new Promise<string>((r) => (resolve = r)));
    invalidateAll({ hard: true });
    resolve("from before the write");
    await slow;
    expect(peek(k)).toBeUndefined();
  });
});

describe("setCached", () => {
  it("lets a Refresh response replace the cached value and counts as fresh", async () => {
    const k = key();
    await loadQuery(k, () => Promise.resolve("old"));
    setCached(k, "refreshed");
    const fetcher = vi.fn().mockResolvedValue("should not be needed");
    await loadQuery(k, fetcher);
    expect(peek(k)).toBe("refreshed");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
