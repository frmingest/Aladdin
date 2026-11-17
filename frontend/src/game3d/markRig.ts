/**
 * The marks as three.js objects (Morning Round step 2, #412), built with no React so a test can count them.
 *
 * One instanced mesh per kind: ravens, smoke sprites, bell bodies, bell posts. So 1 marked holding or 18 cost the same
 * four draw calls. No light object anywhere: the marks are lit by the scene's own flat light, and the lamp glows by a bright
 * material. No collider. One `update` is the whole frame loop; the component calls it from its single `useFrame`.
 *
 * Reduced motion: the raven hangs still above the roof, the smoke is a frozen column, the bell hangs plumb, the lamp holds a
 * steady glow. Every mark still stands, so no fact is lost, shape alone says the kind (no colour is needed).
 */
import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Material,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Euler,
  SphereGeometry,
} from "three";
import type { Texture } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { normalised } from "./staticBatchLogic";
import { BRONZE_COLOUR, FLAME_COLOUR, FROZEN_T, THIN_SMOKE, fxSide, fxStateInto, jitter } from "./fxPlan";
import type { FxState } from "./fxPlan";
import type { PlacedMarks } from "./marks";
import { PAL } from "./Inked";

export const MARKS_GROUP = "marks";

interface Piece {
  geo: BufferGeometry;
  at: [number, number, number];
  rot?: [number, number, number];
}

function merge(name: string, pieces: Piece[]): BufferGeometry {
  const baked = pieces.map((p) => {
    const g = p.geo.clone();
    const m = new Matrix4().makeRotationFromEuler(new Object3D().rotation.set(...(p.rot ?? [0, 0, 0])));
    m.setPosition(...p.at);
    g.applyMatrix4(m);
    p.geo.dispose();
    return g;
  });
  // The same normalisation the static batch uses: same attributes, same indexing, then join.
  const out = mergeGeometries(normalised(baked), false);
  baked.forEach((g) => g.dispose());
  if (!out) throw new Error(`markRig: the ${name} geometry could not be merged`);
  return out;
}

/** A dark bird, wings out, seen from any side: body, head, beak, tail and two wings in a flat V. */
export function birdGeometry(): BufferGeometry {
  return merge("raven", [
    { geo: new SphereGeometry(0.22, 5, 3).scale(1, 0.8, 1.6), at: [0, 0, 0] },
    { geo: new SphereGeometry(0.13, 5, 3), at: [0, 0.1, 0.34] },
    { geo: new ConeGeometry(0.05, 0.18, 4).rotateX(Math.PI / 2), at: [0, 0.09, 0.5] },
    { geo: new BoxGeometry(0.2, 0.03, 0.3), at: [0, 0, -0.4] },
    { geo: new BoxGeometry(0.9, 0.03, 0.34), at: [0.5, 0.06, 0], rot: [0, 0, 0.25] },
    { geo: new BoxGeometry(0.9, 0.03, 0.34), at: [-0.5, 0.06, 0], rot: [0, 0, -0.25] },
  ]);
}

/** Where the bell hangs from, in the post's own frame: the end of the short arm. */
export const BELL_PIVOT: readonly [number, number, number] = [0.6, 1.85, 0];

/** A short timber post with an arm. Taller than a hand bell, so it reads from the gate. */
export function postGeometry(): BufferGeometry {
  return merge("bell post", [
    { geo: new BoxGeometry(0.18, 2.0, 0.18), at: [0, 1.0, 0] },
    { geo: new BoxGeometry(0.75, 0.1, 0.1), at: [0.3, 1.95, 0] },
  ]);
}

/** The bell: an open cone with a clapper, its pivot at the origin so it swings from the arm. */
export function bellGeometry(): BufferGeometry {
  return merge("bell", [
    { geo: new ConeGeometry(0.34, 0.5, 6), at: [0, -0.3, 0] },
    { geo: new BoxGeometry(0.1, 0.1, 0.1), at: [0, -0.62, 0] },
  ]);
}

/** A hanging lamp: lit glass, and an iron cap with a short chain. */
export function lampGlassGeometry(): BufferGeometry {
  return new BoxGeometry(0.3, 0.42, 0.3);
}
export function lampCapGeometry(): BufferGeometry {
  return merge("lamp cap", [
    { geo: new BoxGeometry(0.4, 0.08, 0.4), at: [0, 0.25, 0] },
    { geo: new BoxGeometry(0.04, 0.5, 0.04), at: [0, 0.54, 0] },
  ]);
}

