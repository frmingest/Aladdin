import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { CylinderCollider, RigidBody } from "@react-three/rapier";
import { CanvasTexture, Object3D, SRGBColorSpace, type InstancedMesh } from "three";
import type { Flag, TowerView } from "./stateToWorld";
import { INK, PAL, Part } from "./Inked";
import { doorYaw } from "./towerDoor";
import { signWords } from "./signText";

/** Pad top, so towers stand on it. */
const PAD_TOP = 0.5;
const MAX_CRENELS = 8;
const FOG_COLOR = "#dfe5ea";
const FLAG_COLOR: Record<Exclude<Flag, "none">, string> = {
  intact: "#4f8a4f",
  review: "#d6a53a",
  breached: "#b04a3f",
};
const IVY_COLOR = "#5d7f45";
const WATER_COLOR = "#4f7a95";
const CRACK_COLOR = "#1f1b19";

const dummy = new Object3D();

/** Teeth around the crown. Teeth missing from one side read as a broken crown. */
function Crown({ t }: { t: TowerView }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    for (let i = 0; i < MAX_CRENELS; i++) {
      const a = (i / MAX_CRENELS) * Math.PI * 2;
      dummy.position.set(Math.sin(a) * t.radius, PAD_TOP + t.height + 0.3, Math.cos(a) * t.radius);
      dummy.rotation.set(0, a, 0);
      dummy.scale.setScalar(i < t.crenels ? 1 : 0); // scale 0 hides the missing teeth
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [t.crenels, t.radius, t.height]);
  if (t.crenels === 0) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, MAX_CRENELS]} castShadow>
      <boxGeometry args={[0.8, 0.6, 0.8]} />
      <meshStandardMaterial color={t.wallColor} flatShading />
    </instancedMesh>
  );
}

/** Dark cracks down the wall: more cracks, weaker wall. */
function Cracks({ t }: { t: TowerView }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    for (let i = 0; i < t.cracks; i++) {
      const a = 0.6 + i * 1.4;
      dummy.position.set(Math.sin(a) * (t.radius + 0.02), PAD_TOP + t.height * (0.35 + 0.12 * i), Math.cos(a) * (t.radius + 0.02));
      dummy.rotation.set(0, a, (i % 2 ? 1 : -1) * 0.25);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [t.cracks, t.radius, t.height]);
  if (t.cracks === 0) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, t.cracks]}>
      <boxGeometry args={[0.18, t.height * 0.4, 0.08]} />
      <meshStandardMaterial color={CRACK_COLOR} flatShading />
    </instancedMesh>
  );
}

/**
 * The door to the tower's library: a small timber door with a lamp, on the side that faces the middle of the
 * courtyard. Every tower has one, so it carries no fact (a weak tower is not harder to enter). Press E near it.
 */
function LibraryDoor({ t }: { t: TowerView }) {
  const yaw = doorYaw(t.spot);
  const out = t.radius + 0.2;
  return (
    <group position={[Math.sin(yaw) * out, PAD_TOP, Math.cos(yaw) * out]} rotation={[0, yaw, 0]}>
      <Part color={PAL.timber} position={[0, 0.85, 0]} grow={1.08}>
        <boxGeometry args={[1, 1.7, 0.24]} />
      </Part>
      <Part color={PAL.timberDark} position={[0, 1.78, 0]} grow={1.1}>
        <boxGeometry args={[1.3, 0.2, 0.3]} />
      </Part>
      <mesh position={[0, 2.2, 0.1]}>
        <sphereGeometry args={[0.14, 8, 6]} />
        <meshBasicMaterial color="#f2d27a" />
      </mesh>
      <NameSign t={t} />
    </group>
  );
}


/** Signboard size in world units, and the canvas it is painted on (2:1 plank). */
const SIGN_W = 5.6;
const SIGN_H = 2.0;
const SIGN_PX_W = 704;
const SIGN_PX_H = 256;

/** Paint the name (and the "not surveyed" note) on a canvas. Dark ink on cream, so it reads against any sky. */
function paintSign(name: string, fog: boolean, gap: string | undefined): HTMLCanvasElement {
  const { lines, note } = signWords(name, fog, gap);
  const c = document.createElement("canvas");
  c.width = SIGN_PX_W;
  c.height = SIGN_PX_H;
  const g = c.getContext("2d");
  if (!g) return c;
  g.fillStyle = PAL.cream;
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = PAL.timberDark;
  g.lineWidth = 10;
  g.strokeRect(5, 5, c.width - 10, c.height - 10);
  g.fillStyle = INK;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const noteH = note ? 44 : 0;
  const area = c.height - 28 - noteH;
  const size = lines.length > 1 ? Math.min(92, area / 2.1) : Math.min(124, area * 0.8);
  g.font = `700 ${size}px "Segoe UI", system-ui, sans-serif`;
  lines.forEach((l, i) => {
    const y = 14 + (area * (i + 0.5)) / lines.length;
    // Shrink a line that is still too wide for the plank.
    let f = size;
    while (g.measureText(l).width > c.width - 56 && f > 30) {
      f -= 4;
      g.font = `700 ${f}px "Segoe UI", system-ui, sans-serif`;
    }
    g.fillText(l, c.width / 2, y);
    g.font = `700 ${size}px "Segoe UI", system-ui, sans-serif`;
  });
  if (note) {
    g.fillStyle = PAL.slateDark;
    g.font = `italic 600 34px "Segoe UI", system-ui, sans-serif`;
    g.fillText(note, c.width / 2, c.height - 30, c.width - 56);
  }
  return c;
}

