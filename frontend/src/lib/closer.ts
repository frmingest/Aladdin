/**
 * A close timer that cannot be cancelled by a re-render (used by the document reader).
 *
 * The reader closes in two steps: it plays a short exit animation, then tells its parent. The parent often hands in a
 * brand-new `onClosed` on every render (the 3D world re-renders constantly), and a timer that was cleared whenever that
 * callback changed would never fire, leaving the reader stuck half-closed on screen. So: the callback is read when the
 * timer fires (`getCallback`), only the first `start` counts, and only `cancel` (leaving the page) stops it.
 */
export interface Closer {
  /** Starts the timer. Returns false, and does nothing, if it already started. */
  start(ms: number, getCallback: () => () => void): boolean;
  /** Stops a pending close (the reader is being removed). */
  cancel(): void;
  readonly started: boolean;
}

export function makeCloser(
  schedule: (fn: () => void, ms: number) => unknown = (fn, ms) => setTimeout(fn, ms),
  unschedule: (handle: unknown) => void = (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
): Closer {
  let handle: unknown;
  let started = false;
  return {
    start(ms, getCallback) {
      if (started) return false;
      started = true;
      handle = schedule(() => getCallback()(), ms);
      return true;
    },
    cancel() {
      if (handle !== undefined) unschedule(handle);
      handle = undefined;
    },
    get started() {
      return started;
    },
  };
}
