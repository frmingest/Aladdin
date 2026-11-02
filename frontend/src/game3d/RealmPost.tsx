import { useEffect, useMemo } from "react";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { CanvasTexture, SRGBColorSpace } from "three";
import { INK, PAL, Part } from "./Inked";
import { REALM_FACING, REALM_POST, REALM_SOLID, pennantLook } from "./realmPlan";
import type { PennantShape } from "./realmPlan";
import { REALM_PLATE } from "./realmWordsV1";
import { SIEGE_LABEL } from "../lib/fortress";
import type { RealmLevel } from "../lib/realmVerdict";
import type { FortressSiegeLevel } from "../lib/types";

/** Dark ink on cream, like the other plates. The word is always there, so colour is never the only signal. */
function paintPlate(text: string, size: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 96;
  const g = c.getContext("2d");
  if (!g) return c;
  g.fillStyle = PAL.cream;
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = PAL.timberDark;
  g.lineWidth = 8;
  g.strokeRect(4, 4, c.width - 8, c.height - 8);
  g.fillStyle = INK;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `700 ${size}px "Segoe UI", system-ui, sans-serif`;
  g.fillText(text, c.width / 2, c.height / 2, c.width - 28);
  return c;
}

function usePlate(text: string, size: number): CanvasTexture {
  const tex = useMemo(() => {
    const t = new CanvasTexture(paintPlate(text, size));
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [text, size]);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

/** One shape per level, so the pennant reads without colour. */
function PennantShapeMesh({ shape, color }: { shape: PennantShape; color: string }) {
  switch (shape) {
    case "square":
      return (
        <Part color={color} grow={1.08}>
          <boxGeometry args={[0.9, 0.9, 0.06]} />
        </Part>
      );
    case "triangle":
      return (
        <Part color={color} rotation={[Math.PI / 2, 0, -Math.PI / 2]} grow={1.08}>
          <cylinderGeometry args={[0.6, 0.6, 0.06, 3]} />
        </Part>
      );
    case "disc":
      return (
        <Part color={color} rotation={[Math.PI / 2, 0, 0]} grow={1.08}>
          <cylinderGeometry args={[0.48, 0.48, 0.06, 20]} />
        </Part>
      );
    default:
      // The open ring: "I do not know".
      return (
        <Part color={color} grow={1.1}>
          <torusGeometry args={[0.4, 0.1, 8, 18]} />
        </Part>
      );
  }
}

/**
 * The Realm post (S16, PR 3): a banner pole on the road to the keep. The pennant is the verdict on the whole fortress
 * (one level, by shape and word); a second plate says the weather in the flat page's own words. Code-built, the usual
 * ink outline, no light, no animation. Press E and the flat verdict card opens in a panel.
 */
export default function RealmPost({ level, siege }: { level: RealmLevel | null; siege: FortressSiegeLevel | null }) {
  const look = pennantLook(level);
  const verdictTex = usePlate(REALM_PLATE[look.level], 40);
  const weatherTex = usePlate(SIEGE_LABEL[siege ?? "unsurveyed"], 34);
  return (
    <RigidBody type="fixed" colliders={false} position={[REALM_POST.x, 0, REALM_POST.z]} rotation={[0, REALM_FACING, 0]}>
      <CuboidCollider args={[REALM_SOLID, 2.2, REALM_SOLID]} position={[0, 2.2, 0]} />
      <Part color={PAL.slateDark} position={[0, 0.15, 0]} grow={1.06}>
        <cylinderGeometry args={[0.6, 0.66, 0.3, 9]} />
      </Part>
      <Part color={PAL.timberDark} position={[0, 2.1, 0]} grow={1.12}>
        <boxGeometry args={[0.24, 3.8, 0.24]} />
      </Part>
      {/* Arm and pennant at the top. */}
      <Part color={PAL.timber} position={[0.55, 3.75, 0]} grow={1.12}>
        <boxGeometry args={[1.1, 0.12, 0.12]} />
      </Part>
      <group position={[0.75, 3.2, 0]}>
        <PennantShapeMesh shape={look.shape} color={look.color} />
      </group>
      {/* Verdict plate (the word for the pennant) and weather plate (the flat page's own weather words). */}
      <Part color={PAL.timber} position={[0, 1.75, 0.16]} grow={1.04}>
        <boxGeometry args={[1.0, 0.42, 0.06]} />
      </Part>
      <mesh position={[0, 1.75, 0.2]}>
        <planeGeometry args={[0.92, 0.35]} />
        <meshBasicMaterial map={verdictTex} toneMapped={false} />
      </mesh>
      <Part color={PAL.timber} position={[0, 1.25, 0.16]} grow={1.04}>
        <boxGeometry args={[1.0, 0.42, 0.06]} />
      </Part>
      <mesh position={[0, 1.25, 0.2]}>
        <planeGeometry args={[0.92, 0.35]} />
        <meshBasicMaterial map={weatherTex} toneMapped={false} />
      </mesh>
    </RigidBody>
  );
}
