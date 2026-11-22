import { useMemo } from "react";
import type { CanvasTexture } from "three";
import { makeTexture, useDispose } from "./plateTexture";
import { BANNER_PX, LEVER_BOARD_PX, drawLeverBoard, drawMintBanner } from "./mintPlateArt";

/** One flat picture on a wall or post: unlit, so the words read the same wherever you stand. */
export function Sheet({ texture, width, height }: { texture: CanvasTexture; width: number; height: number }) {
  return (
    <mesh>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}

/** The name board over one lever: the name big, the lever's setting under it (#480). */
export function LeverBoard({ position, width, name, readout }: { position: [number, number, number]; width: number; name: string; readout: string }) {
  const texture = useMemo(() => makeTexture(LEVER_BOARD_PX, (ctx) => void drawLeverBoard(ctx, name, readout)), [name, readout]);
  useDispose(texture);
  return (
    <group position={position}>
      <Sheet texture={texture} width={width} height={(width * LEVER_BOARD_PX.h) / LEVER_BOARD_PX.w} />
    </group>
  );
}

/** A wide board with one big line and, optionally, one smaller line under it. */
export function Banner({ position, yaw, width, big, small }: { position: [number, number, number]; yaw: number; width: number; big: string; small: string | null }) {
  const texture = useMemo(() => makeTexture(BANNER_PX, (ctx) => drawMintBanner(ctx, big, small)), [big, small]);
  useDispose(texture);
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <Sheet texture={texture} width={width} height={(width * BANNER_PX.h) / BANNER_PX.w} />
    </group>
  );
}
