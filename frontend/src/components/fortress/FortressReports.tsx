import { useState } from "react";
import { ravensTabLabel, splitRavens } from "../../lib/ravens";
import type { GameState, Ravens } from "../../lib/types";
import ObjectArtImage from "../ObjectArtImage";
import AdvisorsCard from "./AdvisorsCard";
import RavensCard from "./RavensCard";
import SiegeCard from "./SiegeCard";
import TemperamentCard from "./TemperamentCard";

/** The reports under the Fortress scene as one tabbed panel (UX noise audit,
 * Wave 3): four cards used to stack under the picture and compete with it. Only
 * the open report is mounted. Nothing is hidden for good; each report is one
 * click away and the tab for the ravens shows how many landed in the last 48 hours. */

type ReportId = "advisors" | "weather" | "temperament" | "ravens";

export default function FortressReports({
  state,
  ravens,
  seen,
  onSeen,
}: {
  state: GameState;
  ravens: Ravens | null;
  seen: Set<string>;
  onSeen: (ids: string[]) => void;
}) {
  const [active, setActive] = useState<ReportId>("advisors");
  const newRavens = ravens ? splitRavens(ravens.ravens, seen, ravens.as_of).recent.length : 0;
  const tabs: { id: ReportId; label: string }[] = [
    { id: "advisors", label: "Advisors" },
    { id: "weather", label: "Weather" },
    { id: "temperament", label: "Temperament" },
    { id: "ravens", label: ravensTabLabel(newRavens) },
  ];
  return (
    <section aria-label="Fortress reports" className="space-y-3">
      <div role="tablist" aria-label="Fortress reports" className="inline-flex flex-wrap rounded-md border border-border p-0.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            onClick={() => setActive(t.id)}
            className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
              active === t.id ? "bg-accent-subtle text-ink" : "text-ink-muted hover:text-ink"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <TabArt id={t.id} />
              {t.label}
            </span>
          </button>
        ))}
      </div>
      {active === "advisors" && <AdvisorsCard advisors={state.advisors} />}
      {active === "weather" && <SiegeCard siege={state.siege} />}
      {active === "temperament" && <TemperamentCard temperament={state.temperament} />}
      {active === "ravens" && <RavensCard ravens={ravens} seen={seen} onSeen={onSeen} />}
    </section>
  );
}

/** A small picture in front of each tab label (Game mode only; nothing without it). Temperament shows the fixed calm and panic pair:
 * it says "how steady is your hand" and is never chosen from the data, so neither face reads as a verdict. */
function TabArt({ id }: { id: ReportId }) {
  if (id === "advisors") return <ObjectArtImage id="bust-oracle" width={22} fallback={null} />;
  if (id === "weather") return <ObjectArtImage id="siege-tent" width={26} fallback={null} />;
  if (id === "ravens") return <ObjectArtImage id="raven" width={26} fallback={null} />;
  return (
    <span className="inline-flex items-end">
      <ObjectArtImage id="temperament-calm" width={20} fallback={null} />
      <ObjectArtImage id="temperament-panic" width={20} className="-ml-1" fallback={null} />
    </span>
  );
}
