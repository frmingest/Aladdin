import { NavLink } from "react-router-dom";
import { FORTRESS_NAV } from "../../lib/nav";

/** The Fortress rooms as one tab strip (UX noise audit, Wave 3), replacing six
 * extra sidebar links and six buttons on the Fortress page. Shown on every
 * /fortress page while game mode is on. */
export default function FortressTabs() {
  return (
    <nav
      aria-label="Fortress rooms"
      className="mx-auto flex max-w-6xl gap-1 overflow-x-auto border-b border-border px-4 sm:px-6"
    >
      {FORTRESS_NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/fortress"}
          className={({ isActive }) =>
            `shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive ? "border-accent text-ink" : "border-transparent text-ink-muted hover:text-ink"
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
