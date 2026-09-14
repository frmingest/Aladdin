import { useEffect, useState } from "react";
import {
  ApiError,
  getMacroSnapshot,
  getSectorResearch,
  listKnownSectors,
  refreshMacroSnapshot,
  refreshSectorResearch,
} from "../../services/api";
import type { MacroSnapshotOut, SectorResearchOut } from "../../types/research";
import { num } from "../../lib/num";
import MacroBarChart, { type MacroBarPoint } from "../../charts/MacroBarChart";

/**
 * Macro dashboard (architecture §19 "Macro dashboard — rates, inflation,
 * yield curves"; §9, §26 Phase 4). Reading is always free (§2.7); refreshing
 * calls FRED/Norges Bank/Gemini+Search and needs `FRED_API_KEY` configured,
 * so it's a manual trigger, same convention as valuation/risk-snapshot.
 */
export default function MacroSection() {
  const [macro, setMacro] = useState<MacroSnapshotOut | null>(null);
  const [macroLoading, setMacroLoading] = useState(false);
  const [macroError, setMacroError] = useState<string | null>(null);

  const [sectors, setSectors] = useState<string[]>([]);
  const [selectedSector, setSelectedSector] = useState<string>("");
  const [sectorResearch, setSectorResearch] = useState<SectorResearchOut | null>(null);
  const [sectorLoading, setSectorLoading] = useState(false);
  const [sectorError, setSectorError] = useState<string | null>(null);

  useEffect(() => {
    getMacroSnapshot()
      .then(setMacro)
      .catch(() => undefined);
    listKnownSectors()
      .then((list) => {
        setSectors(list);
        if (list.length > 0) setSelectedSector(list[0]);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!selectedSector) return;
    getSectorResearch(selectedSector)
      .then(setSectorResearch)
      .catch(() => setSectorResearch(null));
  }, [selectedSector]);

  async function handleMacroRefresh() {
    setMacroLoading(true);
    setMacroError(null);
    try {
      await refreshMacroSnapshot();
      setMacro(await getMacroSnapshot());
    } catch (err) {
      setMacroError(err instanceof ApiError ? String(err.detail ?? err.message) : "Macro refresh failed.");
    } finally {
      setMacroLoading(false);
    }
  }

  async function handleSectorRefresh() {
    if (!selectedSector) return;
    setSectorLoading(true);
    setSectorError(null);
    try {
      await refreshSectorResearch(selectedSector);
      setSectorResearch(await getSectorResearch(selectedSector));
    } catch (err) {
      setSectorError(err instanceof ApiError ? String(err.detail ?? err.message) : "Sector research refresh failed.");
    } finally {
      setSectorLoading(false);
    }
  }

  const macroBars: MacroBarPoint[] = (macro?.observations ?? [])
    .map((o) => ({ series: o.series_key, value: num(o.value), unit: o.unit }))
    .filter((o): o is MacroBarPoint => o.value !== null);

  return (
    <section className="terminal-card space-y-6">
      <div>
        <div className="terminal-card-header">
          <h2 className="terminal-card-title">Macro dashboard</h2>
          <button
            onClick={handleMacroRefresh}
            disabled={macroLoading}
            className="btn-terminal btn-terminal-primary text-xs px-3 py-1"
          >
            {macroLoading ? "Refreshing…" : "Refresh macro data"}
          </button>
        </div>
        {macroError && <p className="text-negative text-sm mb-2">{macroError}</p>}
        {macro && !macro.available && <p className="text-sm text-tertiary">{macro.reason ?? "No macro data available."}</p>}
        {macro?.available && (
          <>
            {macro.as_of && <p className="text-xs text-disabled mb-2 font-mono">as of {new Date(macro.as_of).toLocaleString()}</p>}
            <MacroBarChart data={macroBars} />
            {macro.narrative_items.length > 0 && (
              <ul className="mt-3 space-y-2">
                {macro.narrative_items.slice(0, 5).map((item, i) => (
                  <li key={i} className="text-sm">
                    <a href={item.source_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      {item.title}
                    </a>
                    <p className="text-xs text-tertiary">{item.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h3 className="text-sm font-medium text-secondary">Sector research</h3>
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="input-terminal w-auto text-xs py-1"
          >
            {sectors.length === 0 && <option value="">No sectors on record</option>}
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            onClick={handleSectorRefresh}
            disabled={sectorLoading || !selectedSector}
            className="btn-terminal btn-terminal-primary text-xs px-3 py-1"
          >
            {sectorLoading ? "Refreshing…" : "Refresh sector research"}
          </button>
        </div>
        {sectorError && <p className="text-negative text-sm mb-2">{sectorError}</p>}
        {sectorResearch && !sectorResearch.available && (
          <p className="text-sm text-tertiary">{sectorResearch.reason ?? "No sector research available."}</p>
        )}
        {sectorResearch?.available && (
          <ul className="space-y-2">
            {sectorResearch.items.map((item, i) => (
              <li key={i} className="text-sm">
                <a href={item.source_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                  {item.title}
                </a>
                <p className="text-xs text-tertiary">{item.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
