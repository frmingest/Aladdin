import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useGameMode } from "../../lib/gameMode";
import type { GameTower } from "../../lib/types";
import HoldingAdvisorsCard from "./HoldingAdvisorsCard";
import TowerSurvey from "./TowerSurvey";

/** Game mode only: the holding's tower survey at the top of its page, so the
 * re-skinned holding page says how the fortress sees this position. Renders
 * nothing with game mode off, while loading, on an error, or for a holding
 * that is not in the current portfolio (a watchlist name has no tower). */
export default function HoldingTowerCard({ holdingId }: { holdingId: string }) {
  const { gameMode } = useGameMode();
  const [tower, setTower] = useState<GameTower | null>(null);

  useEffect(() => {
    if (!gameMode) {
      setTower(null);
      return;
    }
    let live = true;
    api
      .getGameState()
      .then((s) => {
        if (live) setTower(s.towers.find((t) => t.holding_id === holdingId) ?? null);
      })
      .catch(() => {
        if (live) setTower(null);
      });
    return () => {
      live = false;
    };
  }, [gameMode, holdingId]);

  if (!gameMode || !tower) return null;
  return (
    <div className="mb-6">
      <p className="mb-2 text-xs uppercase tracking-wide text-ink-faint">
        How the fortress sees this holding ·{" "}
        <Link to="/fortress" className="normal-case text-accent hover:underline">
          back to the Fortress
        </Link>
      </p>
      <TowerSurvey tower={tower} compact />
      <div className="mt-4">
        <HoldingAdvisorsCard holdingId={holdingId} />
      </div>
    </div>
  );
}
