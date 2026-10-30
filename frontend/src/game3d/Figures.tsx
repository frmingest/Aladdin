import { PAL, Part } from "./Inked";

/**
 * Solid figures from simple shapes, in the colours of the Stitch pictures. Faceless, as
 * the pictures are. Local origin on the ground, front toward +z. A real rigged model can replace
 * any of these later without touching the rest of the scene.
 */

const COAT = "#4a4a52";
const ROBE = "#2c2a42";

export function HeroFigure() {
  return (
    <group>
      {[-0.14, 0.14].map((x) => (
        <group key={x}>
          <Part color={PAL.timber} position={[x, 0.15, 0.03]} grow={1.12}>
            <cylinderGeometry args={[0.12, 0.13, 0.32, 8]} />
          </Part>
          <Part color={PAL.cream} position={[x, 0.5, 0]} grow={1.1}>
            <cylinderGeometry args={[0.12, 0.13, 0.4, 8]} />
          </Part>
        </group>
      ))}
      {/* Teal cloak all round, with the cream tunic showing at the front. */}
      <Part color={PAL.teal} position={[0, 0.88, 0]} grow={1.05}>
        <cylinderGeometry args={[0.3, 0.5, 0.95, 12]} />
      </Part>
      <Part color={PAL.cream} position={[0, 0.88, 0.4]} ink={false}>
        <boxGeometry args={[0.26, 0.85, 0.04]} />
      </Part>
      <Part color={PAL.timber} position={[0, 0.8, 0.43]} grow={1.12}>
        <boxGeometry args={[0.32, 0.07, 0.06]} />
      </Part>
      <Part color={PAL.timber} position={[0.4, 0.72, 0.08]} grow={1.12}>
        <boxGeometry args={[0.2, 0.24, 0.13]} />
      </Part>
      <Part color={PAL.teal} position={[0, 1.33, 0]} scale={[1, 0.55, 1]} grow={1.06}>
        <sphereGeometry args={[0.38, 12, 8]} />
      </Part>
      {/* Hood with a dark, empty face and a cream trim. */}
      <Part color={PAL.teal} position={[0, 1.5, -0.02]} grow={1.05}>
        <sphereGeometry args={[0.34, 12, 10]} />
      </Part>
      <Part color={PAL.void} position={[0, 1.48, 0.2]} scale={[1, 1.1, 0.6]} ink={false}>
        <sphereGeometry args={[0.22, 10, 8]} />
      </Part>
      <Part color={PAL.cream} position={[0, 1.48, 0.27]} ink={false}>
        <torusGeometry args={[0.24, 0.035, 6, 16]} />
      </Part>
      {[-1, 1].map((s) => (
        <group key={s}>
          <Part color={PAL.teal} position={[s * 0.35, 0.98, 0.04]} rotation={[0, 0, s * 0.28]} grow={1.1}>
            <cylinderGeometry args={[0.07, 0.08, 0.5, 8]} />
          </Part>
          <Part color={PAL.timber} position={[s * 0.43, 0.7, 0.06]} grow={1.15}>
            <sphereGeometry args={[0.09, 8, 6]} />
          </Part>
        </group>
      ))}
    </group>
  );
}

