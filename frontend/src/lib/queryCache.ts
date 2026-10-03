/**
 * A small stale-while-revalidate cache for GET data (Sprint 20, 2026-10-03).
 *
 * Why: leaving a page and coming back used to show "Loading…" and wait for
 * the backend again, even though the backend answers from a stored snapshot.
 * Now the last result is shown at once and re-checked in the background.
 *
 * Rules (kept deliberately plain):
 * - Data younger than `freshMs` (default 15 s) is not re-fetched at all
 *   (rapid back/forward navigation); older data is shown immediately and
 *   re-fetched in the background.
 * - One request per key at a time (concurrent mounts share it).
 * - Any write (POST/PUT/PATCH/DELETE) marks every cached value out of date
 *   (`invalidateAll`, called by lib/api.ts): pages that are open re-fetch at
 *   once, others on their next visit, so nothing outlives a change.
 * - A failed re-fetch keeps the data already shown and reports the error.
 * - Memory only: nothing is persisted, a reload starts empty.
 *
 * No new dependency on purpose: this app needs the five lines of behaviour
 * above, not a query library, and the production dependency audit stays clean.
 */
import { useCallback, useEffect, useReducer, useRef } from "react";

export const DEFAULT_FRESH_MS = 15_000;

interface Entry {
  data?: unknown;
  hasData: boolean;
  error: string | null;
  fetchedAt: number;
  promise: Promise<void> | null;
  /** The last fetcher and options used, so an open page can be re-fetched. */
  fetcher?: () => Promise<unknown>;
  opts?: LoadOptions;
}

const store = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();
let generation = 0;

function notify(key: string): void {
  listeners.get(key)?.forEach((cb) => cb());
}

function entryFor(key: string): Entry {
  let entry = store.get(key);
  if (!entry) {
    entry = { hasData: false, error: null, fetchedAt: 0, promise: null };
    store.set(key, entry);
  }
  return entry;
}

export function peek<T>(key: string): T | undefined {
  const entry = store.get(key);
  return entry?.hasData ? (entry.data as T) : undefined;
}

export function peekError(key: string): string | null {
  return store.get(key)?.error ?? null;
}

/** Put a value in the cache (e.g. the result of a Refresh POST). */
export function setCached<T>(key: string, data: T): void {
  const entry = entryFor(key);
  entry.data = data;
  entry.hasData = true;
  entry.error = null;
  entry.fetchedAt = Date.now();
  notify(key);
}

/**
 * Mark everything out of date and re-fetch what is on screen. Requests in
 * flight finish but are not stored. `hard` also throws the data away first
 * (used when the data set itself changes, e.g. switching demo mode, so real
 * numbers are never shown in demo mode even for a moment).
 */
export function invalidateAll(opts: { hard?: boolean } = {}): void {
  generation += 1;
  for (const [key, entry] of [...store.entries()]) {
    entry.promise = null;
    entry.fetchedAt = 0;
    if (opts.hard) {
      entry.data = undefined;
      entry.hasData = false;
      entry.error = null;
    }
    const mounted = (listeners.get(key)?.size ?? 0) > 0;
    if (mounted && entry.fetcher) {
      void loadQuery(key, entry.fetcher, { ...entry.opts, force: true });
    } else {
      notify(key);
      if (!mounted && opts.hard) store.delete(key);
    }
  }
}

export interface LoadOptions {
  freshMs?: number;
  errorText?: string;
  /** Fetch even when the cached value is still fresh. */
  force?: boolean;
  /** Turns a thrown value into the message to show. */
  describeError?: (e: unknown, fallback: string) => string;
}

function describe(e: unknown, fallback: string, custom?: LoadOptions["describeError"]): string {
  if (custom) return custom(e, fallback);
  // The backend's own message (an HTTP error carries a numeric `status`);
  // a network failure gets the page's plain fallback text instead of the
  // browser's "Failed to fetch".
  const hasStatus = typeof (e as { status?: unknown } | null)?.status === "number";
  return hasStatus && e instanceof Error && e.message ? e.message : fallback;
}

/** Load `key` through the cache. Resolves when the (possibly shared) request ends. */
export function loadQuery<T>(key: string, fetcher: () => Promise<T>, opts: LoadOptions = {}): Promise<void> {
  const freshMs = opts.freshMs ?? DEFAULT_FRESH_MS;
  const entry = entryFor(key);
  if (entry.promise) return entry.promise;
  if (!opts.force && entry.hasData && Date.now() - entry.fetchedAt < freshMs) return Promise.resolve();

  entry.fetcher = fetcher;
  entry.opts = { ...opts, force: undefined };
  const startedIn = generation;
  const promise = fetcher().then(
    (data) => {
      if (startedIn !== generation) return;
      const current = entryFor(key);
      current.data = data;
      current.hasData = true;
      current.error = null;
      current.fetchedAt = Date.now();
      current.promise = null;
      notify(key);
    },
    (e) => {
      if (startedIn !== generation) return;
      const current = entryFor(key);
      current.error = describe(e, opts.errorText ?? "Could not load.", opts.describeError);
      current.promise = null;
      notify(key);
    },
  );
  entry.promise = promise;
  notify(key);
  return promise;
}

export interface CachedQuery<T> {
  data: T | null;
  error: string | null;
  /** No data to show yet (first load, or after a failed first load). */
  loading: boolean;
  /** Showing cached data while a newer copy is being fetched. */
  revalidating: boolean;
  reload: () => void;
  /** Replace the cached value (e.g. with a Refresh response). */
  mutate: (data: T) => void;
}

export function useCachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts: Omit<LoadOptions, "force"> = {},
): CachedQuery<T> {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const fetcherRef = useRef(fetcher);
  const optsRef = useRef(opts);
  fetcherRef.current = fetcher;
  optsRef.current = opts;

  useEffect(() => {
    let set = listeners.get(key);
    if (!set) {
      set = new Set();
      listeners.set(key, set);
    }
    const cb = () => rerender();
    set.add(cb);
    void loadQuery(key, () => fetcherRef.current(), optsRef.current);
    return () => {
      set?.delete(cb);
    };
  }, [key]);

  const reload = useCallback(() => {
    void loadQuery(key, () => fetcherRef.current(), { ...optsRef.current, force: true });
  }, [key]);
  const mutate = useCallback((data: T) => setCached(key, data), [key]);

  const entry = store.get(key);
  const hasData = entry?.hasData ?? false;
  return {
    data: hasData ? (entry?.data as T) : null,
    error: entry?.error ?? null,
    loading: !hasData && !entry?.error,
    revalidating: hasData && entry?.promise != null,
    reload,
    mutate,
  };
}
