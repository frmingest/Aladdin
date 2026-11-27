import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { useThree } from "@react-three/fiber";
import { clampDistance, clampPitch } from "./movement";
import { pinchZoom } from "./touchInput";

export interface OrbitState {
  yaw: number;
  pitch: number;
  distance: number;
}

const LOOK_SPEED = 0.0025;
/** A finger covers fewer pixels than a mouse for the same turn, so touch looks a little faster. */
const TOUCH_LOOK_SPEED = 0.005;
/** After a touch, the browser sends a made-up mouse click; it must not ask for pointer lock (there is no mouse to lock). */
const TOUCH_MOUSE_GRACE_MS = 800;

/**
 * Mouse-look for the follow camera. Click the scene to capture the mouse (Esc
 * lets go); if the browser refuses pointer lock, dragging with the left button
 * looks round instead. The wheel zooms. Returns a ref to read every frame.
 *
 * On a touch screen (#485): one finger dragged on the open scene looks round, two fingers pinch to zoom. The stick, the
 * seal and the toolbar sit over the scene, so their touches never reach it. The scene stops the browser's own pinch-zoom
 * and scroll (`touch-action: none`).
 */
export function useOrbit(onLockChange?: (locked: boolean) => void): MutableRefObject<OrbitState> {
  const el = useThree((s) => s.gl.domElement);
  const orbit = useRef<OrbitState>({ yaw: 0, pitch: 0.45, distance: 7 });

  useEffect(() => {
    let dragging = false;
    let lastTouch = -Infinity;
    /** Fingers on the scene, by pointer id, with where each was last seen. */
    const fingers = new Map<number, { x: number; y: number }>();
    let pinchGap: number | null = null;

    const look = (dx: number, dy: number, speed = LOOK_SPEED) => {
      orbit.current.yaw -= dx * speed;
      orbit.current.pitch = clampPitch(orbit.current.pitch + dy * speed);
    };
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement === el || dragging) look(e.movementX, e.movementY);
    };
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (performance.now() - lastTouch < TOUCH_MOUSE_GRACE_MS) return;
      dragging = true;
      // Best effort: some browsers refuse (or throw) when the page is not focused.
      try {
        const result = el.requestPointerLock() as unknown;
        if (result instanceof Promise) result.catch(() => {});
      } catch {
        /* drag-to-look still works */
      }
    };
    const onUp = () => {
      dragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      orbit.current.distance = clampDistance(orbit.current.distance + Math.sign(e.deltaY) * 0.8);
    };
    const onLock = () => onLockChange?.(document.pointerLockElement === el);

    const gap = () => {
      const [a, b] = [...fingers.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : null;
    };
    const onTouchDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      lastTouch = performance.now();
      fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      pinchGap = fingers.size === 2 ? gap() : null;
    };
    const onTouchMove = (e: PointerEvent) => {
      const was = fingers.get(e.pointerId);
      if (e.pointerType !== "touch" || !was) return;
      lastTouch = performance.now();
      fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (fingers.size === 1) {
        look(e.clientX - was.x, e.clientY - was.y, TOUCH_LOOK_SPEED);
      } else if (fingers.size === 2 && pinchGap !== null) {
        const now = gap();
        if (now !== null) {
          orbit.current.distance = clampDistance(pinchZoom(orbit.current.distance, pinchGap, now));
          pinchGap = now;
        }
      }
    };
    const onTouchUp = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      lastTouch = performance.now();
      fingers.delete(e.pointerId);
      // One finger left after a pinch: it looks from where it is now, with no jump.
      pinchGap = fingers.size === 2 ? gap() : null;
    };

    // A lost touch end must not leave a ghost finger (the next one-finger drag would count as a pinch and not look).
    const forgetFingers = () => {
      fingers.clear();
      pinchGap = null;
    };
    const onHidden = () => {
      if (document.hidden) forgetFingers();
    };

    const touchAction = el.style.touchAction;
    el.style.touchAction = "none";
    el.addEventListener("mousedown", onDown);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onTouchDown);
    el.addEventListener("pointermove", onTouchMove);
    el.addEventListener("pointerup", onTouchUp);
    el.addEventListener("pointercancel", onTouchUp);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("blur", forgetFingers);
    document.addEventListener("visibilitychange", onHidden);
    document.addEventListener("pointerlockchange", onLock);
    return () => {
      window.removeEventListener("blur", forgetFingers);
      document.removeEventListener("visibilitychange", onHidden);
      el.style.touchAction = touchAction;
      el.removeEventListener("mousedown", onDown);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onTouchDown);
      el.removeEventListener("pointermove", onTouchMove);
      el.removeEventListener("pointerup", onTouchUp);
      el.removeEventListener("pointercancel", onTouchUp);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.removeEventListener("pointerlockchange", onLock);
      if (document.pointerLockElement === el) document.exitPointerLock();
    };
  }, [el, onLockChange]);

  return orbit;
}
