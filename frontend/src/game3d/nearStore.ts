/**
 * Where "what am I near" is kept (#411). The scene's one watcher writes here; the page and the pieces of the world
 * that light up when you stand at them (a board, a shelf, a doormat) read from here. That is why the scene no longer
 * takes one callback per object and the page no longer keeps one switch per object.
 *
 * One world on screen at a time, so one store. No three.js.
 */
import { useSyncExternalStore } from "react";
import { NO_NEARS } from "./near";
import type { Nears, SpotKey } from "./near";

let state: Nears = NO_NEARS;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export const nearStore = {
  get: (): Nears => state,
  /** Writes the fields that changed. */
  patch(changes: Partial<Nears>): void {
    state = { ...state, ...changes };
    emit();
  },
  /** Nothing is near: on arriving in a new place, and when the world goes away. */
  reset(): void {
    if (state === NO_NEARS) return;
    state = NO_NEARS;
    emit();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/** Everything that is near, for the page. */
export function useNears(): Nears {
  return useSyncExternalStore(nearStore.subscribe, nearStore.get, nearStore.get);
}

/** One spot's answer, for the piece of the world that lights up when you stand at it. */
export function useNear<K extends SpotKey>(key: K): Nears[K] {
  const read = () => state[key];
  return useSyncExternalStore(nearStore.subscribe, read, read);
}
