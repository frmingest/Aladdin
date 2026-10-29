import ObjectArtImage from "../../ObjectArtImage";
import { getObjectArt, useArtMode } from "../../../lib/stitchArt";
import { vaultScene } from "../../../lib/sectionScene";
import type { FortressVaultLevel } from "../../../lib/types";

/** A strongroom whose opening is always empty in the picture; the gold level is drawn here from the backend's level, so the
 * picture can never overstate cash. Unsurveyed ("cash not entered") is fog and a "?", not an empty vault. Falls back to the
 * drawn vault with pictures off. */
export default function VaultCutaway({ level, label, fallback }: { level: FortressVaultLevel; label: string; fallback: React.ReactNode }) {
  const art = getObjectArt("vault-cutaway");
  const mode = useArtMode();
  if (mode !== "stitch" || !art) return <>{fallback}</>;
  const W = 112;
  const H = (W * art.height) / art.width;
  const tl = art.anchors?.["opening-tl"];
  const br = art.anchors?.["opening-br"];
  const { fill, fog } = vaultScene(level);
  return (
    <div className="relative w-32 shrink-0" style={{ height: H }} data-testid="vault-cutaway" data-level={level} role="img" aria-label={label}>
      <ObjectArtImage id="vault-cutaway" width={W} className="mx-auto" fallback={fallback} />
      {tl && br && (
        <div
          className="pointer-events-none absolute overflow-hidden"
          style={{ left: `calc(50% - ${W / 2}px + ${tl[0] * W}px)`, width: (br[0] - tl[0]) * W, top: tl[1] * H, height: (br[1] - tl[1]) * H }}
          aria-hidden="true"
        >
          {fog ? (
            <span className="flex h-full items-center justify-center text-2xl text-ink-faint">?</span>
          ) : (
            <span className="vault-gold absolute inset-x-0 bottom-0 block" style={{ height: `${Math.round(fill * 100)}%` }} />
          )}
        </div>
      )}
    </div>
  );
}
