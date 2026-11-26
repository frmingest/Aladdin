/**
 * How the 3D world steps its physics (#486). A fixed step with interpolation instead of the frame time: on a slow frame
 * (a phone, a hidden tab, software WebGL) one long step used to carry a running hero several metres and integrate a big
 * jump of gravity in one go. Now the world always moves in 1/60 s steps, and @react-three/rapier draws each body
 * between its last two steps, so motion stays smooth on any display rate.
 *
 * Rapier catches up with as many steps as the frame took (it only clamps a frame at 0.5 s, 30 steps), which on a slow
 * device makes the next frame slower still. So the frame time every `useFrame` sees is capped at MAX_SUBSTEPS steps: a
 * device that cannot keep up slows the world down instead of spiralling.
 */
export const PHYSICS_STEP = 1 / 60;
/** At most this many physics steps per drawn frame. */
export const MAX_SUBSTEPS = 3;
/** The longest frame time the world is told about (seconds). */
export const MAX_FRAME_DT = PHYSICS_STEP * MAX_SUBSTEPS;

/** The part of THREE.Clock the cap needs. */
export interface DeltaClock {
  getDelta(): number;
}

/**
 * Cap what `clock.getDelta()` returns (react-three-fiber reads the frame time from it once per frame and hands that to
 * every `useFrame`, the physics stepper included). The clock's own elapsed time still follows real time. Returns the
 * undo.
 */
export function capClockDelta(clock: DeltaClock, max: number = MAX_FRAME_DT): () => void {
  const original = clock.getDelta;
  clock.getDelta = function capped(this: DeltaClock) {
    return Math.min(original.call(this), max);
  };
  return () => {
    clock.getDelta = original;
  };
}

/** How many fixed steps a frame of `dt` seconds runs, given what is left over from the frames before. Mirrors rapier. */
export function stepsFor(dt: number, carried: number, step: number = PHYSICS_STEP): { steps: number; carried: number } {
  let acc = carried + Math.min(Math.max(dt, 0), 0.5);
  let steps = 0;
  while (acc >= step) {
    acc -= step;
    steps += 1;
  }
  return { steps, carried: acc };
}
