import { LatheGeometry, Vector2 } from "three";
import { PAL, Part } from "./Inked";

/** Solid courtyard props from simple shapes, in the colours of the Stitch pictures. Local origin on the ground. */

const basinProfile = [
  [0, 0],
  [2.2, 0],
  [2.2, 0.85],
  [1.9, 0.85],
  [1.9, 0.4],
  [0, 0.4],
].map(([x, y]) => new Vector2(x, y));

export function Fountain() {
  return (
    <group>
      <Part color={PAL.slate} grow={1.025}>
        <primitive object={new LatheGeometry(basinProfile, 28)} attach="geometry" />
      </Part>
      <Part color={PAL.slateDark} position={[0, 1.05, 0]}>
        <cylinderGeometry args={[0.3, 0.42, 1.3, 12]} />
      </Part>
      <Part color={PAL.slate} position={[0, 1.8, 0]}>
        <cylinderGeometry args={[1, 0.55, 0.4, 16]} />
      </Part>
      <Part color={PAL.slateDark} position={[0, 2.03, 0]} ink={false}>
        <cylinderGeometry args={[0.82, 0.82, 0.05, 16]} />
      </Part>
      {[
        [1.1, 0.88, 1.7],
        [-1.6, 0.88, -1.0],
        [0.3, 0.88, -2.0],
      ].map(([x, y, z], i) => (
        <Part key={i} color={PAL.moss} position={[x, y, z]} scale={[1, 0.25, 0.7]} ink={false}>
          <sphereGeometry args={[0.28, 8, 6]} />
        </Part>
      ))}
    </group>
  );
}

export function Lamp() {
  return (
    <group>
      <Part color={PAL.slate} position={[0, 0.17, 0]} grow={1.05}>
        <cylinderGeometry args={[0.45, 0.5, 0.34, 10]} />
      </Part>
      <Part color={PAL.slateDark} position={[0, 0.45, 0]} grow={1.08}>
        <cylinderGeometry args={[0.28, 0.34, 0.25, 10]} />
      </Part>
      <Part color={PAL.iron} position={[0, 1.8, 0]} grow={1.25}>
        <cylinderGeometry args={[0.09, 0.12, 2.7, 8]} />
      </Part>
      <Part color={PAL.iron} position={[0, 3.2, 0]} grow={1.1}>
        <cylinderGeometry args={[0.35, 0.28, 0.1, 6]} />
      </Part>
      {/* Lantern glass stays dark: the glow, if any, is drawn by code. */}
      <Part color={PAL.glass} position={[0, 3.62, 0]} grow={1.08}>
        <cylinderGeometry args={[0.4, 0.34, 0.75, 6]} />
      </Part>
      <Part color={PAL.teal} position={[0, 4.15, 0]} grow={1.08}>
        <cylinderGeometry args={[0.05, 0.62, 0.45, 6]} />
      </Part>
      <Part color={PAL.tealDark} position={[0, 4.45, 0]} grow={1.3}>
        <sphereGeometry args={[0.09, 8, 6]} />
      </Part>
    </group>
  );
}

/** Blank board: no paper, no pins, no text. Faces +z (south, toward the gate). */
export function Board() {
  return (
    <group>
      {[-1.5, 1.5].map((x) => (
        <Part key={x} color={PAL.timber} position={[x, 1.25, 0]} grow={1.12}>
          <boxGeometry args={[0.28, 2.5, 0.28]} />
        </Part>
      ))}
      <Part color={PAL.timberLight} position={[0, 1.95, 0.02]} grow={1.03}>
        <boxGeometry args={[3.4, 1.55, 0.2]} />
      </Part>
      {[-0.4, 0.05, 0.5].map((y) => (
        <Part key={y} color={PAL.timberDark} position={[0, 1.95 + y, 0.13]} ink={false}>
          <boxGeometry args={[3.3, 0.03, 0.02]} />
        </Part>
      ))}
      {[-1.5, 1.5].map((x) => (
        <Part key={x} color={PAL.iron} position={[x, 1.95, 0.14]} grow={1.12}>
          <boxGeometry args={[0.34, 0.2, 0.06]} />
        </Part>
      ))}
      {/* Gable roof, ridge running left to right. */}
      {[1, -1].map((s) => (
        <Part key={s} color={PAL.teal} position={[0, 3.0, s * 0.5]} rotation={[s * 0.62, 0, 0]} grow={1.04}>
          <boxGeometry args={[3.9, 0.14, 1.3]} />
        </Part>
      ))}
      <Part color={PAL.tealDark} position={[0, 3.3, 0]} grow={1.1}>
        <boxGeometry args={[3.9, 0.12, 0.12]} />
      </Part>
    </group>
  );
}

export function Perch() {
  return (
    <group>
      <Part color={PAL.slateDark} position={[0, 0.15, 0]} grow={1.05}>
        <cylinderGeometry args={[0.65, 0.7, 0.3, 9]} />
      </Part>
      <Part color={PAL.timber} position={[0, 1.65, 0]} grow={1.1}>
        <cylinderGeometry args={[0.17, 0.2, 3, 8]} />
      </Part>
      <Part color={PAL.teal} position={[0, 3.2, 0]} grow={1.12}>
        <coneGeometry args={[0.28, 0.35, 4]} />
      </Part>
      {/* Cross-arm with a rope wrap, a lower branch, a brace and a feed cup. */}
      <Part color={PAL.timberLight} position={[0.55, 2.6, 0]} rotation={[0, 0, Math.PI / 2]} grow={1.12}>
        <cylinderGeometry args={[0.12, 0.14, 1.6, 8]} />
      </Part>
      <Part color={PAL.cream} position={[0.85, 2.6, 0]} rotation={[0, 0, Math.PI / 2]} grow={1.08}>
        <cylinderGeometry args={[0.16, 0.16, 0.45, 8]} />
      </Part>
      <Part color={PAL.timberLight} position={[-0.45, 1.2, 0.1]} rotation={[0, 0, Math.PI / 2]} grow={1.12}>
        <cylinderGeometry args={[0.1, 0.12, 1.1, 8]} />
      </Part>
      <Part color={PAL.timber} position={[0.4, 2.1, 0]} rotation={[0, 0, -0.75]} grow={1.15}>
        <cylinderGeometry args={[0.07, 0.07, 1.0, 6]} />
      </Part>
      <Part color={PAL.tealDark} position={[-0.3, 2.0, 0.2]} grow={1.1}>
        <cylinderGeometry args={[0.18, 0.12, 0.16, 8]} />
      </Part>
    </group>
  );
}
