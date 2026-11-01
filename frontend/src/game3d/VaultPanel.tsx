import { Link } from "react-router-dom";
import TemperamentCard from "../components/fortress/TemperamentCard";
import VaultCard from "../components/fortress/VaultCard";
import type { GameState } from "../lib/types";
import { VAULT_CLOSE, VAULT_PANEL_TITLE, VAULT_PLAIN } from "./vaultWordsV1";

/**
 * The Vault panel (S16, PR 1): the flat Fortress's own Vault card and Temperament meter, in the world. Every
 * word, number and the one write (update cash) come from those components, so nothing is copied and the two
 * pages cannot disagree. A sample fortress shows the cards but cannot save (the card's own demo rule).
 */
export default function VaultPanel({
  state,
  onChanged,
  onClose,
}: {
  state: GameState;
  /** Called after cash was saved, so the world reads the fortress again and the chest follows. */
  onChanged: () => void;
  onClose: () => void;
}) {
  return (
    <aside
      aria-label={VAULT_PANEL_TITLE}
      className="g3d-panel absolute inset-x-3 top-14 z-40 flex max-h-[calc(100%-4.5rem)] flex-col overflow-hidden p-2 text-sm md:inset-x-[20%]"
    >
      <header className="g3d-head">
        <h2>{VAULT_PANEL_TITLE}</h2>
        <span className="flex items-center gap-2">
          <Link to="/fortress" className="g3d-btn">{VAULT_PLAIN}</Link>
          <button type="button" className="g3d-x" aria-label={VAULT_CLOSE} onClick={onClose}>×</button>
        </span>
      </header>
      <div className="mt-2 min-h-0 flex-1 space-y-3 overflow-y-auto rounded bg-surface p-2">
        <VaultCard vault={state.vault} demo={state.demo} onChanged={onChanged} />
        <TemperamentCard temperament={state.temperament} />
      </div>
    </aside>
  );
}
