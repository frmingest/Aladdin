/**
 * Which place you are in, and the step between two places (S21, S22). A pure reducer; the page holds it with one
 * useReducer and a few timers.
 *
 * A move walks four phases: `fadingOut` (the screen darkens, you stay where you are) → `loading` (you are in the new
 * place, the screen is dark, the floor is made) → `fadingIn` (the screen clears, the name plate shows) → `idle`.
 * While the phase is not `idle` nothing else can start a move, so two quick presses never stack. With reduced motion
 * a move is a cut: `instant` skips every phase.
 */
import { AREAS, parentOf, sameArea } from "./areas";
import type { AreaRef } from "./areas";

export type AreaPhase = "idle" | "fadingOut" | "loading" | "fadingIn";

export interface AreaState {
  current: AreaRef;
  /** The place you just came from (null at the start). */
  from: AreaRef | null;
  phase: AreaPhase;
  /** Where the fade is taking you; only set while `fadingOut`. */
  next: AreaRef | null;
  /** True after a move that failed to load and sent you back; cleared by the next move. */
  failed: boolean;
}

export type AreaAction =
  | { type: "enter"; ref: AreaRef; instant?: boolean }
  | { type: "leave"; instant?: boolean }
  | { type: "fadeDone" }
  | { type: "ready" }
  | { type: "fail" };

export const INITIAL_AREA: AreaState = { current: { id: "courtyard" }, from: null, phase: "idle", next: null, failed: false };

function begin(state: AreaState, target: AreaRef, instant: boolean): AreaState {
  // One move at a time. A cut (reduced motion, or putting you back after a lost tower) always goes through.
  if (state.phase !== "idle" && !instant) return state;
  if (instant) return { current: target, from: state.current, phase: "idle", next: null, failed: false };
  return { ...state, phase: "fadingOut", next: target, failed: false };
}

export function areaReducer(state: AreaState, action: AreaAction): AreaState {
  switch (action.type) {
    case "enter": {
      if (sameArea(state.current, action.ref)) return state;
      // A library without a holding is not a place; fall back to the courtyard.
      const ref = action.ref.id === "library" && !action.ref.holdingId ? INITIAL_AREA.current : action.ref;
      if (!(ref.id in AREAS)) return state;
      if (sameArea(state.current, ref)) return state;
      return begin(state, ref, action.instant === true);
    }
    case "leave": {
      const parent = parentOf(state.current);
      if (!parent) return state;
      return begin(state, parent, action.instant === true);
    }
    case "fadeDone":
      if (state.phase === "fadingOut" && state.next) return { ...state, current: state.next, from: state.current, phase: "loading", next: null };
      if (state.phase === "fadingIn") return { ...state, phase: "idle" };
      return state;
    case "ready":
      return state.phase === "loading" ? { ...state, phase: "fadingIn" } : state;
    case "fail":
      // The new place never appeared: go back to where you were.
      if (state.phase !== "loading") return state;
      return { current: state.from ?? INITIAL_AREA.current, from: state.current, phase: "fadingIn", next: null, failed: true };
  }
}

/** Where the hero must not move or press E: any time a move is under way. */
export const isMoving = (s: AreaState): boolean => s.phase !== "idle";