/** Bigger than life so they read at yard distance. The raven body is mid slate, not near-black: it reads against a dark tower and a pale sky. */
const RAVEN_SCALE = 1.8;
const BELL_SCALE = 1.4;
const RAVEN_SPEED = 0.3;
const BELL_SWING = 0.32;
const BELL_RATE = 1.5;

function mesh(geo: BufferGeometry, material: Material, count: number): InstancedMesh {
  const m = new InstancedMesh(geo, material, count);
  // Instances spread over the whole yard; a bounding sphere from the first copy would cull them wrongly.
  m.frustumCulled = false;
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}

const tmp = new Object3D();
const mat = new Matrix4();
const pivot = new Matrix4();
const swing = new Matrix4();
const fx: FxState = { age: 0, x: 0, y: 0, z: 0, size: 0, alpha: 0 };
const eul = new Euler();

/** The camera's turn about the vertical axis, in radians (pitch and roll left out): what a vertical billboard follows. */
export function yawOfQuaternion(q: { x: number; y: number; z: number; w: number }): number {
  return eul.setFromQuaternion(q as never, "YXZ").y;
}

/** Everything the yard shows for the marks. `map` is the soft smoke sprite (null: the column is left out, the rest stands). */
export class MarkRig {
  readonly group = new Group();
  private ravens: InstancedMesh | null = null;
  private smoke: InstancedMesh | null = null;
  private bells: InstancedMesh | null = null;
  private posts: InstancedMesh | null = null;
  private owned: { dispose(): void }[] = [];
  /** Worked out once: each raven's starting angle, each bell's swing phase, each smoke sprite's sideways wander. */
  private ravenPhase: Float32Array;
  private bellPhase: Float32Array;
  private sides: Float32Array;
  private postMats: Matrix4[] = [];

