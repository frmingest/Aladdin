import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Frustum, Matrix4 } from "three";
import { tallyScene } from "./perfGroups";
import type { GroupTally } from "./perfGroups";

export interface PerfStats {
  fps: number;
  calls: number;
  triangles: number;
  /** What the renderer holds in memory right now (measuring only). */
  geometries?: number;
  textures?: number;
  /** Which part of the scene owns the draw calls; only filled while the detail view is on. */
  groups?: GroupTally[];
}

/** How often the (more expensive) per-group walk runs, in reports: 4 reports = about every 2 seconds. */
const DETAIL_EVERY = 4;

/**
 * Reports frames per second, draw calls and triangles about twice a second, plus memory.
 * With `detail` on it also walks the scene every couple of seconds to say who owns the calls.
 * Off by default, so the walk costs nothing unless the overlay is open.
 */
export default function PerfProbe({ onStats, detail = false }: { onStats: (s: PerfStats) => void; detail?: boolean }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const view = useRef({ frustum: new Frustum(), matrix: new Matrix4() });
  const frames = useRef(0);
  const elapsed = useRef(0);
  const reports = useRef(0);
  const groups = useRef<GroupTally[] | undefined>(undefined);

  useFrame((_, delta) => {
    frames.current += 1;
    elapsed.current += delta;
    if (elapsed.current >= 0.5) {
      if (detail) {
        if (reports.current % DETAIL_EVERY === 0) {
          camera.updateMatrixWorld();
          const { frustum, matrix } = view.current;
          frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
          groups.current = tallyScene(scene, frustum);
        }
      } else {
        groups.current = undefined;
      }
      reports.current += 1;
      onStats({
        fps: Math.round(frames.current / elapsed.current),
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        groups: groups.current,
      });
      frames.current = 0;
      elapsed.current = 0;
    }
  });
  return null;
}