/**
 * The tower's name on a timber signboard hung above its door, facing the middle of the courtyard.
 * Name only: the facts stay in the panel. Fog towers say "not surveyed" in small type, as before.
 */
function NameSign({ t }: { t: TowerView }) {
  const tex = useMemo(() => {
    const x = new CanvasTexture(paintSign(t.name, t.fog, t.gap ?? undefined));
    x.colorSpace = SRGBColorSpace;
    x.anisotropy = 8;
    return x;
  }, [t.name, t.fog, t.gap]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <group position={[0, 4.3, 0.35]}>
      {/* Two short posts to the wall, then the plank and the painted face. */}
      {[-2.1, 2.1].map((x) => (
        <Part key={x} color={PAL.iron} position={[x, -1.5, -0.15]} grow={1.2}>
          <boxGeometry args={[0.14, 1.3, 0.14]} />
        </Part>
      ))}
      <Part color={PAL.timber} grow={1.03}>
        <boxGeometry args={[SIGN_W + 0.3, SIGN_H + 0.3, 0.14]} />
      </Part>
      <mesh position={[0, 0, 0.081]}>
        <planeGeometry args={[SIGN_W, SIGN_H]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** One holding as a tower. Everything here comes from the TowerView, nothing else. */
export default function TowerMesh({ t }: { t: TowerView }) {
  const bodyColor = t.fog ? FOG_COLOR : t.wallColor;
  const sides = t.shape === "keep" ? 14 : t.shape === "outpost" ? 4 : 8;
  const ivy = t.freshness === "weathered" ? 0.25 : t.freshness === "overgrown" ? 0.55 : 0;
  const flag = t.flag === "none" || t.fog ? null : t.flag;
  return (
    <group position={[t.spot.x, 0, t.spot.z]}>
      {/* Moat: water ring when surveyed, pale mist when not. Visual only. */}
      {(t.moatWidth > 0 || t.moatFog) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}>
          <ringGeometry args={[t.radius + 2.2, t.radius + 2.2 + (t.moatFog ? 1 : t.moatWidth), 32]} />
          <meshStandardMaterial
            color={t.moatFog ? FOG_COLOR : WATER_COLOR}
            transparent={t.moatFog}
            opacity={t.moatFog ? 0.45 : 1}
            flatShading
          />
        </mesh>
      )}

      <RigidBody type="fixed" colliders={false} position={[0, PAD_TOP + t.height / 2, 0]}>
        <CylinderCollider args={[t.height / 2, t.radius]} />
        <mesh castShadow receiveShadow rotation={[0, sides === 4 ? Math.PI / 4 : 0, 0]}>
          <cylinderGeometry args={[t.radius, t.radius + 0.25, t.height, sides]} />
          <meshStandardMaterial color={bodyColor} flatShading transparent={t.fog} opacity={t.fog ? 0.55 : 1} />
        </mesh>
      </RigidBody>

      <LibraryDoor t={t} />

      {!t.fog && <Crown t={t} />}
      {!t.fog && <Cracks t={t} />}

      {/* Ivy band: ageing or stale analysis. */}
      {ivy > 0 && !t.fog && (
        <mesh position={[0, PAD_TOP + (t.height * ivy) / 2, 0]}>
          <cylinderGeometry args={[t.radius + 0.28, t.radius + 0.33, t.height * ivy, sides]} />
          <meshStandardMaterial color={IVY_COLOR} flatShading />
        </mesh>
      )}

      {/* Thesis flag on a pole. Breached hangs low and askew. */}
      {flag && (
        <group position={[0, PAD_TOP + t.height + 0.6, 0]}>
          <mesh position={[0, 1.2, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 2.4, 6]} />
            <meshStandardMaterial color="#3a3028" flatShading />
          </mesh>
          <mesh position={[0.55, flag === "breached" ? 1.1 : 2, 0]} rotation={[0, 0, flag === "breached" ? -0.5 : 0]}>
            <boxGeometry args={[1.1, 0.7, 0.05]} />
            <meshStandardMaterial color={FLAG_COLOR[flag]} flatShading />
          </mesh>
        </group>
      )}

    </group>
  );
}