  constructor(private placed: PlacedMarks, map: Texture | null) {
    this.group.userData = { perfGroup: MARKS_GROUP };
    const own = <T extends { dispose(): void }>(x: T): T => (this.owned.push(x), x);
    const { ravens, smoke, bells } = placed;
    this.ravenPhase = Float32Array.from(ravens, (_, i) => jitter(i, 3) * Math.PI * 2);
    this.bellPhase = Float32Array.from(bells, (_, i) => jitter(i, 5) * 6);
    this.sides = new Float32Array(THIN_SMOKE.count * 2);
    for (let k = 0; k < THIN_SMOKE.count; k++) [this.sides[2 * k], this.sides[2 * k + 1]] = fxSide(k);
    if (ravens.length > 0) {
      this.ravens = mesh(own(birdGeometry()), own(new MeshStandardMaterial({ color: PAL.slateDark, flatShading: true })), ravens.length);
      this.group.add(this.ravens);
    }
    if (smoke.length > 0 && map) {
      const mt = own(new MeshBasicMaterial({ map, color: PAL.slateDark, transparent: true, opacity: THIN_SMOKE.alpha, depthWrite: false, toneMapped: false, side: DoubleSide }));
      this.smoke = mesh(own(new PlaneGeometry(1, 1)), mt, smoke.length * THIN_SMOKE.count);
      this.group.add(this.smoke);
    }
    if (bells.length > 0) {
      this.bells = mesh(own(bellGeometry()), own(new MeshStandardMaterial({ color: BRONZE_COLOUR, flatShading: true })), bells.length);
      this.posts = mesh(own(postGeometry()), own(new MeshStandardMaterial({ color: PAL.timberDark, flatShading: true })), bells.length);
      this.group.add(this.posts, this.bells);
      // The posts never move: posed once here, not per frame.
      bells.forEach((b, i) => {
        tmp.position.set(b.x, 0, b.z);
        tmp.rotation.set(0, b.yaw, 0);
        tmp.scale.setScalar(BELL_SCALE);
        tmp.updateMatrix();
        this.postMats.push(tmp.matrix.clone());
        this.posts!.setMatrixAt(i, tmp.matrix);
      });
      this.posts.instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * Every mark at time `t`. With `reduced` the poses are fixed (the same for any `t`). `camYaw` (radians, from
   * `yawOfQuaternion`) turns the smoke sprites to face you about the vertical axis only, so a column stays upright. No
   * allocation per call.
   */
  update(t: number, reduced: boolean, camYaw = 0): void {
    const { ravens, smoke, bells } = this.placed;
    const clock = reduced ? 0 : t;
    if (this.ravens) {
      for (let i = 0; i < ravens.length; i++) {
        const r = ravens[i];
        const a = this.ravenPhase[i] + clock * RAVEN_SPEED;
        tmp.scale.setScalar(RAVEN_SCALE);
        tmp.position.set(r.x + Math.cos(a) * r.r, r.y + (reduced ? 0 : Math.sin(clock * 0.9 + i) * 0.12), r.z + Math.sin(a) * r.r);
        tmp.rotation.set(0, Math.atan2(-Math.sin(a), Math.cos(a)), reduced ? 0 : Math.sin(clock * 1.1 + i) * 0.08);
        tmp.updateMatrix();
        this.ravens.setMatrixAt(i, tmp.matrix);
      }
      this.ravens.instanceMatrix.needsUpdate = true;
    }
    if (this.smoke) {
      const ts = reduced ? FROZEN_T : t;
      for (let h = 0; h < smoke.length; h++) {
        const s = smoke[h];
        for (let k = 0; k < THIN_SMOKE.count; k++) {
          fxStateInto(fx, THIN_SMOKE, k, ts, this.sides[2 * k], this.sides[2 * k + 1]);
          tmp.position.set(s.x + fx.x, s.y + fx.y, s.z + fx.z);
          tmp.rotation.set(0, camYaw, 0);
          // Opacity is carried by size: a faded sprite shrinks, so one shared material serves every column.
          tmp.scale.setScalar(Math.max(0.0001, fx.size * (0.4 + 0.6 * (THIN_SMOKE.alpha ? fx.alpha / THIN_SMOKE.alpha : 0))));
          tmp.updateMatrix();
          this.smoke.setMatrixAt(h * THIN_SMOKE.count + k, tmp.matrix);
        }
      }
      this.smoke.instanceMatrix.needsUpdate = true;
    }
    if (this.bells) {
      pivot.makeTranslation(BELL_PIVOT[0], BELL_PIVOT[1], BELL_PIVOT[2]);
      for (let i = 0; i < bells.length; i++) {
        swing.makeRotationZ(reduced ? 0 : Math.sin(clock * BELL_RATE + this.bellPhase[i]) * BELL_SWING);
        mat.copy(this.postMats[i]).multiply(pivot).multiply(swing);
        this.bells.setMatrixAt(i, mat);
      }
      this.bells.instanceMatrix.needsUpdate = true;
    }
  }

  /** The poses of the ravens now (for tests and nothing else). */
  ravenPositions(): [number, number, number][] {
    if (!this.ravens) return [];
    return this.placed.ravens.map((_, i) => {
      this.ravens!.getMatrixAt(i, mat);
      return [mat.elements[12], mat.elements[13], mat.elements[14]];
    });
  }

  dispose(): void {
    this.owned.forEach((o) => o.dispose());
    [this.ravens, this.smoke, this.bells, this.posts].forEach((m) => m?.dispose());
  }
}

/** One lit lamp, hung at a point of the parent's frame. */
export interface LampAt {
  x: number;
  y: number;
  z: number;
}

/** Hanging lamps (lit stalls, the arch): two instanced meshes, a bright material and no light. Steady when `reduced`. */
export class LampRig {
  readonly group = new Group();
  private glass: InstancedMesh;
  private cap: InstancedMesh;
  private owned: { dispose(): void }[] = [];

  constructor(private lamps: readonly LampAt[], perfGroup?: string) {
    if (perfGroup) this.group.userData = { perfGroup };
    const g = lampGlassGeometry();
    const c = lampCapGeometry();
    const gm = new MeshBasicMaterial({ color: FLAME_COLOUR, toneMapped: false });
    const cm = new MeshStandardMaterial({ color: PAL.iron, flatShading: true });
    this.owned.push(g, c, gm, cm);
    this.glass = mesh(g, gm, lamps.length);
    this.cap = mesh(c, cm, lamps.length);
    this.group.add(this.cap, this.glass);
    this.update(0, true);
  }

  update(t: number, reduced: boolean): void {
    this.lamps.forEach((l, i) => {
      tmp.position.set(l.x, l.y, l.z);
      tmp.rotation.set(0, 0, 0);
      tmp.quaternion.identity();
      tmp.scale.setScalar(1);
      tmp.updateMatrix();
      this.cap.setMatrixAt(i, tmp.matrix);
      // A slow flicker is a size breath of the glass, never a colour change.
      tmp.scale.set(1, reduced ? 1 : 1 + 0.07 * Math.sin(t * 2.3 + i * 1.7), 1);
      tmp.updateMatrix();
      this.glass.setMatrixAt(i, tmp.matrix);
    });
    this.glass.instanceMatrix.needsUpdate = true;
    this.cap.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.owned.forEach((o) => o.dispose());
    this.glass.dispose();
    this.cap.dispose();
  }
}
