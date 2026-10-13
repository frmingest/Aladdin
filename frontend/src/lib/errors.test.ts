import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { describeError, readableDetail } from "./errors";

describe("readableDetail", () => {
  it("passes a short plain sentence through", () => {
    expect(readableDetail("Holding not found")).toBe("Holding not found");
  });
  it("drops HTML pages, stack traces, empty text and the generic status line", () => {
    expect(readableDetail("<html><body><h1>502 Bad Gateway</h1></body></html>")).toBeNull();
    expect(readableDetail("<!DOCTYPE html><title>x</title>")).toBeNull();
    expect(readableDetail("Traceback (most recent call last):\n  File")).toBeNull();
    expect(readableDetail("   ")).toBeNull();
    expect(readableDetail("request failed with status 500")).toBeNull();
  });
  it("drops long dumps", () => {
    expect(readableDetail("x".repeat(201))).toBeNull();
  });
});

describe("describeError", () => {
  it("never prints a proxy error page", () => {
    const d = describeError(new ApiError(502, "<html><body>Bad Gateway</body></html>"), "the Chronicle");
    expect(d.message).toContain("the Chronicle");
    expect(d.message).not.toContain("<");
    expect(d.retryable).toBe(true);
  });
  it("treats a network failure as retryable and says the server cannot be reached", () => {
    const d = describeError(new TypeError("Failed to fetch"), "the Council");
    expect(d.message).toMatch(/could not reach the server/i);
    expect(d.retryable).toBe(true);
  });
  it("explains 401 and 403 without offering a retry", () => {
    for (const status of [401, 403]) {
      const d = describeError(new ApiError(status, { detail: "Forbidden" }), "the records");
      expect(d.message).toMatch(/refused/i);
      expect(d.retryable).toBe(false);
    }
  });
  it("429 and 504 are retryable with their own words", () => {
    expect(describeError(new ApiError(429, "slow down"), "the map").message).toMatch(/too many requests/i);
    expect(describeError(new ApiError(504, ""), "the map").message).toMatch(/too long/i);
    expect(describeError(new ApiError(429, ""), "the map").retryable).toBe(true);
  });
  it("keeps a short, readable 5xx detail", () => {
    const d = describeError(new ApiError(500, { detail: "Database is restarting" }), "the street");
    expect(d.message).toContain("Database is restarting");
    expect(d.message).toContain("500");
  });
  it("4xx with a readable detail shows it; without one it states the code", () => {
    expect(describeError(new ApiError(422, { detail: "market_drop must be between 0 and 100" }), "the siege").message).toBe(
      "market_drop must be between 0 and 100",
    );
    expect(describeError(new ApiError(422, ""), "the siege").message).toMatch(/error 422/);
  });
  it("404 falls back to a sentence", () => {
    expect(describeError(new ApiError(404, ""), "the holding").message).toBe("The holding was not found on the server.");
  });
  it("unknown values still give a retryable sentence", () => {
    expect(describeError("boom", "the fortress")).toEqual({ message: "Could not load the fortress.", retryable: true });
  });
});