export function OracleFigure() {
  return (
    <group>
      <Part color={ROBE} position={[0, 0.725, 0]} grow={1.04}>
        <cylinderGeometry args={[0.3, 0.62, 1.45, 14]} />
      </Part>
      <Part color={PAL.cream} position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]} ink={false}>
        <torusGeometry args={[0.62, 0.045, 6, 20]} />
      </Part>
      <Part color={PAL.cream} position={[0, 0.72, 0.47]} ink={false}>
        <boxGeometry args={[0.12, 1.3, 0.03]} />
      </Part>
      <Part color={PAL.teal} position={[0, 1.02, 0]} rotation={[Math.PI / 2, 0, 0]} grow={1.12}>
        <torusGeometry args={[0.4, 0.065, 6, 18]} />
      </Part>
      <Part color={PAL.teal} position={[-0.1, 0.72, 0.43]} grow={1.12}>
        <boxGeometry args={[0.1, 0.5, 0.04]} />
      </Part>
      <Part color={ROBE} position={[0, 1.42, 0]} scale={[1.1, 0.55, 0.9]} grow={1.05}>
        <sphereGeometry args={[0.34, 12, 8]} />
      </Part>
      <Part color={ROBE} position={[0, 1.62, -0.02]} grow={1.06}>
        <sphereGeometry args={[0.31, 12, 10]} />
      </Part>
      <Part color={PAL.skin} position={[0, 1.6, 0.18]} scale={[1, 1.15, 0.6]} ink={false}>
        <sphereGeometry args={[0.19, 10, 8]} />
      </Part>
      <Part color={PAL.cream} position={[0, 1.6, 0.25]} ink={false}>
        <torusGeometry args={[0.2, 0.03, 6, 16]} />
      </Part>
      {[-1, 1].map((s) => (
        <Part key={s} color={ROBE} position={[s * 0.26, 1.2, 0.2]} rotation={[-1.0, 0, s * 0.3]} grow={1.1}>
          <cylinderGeometry args={[0.1, 0.11, 0.5, 8]} />
        </Part>
      ))}
      <Part color={PAL.skin} position={[0, 1.04, 0.45]} grow={1.15}>
        <sphereGeometry args={[0.1, 8, 6]} />
      </Part>
      <Part color={PAL.timber} position={[0.52, 0.85, 0.05]} rotation={[0, 0, -0.1]} grow={1.1}>
        <boxGeometry args={[0.2, 0.28, 0.12]} />
      </Part>
    </group>
  );
}

export function PartnerFigure() {
  return (
    <group>
      {[-0.15, 0.15].map((x) => (
        <group key={x}>
          <Part color="#1f1e26" position={[x, 0.15, 0.04]} grow={1.12}>
            <cylinderGeometry args={[0.12, 0.13, 0.32, 8]} />
          </Part>
          <Part color="#2a2a33" position={[x, 0.6, 0]} grow={1.1}>
            <cylinderGeometry args={[0.12, 0.13, 0.6, 8]} />
          </Part>
        </group>
      ))}
      <Part color={COAT} position={[0, 1.0, 0]} grow={1.05}>
        <cylinderGeometry args={[0.3, 0.44, 0.95, 12]} />
      </Part>
      <Part color={COAT} position={[0, 1.46, 0]} scale={[1.1, 0.5, 0.8]} grow={1.06}>
        <sphereGeometry args={[0.3, 12, 8]} />
      </Part>
      <Part color={PAL.cream} position={[0, 1.58, 0]} rotation={[Math.PI / 2, 0, 0]} grow={1.1}>
        <torusGeometry args={[0.2, 0.07, 6, 14]} />
      </Part>
      <Part color={PAL.cream} position={[0, 1.2, 0.34]} grow={1.1}>
        <boxGeometry args={[0.1, 0.5, 0.05]} />
      </Part>
      <Part color={PAL.skin} position={[0, 1.74, 0.02]} grow={1.06}>
        <sphereGeometry args={[0.2, 10, 8]} />
      </Part>
      <Part color="#2b2b33" position={[0, 1.87, 0]} scale={[1, 0.55, 1]} grow={1.06}>
        <sphereGeometry args={[0.23, 10, 8]} />
      </Part>
      <Part color="#2b2b33" position={[0, 1.79, 0.2]} ink={false}>
        <boxGeometry args={[0.26, 0.03, 0.14]} />
      </Part>
      <Part color={PAL.teal} position={[0, 1.83, 0]} rotation={[Math.PI / 2, 0, 0]} ink={false}>
        <torusGeometry args={[0.225, 0.02, 6, 16]} />
      </Part>
      {[-1, 1].map((s) => (
        <Part key={s} color={COAT} position={[s * 0.38, 1.05, 0.04]} rotation={[-0.15, 0, s * 0.14]} grow={1.1}>
          <cylinderGeometry args={[0.08, 0.09, 0.75, 8]} />
        </Part>
      ))}
    </group>
  );
}
