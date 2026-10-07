import { useState } from "react";
import { unseen } from "../../lib/ravens";
import type { GameState, Ravens } from "../../lib/types";
import AdvisorsCard from "./AdvisorsCard";
import RavensCard from "./RavensCard";
import SiegeCard from "./SiegeCard";
import TemperamentCard from "./TemperamentCard";

/** The reports under the Fortress scene as one tabbed panel (UX noise audit,
 * Wave 3): four cards used to stack under the picture and compete with it. Only
 * the open report is mounted. Nothing is hidden for good; each report is one
 * click away and the tab for the ravens shows how many you have not seen. */

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
  const newRavens = ravens ? unseen(ravens.ravens, seen).length : 0;
  const tabs: { id: ReportId; label: string }[] = [
    { id: "advisors", label: "Advisors" },
    { id: "weather", label: "Weather" },
    { id: "temperament", label: "Temperament" },
    { id: "ravens", label: newRavens > 0 ? `Ravens · ${newRavens} new` : "Ravens" },
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
            {t.label}
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
