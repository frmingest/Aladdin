import { useEffect, useMemo } from "react";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { CanvasTexture, SRGBColorSpace } from "three";
import { INK, PAL, Part } from "./Inked";
import { VAULT, VAULT_FACING, VAULT_SOLID, coinStacks, stackSlots, vaultUnknown } from "./vaultPlan";
import { VAULT_SIGN } from "./vaultWordsV1";
import type { FortressVaultLevel } from "../lib/types";

/** Never red or green: coins are warm yellow, the same family as the flat vault's gold. */
const GOLD = "#e6b93a";

/** Dark ink on cream, like the stall plates. Unknown cash adds a "?" so the chest never looks merely empty. */
function paintPlate(unknown: boolean): HTMLCanvasElement {
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
  g.font = `700 46px "Segoe UI", system-ui, sans-serif`;
  g.fillText(unknown ? `${VAULT_SIGN} ?` : VAULT_SIGN, c.width / 2, c.height / 2, c.width - 28);
  return c;
}

/**
 * The Vault chest (S16, PR 1). Code-built shapes with the same ink outline as the rest, so nothing can fail to load.
 * Decoration around a panel that already works; the one fact is the number of coin stacks on the lid, chosen from
 * the backend's own level (never an amount). No light, no animation, so reduced motion needs nothing.
 */
export default function Vault({ level }: { level: FortressVaultLevel | null }) {
  const unknown = vaultUnknown(level);
  const slots = stackSlots(coinStacks(level));
  const tex = useMemo(() => {
    const t = new CanvasTexture(paintPlate(unknown));
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [unknown]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <RigidBody type="fixed" colliders={false} position={[VAULT.x, 0, VAULT.z]} rotation={[0, VAULT_FACING, 0]}>
      <CuboidCollider args={[VAULT_SOLID.hx, 0.7, VAULT_SOLID.hz]} position={[0, 0.7, 0]} />
      {/* Chest body, flat lid, two iron bands and a teal lock. */}
      <Part color={PAL.timber} position={[0, 0.45, 0]}>
        <boxGeometry args={[2.4, 0.9, 1.5]} />
      </Part>
      <Part color={PAL.timberLight} position={[0, 1.0, 0]} grow={1.05}>
        <boxGeometry args={[2.5, 0.22, 1.6]} />
      </Part>
      {([-0.8, 0.8] as const).map((x) => (
        <Part key={x} color={PAL.iron} position={[x, 0.62, 0]} grow={1.06}>
          <boxGeometry args={[0.18, 1.32, 1.62]} />
        </Part>
      ))}
      <Part color={PAL.teal} position={[0, 0.78, 0.8]} grow={1.15}>
        <boxGeometry args={[0.3, 0.3, 0.1]} />
      </Part>
      {/* Coin stacks on the lid: one fact, how many. */}
      {slots.map((s, i) => (
        <Part key={i} color={GOLD} position={[s.x, 1.11 + (s.coins * 0.07) / 2, s.z]} grow={1.14}>
          <cylinderGeometry args={[0.2, 0.2, s.coins * 0.07, 12]} />
        </Part>
      ))}
      {/* Name plate on a post at the front corner. */}
      <Part color={PAL.timberDark} position={[1.55, 0.7, 0.75]} grow={1.1}>
        <boxGeometry args={[0.1, 1.4, 0.1]} />
      </Part>
      <Part color={PAL.timber} position={[1.55, 1.55, 0.78]} grow={1.04}>
        <boxGeometry args={[1.0, 0.42, 0.06]} />
      </Part>
      <mesh position={[1.55, 1.55, 0.82]}>
        <planeGeometry args={[0.92, 0.35]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </RigidBody>
  );
}
