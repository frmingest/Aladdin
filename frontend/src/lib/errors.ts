/**
 * One place that turns a failed request into a sentence a person can act on
 * (hardening sprint, 2026-10-13).
 *
 * Why: pages used to show `ApiError.message` as it came. For a proxy error
 * (502/503/504) that was a whole HTML page; for a dead backend it was
 * "Could not load X." with no hint and no way to try again. The rules here are
 * plain: say what happened in words, say whether trying again can help, and
 * never print raw HTML, a stack trace or a long server dump.
 */
import { ApiError } from "./api";
import { readableDetail } from "./errorText";

export { readableDetail };

export interface DescribedError {
  /** One or two sentences for the page. */
  message: string;
  /** True when pressing "Try again" can plausibly help (network, timeout, 5xx, 429). */
  retryable: boolean;
}

/**
 * @param what  The thing that failed to load, e.g. "the Chronicle" (no capital, no full stop).
 */
export function describeError(e: unknown, what: string): DescribedError {
  if (e instanceof ApiError) {
    const detail = readableDetail(e.message);
    switch (true) {
      case e.status === 401 || e.status === 403:
        return {
          message: `The server refused the request for ${what}. If the app is protected by a key, check the key in Settings.`,
          retryable: false,
        };
      case e.status === 404:
        return { message: detail ?? `${capitalise(what)} was not found on the server.`, retryable: false };
      case e.status === 408 || e.status === 504:
        return { message: `The server took too long to answer while loading ${what}. Try again in a moment.`, retryable: true };
      case e.status === 429:
        return { message: `Too many requests just now while loading ${what}. Wait a few seconds and try again.`, retryable: true };
      case e.status >= 500:
        return {
          message: `The server could not load ${what} (error ${e.status}).${detail ? ` ${detail}` : ""} Try again in a moment.`,
          retryable: true,
        };
      default:
        return { message: detail ?? `Could not load ${what} (error ${e.status}).`, retryable: false };
    }
  }
  if (e instanceof DOMException && e.name === "AbortError") {
    return { message: `Loading ${what} was cancelled. Try again.`, retryable: true };
  }
  if (e instanceof TypeError) {
    // fetch() rejects with a TypeError when the server cannot be reached at all.
    return {
      message: `Could not reach the server while loading ${what}. Check your connection, or the server may be restarting.`,
      retryable: true,
    };
  }
  return { message: `Could not load ${what}.`, retryable: true };
}

function capitalise(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}
