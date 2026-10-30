import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { useThree } from "@react-three/fiber";
import { clampDistance, clampPitch } from "./movement";

export interface OrbitState {
  yaw: number;
  pitch: number;
  distance: number;
}

const LOOK_SPEED = 0.0025;

/**
 * Mouse-look for the follow camera. Click the scene to capture the mouse (Esc
 * lets go); if the browser refuses pointer lock, dragging with the left button
 * looks round instead. The wheel zooms. Returns a ref to read every frame.
 */
export function useOrbit(onLockChange?: (locked: boolean) => void): MutableRefObject<OrbitState> {
  const el = useThree((s) => s.gl.domElement);
  const orbit = useRef<OrbitState>({ yaw: 0, pitch: 0.45, distance: 7 });

  useEffect(() => {
    let dragging = false;

    const look = (dx: number, dy: number) => {
      orbit.current.yaw -= dx * LOOK_SPEED;
      orbit.current.pitch = clampPitch(orbit.current.pitch + dy * LOOK_SPEED);
    };
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement === el || dragging) look(e.movementX, e.movementY);
    };
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
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

    el.addEventListener("mousedown", onDown);
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.addEventListener("pointerlockchange", onLock);
    return () => {
      el.removeEventListener("mousedown", onDown);
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.removeEventListener("pointerlockchange", onLock);
      if (document.pointerLockElement === el) document.exitPointerLock();
    };
  }, [el, onLockChange]);

  return orbit;
}
