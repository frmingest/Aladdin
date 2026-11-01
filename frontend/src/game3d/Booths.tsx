import { useEffect, useMemo } from "react";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { CanvasTexture, SRGBColorSpace } from "three";
import { INK, PAL, Part } from "./Inked";
import { BOOTHS, BOOTH_SOLID } from "./boothPlan";
import type { Booth } from "./boothPlan";

/** Dark ink on cream, like the stall plates: just the stand's name. Words only. */
function paintSign(text: string): HTMLCanvasElement {
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
  g.font = `700 44px "Segoe UI", system-ui, sans-serif`;
  g.fillText(text, c.width / 2, c.height / 2, c.width - 28);
  return c;
}

/** One stand: counter, two posts, a cloth roof and a sign. All code-built, no model, so nothing can fail to load. */
function BoothMesh({ booth }: { booth: Booth }) {
  const tex = useMemo(() => {
    const t = new CanvasTexture(paintSign(booth.sign));
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [booth.sign]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <RigidBody type="fixed" colliders={false} position={[booth.x, 0, booth.z]} rotation={[0, booth.yaw, 0]}>
      <CuboidCollider args={[BOOTH_SOLID.hx, 1, BOOTH_SOLID.hz]} position={[0, 1, 0]} />
      <Part color={PAL.timber} position={[0, 0.55, 0.45]}>
        <boxGeometry args={[2.2, 1.1, 0.7]} />
      </Part>
      {([-1.05, 1.05] as const).map((x) => (
        <Part key={x} color={PAL.timberDark} position={[x, 1.5, -0.45]} grow={1.1}>
          <boxGeometry args={[0.14, 3, 0.14]} />
        </Part>
      ))}
      <Part color={booth.cloth} position={[0, 3.05, -0.1]} rotation={[0.18, 0, 0]}>
        <boxGeometry args={[2.7, 0.14, 1.9]} />
      </Part>
      <Part color={PAL.timber} position={[0, 2.5, 0.88]} grow={1.04}>
        <boxGeometry args={[1.9, 0.5, 0.06]} />
      </Part>
      <mesh position={[0, 2.5, 0.92]}>
        <planeGeometry args={[1.8, 0.42]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </RigidBody>
  );
}

/** Sal's counter and the Hype Booth at the near end of Market Street. Decoration around two dialogs that already work. */
export default function Booths() {
  return (
    <>
      {BOOTHS.map((b) => (
        <BoothMesh key={b.id} booth={b} />
      ))}
    </>
  );
}
