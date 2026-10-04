import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useGameMode } from "../../lib/gameMode";
import type { HoldingAdvisors } from "../../lib/types";
import { Card } from "../ui";
import { Line } from "./AdvisorsCard";

/** Game mode G20: every advisor line that is about this holding, on its own page. The Fortress shows
 * only the first few lines across the whole portfolio; this lists all that match one holding. Same
 * hand-written, rule-chosen lines as the Fortress; nothing generated, no line tells you to trade.
 * Renders nothing with game mode off, while loading, on an error, or when no rule is about this
 * holding (silence is not "all is well"; it only means no rule matched). */
export default function HoldingAdvisorsCard({ holdingId }: { holdingId: string }) {
  const { gameMode } = useGameMode();
  const [data, setData] = useState<HoldingAdvisors | null>(null);

  useEffect(() => {
    if (!gameMode) {
      setData(null);
      return;
    }
    let live = true;
    api
      .getHoldingAdvisors(holdingId)
      .then((d) => live && setData(d))
      .catch(() => live && setData(null));
    return () => {
      live = false;
    };
  }, [gameMode, holdingId]);

  if (!gameMode || !data || data.lines.length === 0) return null;
  return (
    <Card className="mb-6">
      <h2 className="section-title">What the advisors say about this holding</h2>
      <ul className="divide-y divide-border-subtle">
        {data.lines.map((line, i) => (
          <Line key={`${line.rule}-${i}`} line={line} />
        ))}
      </ul>
      <p className="mt-2 text-xs text-ink-faint">{data.disclaimer}</p>
    </Card>
  );
}
