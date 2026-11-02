import { useEffect, useMemo } from "react";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { CanvasTexture, SRGBColorSpace } from "three";
import { INK, PAL, Part } from "./Inked";
import { REALM_BANNER, REALM_FACING, REALM_SOLID, realmLook } from "./realmPlan";
import type { RealmLevel } from "../lib/realmVerdict";

/** Dark ink on cream: the word the flat card prints, then its mark, so colour is never the only signal. */
function paintPlate(word: string, mark: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 384;
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
  g.font = `700 36px "Segoe UI", system-ui, sans-serif`;
  g.fillText(`${mark} ${word}`, c.width / 2, c.height / 2, c.width - 28);
  return c;
}

/**
 * The Great Keep banner (S16, PR 3): a tall pole in front of the keep door with a pennant and a name plate. The plate
 * prints the flat verdict's own word and mark; the pennant is teal, cream, indigo or grey (never red or green). Code-built,
 * same ink outline as the rest, no light and no animation.
 */
export default function RealmBanner({ level }: { level: RealmLevel | null }) {
  const look = realmLook(level);
  const tex = useMemo(() => {
    const t = new CanvasTexture(paintPlate(look.word, look.mark));
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [look.word, look.mark]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <RigidBody type="fixed" colliders={false} position={[REALM_BANNER.x, 0, REALM_BANNER.z]} rotation={[0, REALM_FACING, 0]}>
      <CuboidCollider args={[REALM_SOLID, 3, REALM_SOLID]} position={[0, 3, 0]} />
      <Part color={PAL.slateDark} position={[0, 0.15, 0]} grow={1.06}>
        <cylinderGeometry args={[0.7, 0.76, 0.3, 9]} />
      </Part>
      <Part color={PAL.timberDark} position={[0, 3.2, 0]} grow={1.1}>
        <boxGeometry args={[0.22, 6, 0.22]} />
      </Part>
      <Part color={PAL.iron} position={[0, 6.3, 0]} grow={1.3}>
        <sphereGeometry args={[0.2, 10, 8]} />
      </Part>
      {/* Pennant, hung from a cross-bar. */}
      <Part color={PAL.timber} position={[0.55, 5.7, 0]} grow={1.12}>
        <boxGeometry args={[1.1, 0.12, 0.12]} />
      </Part>
      <Part color={look.cloth} position={[0.65, 4.95, 0]} grow={1.05}>
        <boxGeometry args={[0.9, 1.4, 0.06]} />
      </Part>
      {/* Name plate low on the pole. */}
      <Part color={PAL.timber} position={[0, 1.6, 0.16]} grow={1.04}>
        <boxGeometry args={[1.5, 0.46, 0.06]} />
      </Part>
      <mesh position={[0, 1.6, 0.2]}>
        <planeGeometry args={[1.4, 0.36]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </RigidBody>
  );
}
