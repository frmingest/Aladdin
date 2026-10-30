import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

export interface PerfStats {
  fps: number;
  calls: number;
  triangles: number;
}

/** Reports frames per second, draw calls and triangles about twice a second. */
export default function PerfProbe({ onStats }: { onStats: (s: PerfStats) => void }) {
  const gl = useThree((s) => s.gl);
  const frames = useRef(0);
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    frames.current += 1;
    elapsed.current += delta;
    if (elapsed.current >= 0.5) {
      onStats({
        fps: Math.round(frames.current / elapsed.current),
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
      });
      frames.current = 0;
      elapsed.current = 0;
    }
  });
  return null;
}
