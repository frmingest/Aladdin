/**
 * Whether the 3D world is drawn (#479): a tiny store outside React state, so the canvas can report it without the page
 * (a very large component) re-rendering. Written by `sceneLoad.tsx` inside the canvas, read by `LoadingLine.tsx` through
 * `useSyncExternalStore`. Pure TypeScript, no three.js, so the page chunk stays free of it.
 */
import { useSyncExternalStore } from "react";

export interface SceneLoadState {
  /** Everything in the world's Suspense boundary has loaded and is shown. */
  ready: boolean;
  /** The three.js loader has a file in flight. */
  busy: boolean;
}

let state: SceneLoadState = { ready: false, busy: false };
const listeners = new Set<() => void>();

function set(next: SceneLoadState) {
  if (next.ready === state.ready && next.busy === state.busy) return;
  state = next;
  for (const l of listeners) l();
}

export const setSceneReady = (ready: boolean) => set({ ...state, ready });
export const setSceneBusy = (busy: boolean) => set({ ...state, busy });
export const getSceneLoad = (): SceneLoadState => state;

export function subscribeSceneLoad(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const useSceneLoad = (): SceneLoadState => useSyncExternalStore(subscribeSceneLoad, getSceneLoad, getSceneLoad);

/**
 * Show the line? Always while the world is not up. While the loader is busy only until this place has once been fully
 * drawn: after that a late small load (a figure, an ember texture) arrives silently instead of flashing the card.
 */
export function showLoading(s: SceneLoadState, drawnOnce: boolean): boolean {
  return !s.ready || (s.busy && !drawnOnce);
}
