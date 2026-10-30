/**
 * Pure movement and camera maths for the 3D courtyard (game3d prototype, week 1).
 * No three.js, no React: everything here is plain numbers so it can be unit-tested.
 *
 * Conventions: x is east, z is south (towards the viewer at yaw 0), y is up.
 * `yaw` is the camera's orbit angle round the player: at yaw 0 the camera sits
 * south of the player looking north (-z).
 */

export interface Keys {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  run: boolean;
  jump: boolean;
}

export const NO_KEYS: Keys = {
  forward: false,
  back: false,
  left: false,
  right: false,
  run: false,
  jump: false,
};

export const WALK_SPEED = 4.5;
export const RUN_SPEED = 8;
export const JUMP_SPEED = 8.5;

/** Negative pitch tilts the view up (the camera stays above ground; only its aim lifts). */
export const MIN_PITCH = -1.4;
export const MAX_PITCH = 1.25;
/** Lowest the camera body itself goes, as an orbit angle above the player's focus. */
export const MIN_CAMERA_PITCH = 0.05;
export const MIN_DISTANCE = 3;
export const MAX_DISTANCE = 11;

export interface Vec2 {
  x: number;
  z: number;
}

/** World-space move direction (length 0 to 1) for the held keys and camera yaw. */
export function moveVector(keys: Keys, yaw: number): Vec2 {
  const fwd = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0);
  const side = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  if (fwd === 0 && side === 0) return { x: 0, z: 0 };
  // Looking direction (camera to player) and the player's right-hand side.
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  let x = fx * fwd + rx * side;
  let z = fz * fwd + rz * side;
  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  return { x, z };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampPitch(pitch: number): number {
  return clamp(pitch, MIN_PITCH, MAX_PITCH);
}

export function clampDistance(distance: number): number {
  return clamp(distance, MIN_DISTANCE, MAX_DISTANCE);
}

/** Camera offset from the player's focus point for the given orbit angles. */
export function cameraOffset(yaw: number, pitch: number, distance: number): [number, number, number] {
  const p = Math.max(pitch, MIN_CAMERA_PITCH);
  const horizontal = Math.cos(p) * distance;
  return [Math.sin(yaw) * horizontal, Math.sin(p) * distance, Math.cos(yaw) * horizontal];
}

/**
 * How far above the player's focus point the camera aims. Zero while the
 * camera looks down at the player; once the mouse pulls past level it rises,
 * so you can look straight up a tower from its foot.
 */
export function lookUpHeight(pitch: number, distance: number): number {
  if (pitch >= MIN_CAMERA_PITCH) return 0;
  const up = MIN_CAMERA_PITCH - pitch; // radians above the camera's own level view
  return Math.tan(up) * Math.cos(MIN_CAMERA_PITCH) * distance + Math.sin(MIN_CAMERA_PITCH) * distance;
}

/** Angle (about y) that turns a model facing +z towards the given direction. */
export function facingYaw(dir: Vec2): number {
  return Math.atan2(dir.x, dir.z);
}

/** Shortest signed turn from `from` to `to`, in radians (-PI to PI). */
export function shortestAngle(from: number, to: number): number {
  const twoPi = Math.PI * 2;
  let d = (to - from) % twoPi;
  if (d > Math.PI) d -= twoPi;
  if (d < -Math.PI) d += twoPi;
  return d;
}

/** Key code to the action it drives. Arrow keys mirror WASD. */
export const KEY_ACTIONS: Record<string, keyof Keys> = {
  KeyW: "forward",
  ArrowUp: "forward",
  KeyS: "back",
  ArrowDown: "back",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  ShiftLeft: "run",
  ShiftRight: "run",
  Space: "jump",
};
