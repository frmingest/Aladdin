/**
 * Which place you are in (S21). A pure reducer; the page holds it with one useReducer instead of four flags.
 *
 * `phase` stays "idle" for now. S22 adds the fade, and will use `ready` and `fadeDone` to walk it through
 * fadingOut, loading and fadingIn. The actions exist already so the page is wired once.
 */
import { AREAS, parentOf, sameArea } from "./areas";
import type { AreaRef } from "./areas";

export type AreaPhase = "idle" | "fadingOut" | "loading" | "fadingIn";

export interface AreaState {
  current: AreaRef;
  /** The place you just came from (null at the start). */
  from: AreaRef | null;
  phase: AreaPhase;
}

export type AreaAction = { type: "enter"; ref: AreaRef } | { type: "leave" } | { type: "ready" } | { type: "fadeDone" };

export const INITIAL_AREA: AreaState = { current: { id: "courtyard" }, from: null, phase: "idle" };

export function areaReducer(state: AreaState, action: AreaAction): AreaState {
  switch (action.type) {
    case "enter": {
      if (sameArea(state.current, action.ref)) return state;
      // A library without a holding is not a place; fall back to the courtyard.
      const ref = action.ref.id === "library" && !action.ref.holdingId ? INITIAL_AREA.current : action.ref;
      if (!(ref.id in AREAS)) return state;
      if (sameArea(state.current, ref)) return state;
      return { current: ref, from: state.current, phase: "idle" };
    }
    case "leave": {
      const parent = parentOf(state.current);
      if (!parent) return state;
      return { current: parent, from: state.current, phase: "idle" };
    }
    case "ready":
    case "fadeDone":
      // Nothing to wait for yet: S22 moves the phase here.
      return state;
  }
}
