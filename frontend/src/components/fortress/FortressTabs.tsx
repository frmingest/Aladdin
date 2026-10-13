import { NavLink } from "react-router-dom";
import { crestForPath } from "../../lib/crest";
import { FORTRESS_NAV } from "../../lib/nav";
import { roomCrestId } from "../../lib/roomArt";
import type { ObjectArtId } from "../../lib/stitchArt";
import ObjectArtImage from "../ObjectArtImage";

/** The Fortress rooms as one tab strip (UX noise audit, Wave 3), replacing six
 * extra sidebar links and six buttons on the Fortress page. Shown on every
 * /fortress page while game mode is on. */
export default function FortressTabs() {
  return (
    <nav
      aria-label="Fortress rooms"
      className="ui-tabbar ui-rooms mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto border-b border-border px-4 sm:px-6"
    >
      {FORTRESS_NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/fortress"}
          className={({ isActive }) =>
            `ui-tab shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive ? "border-accent text-ink" : "border-transparent text-ink-muted hover:text-ink"
            }`
          }
        >
          {({ isActive }) => (
            <>
              {/* A small lozenge marks the open room, so the active tab is told by shape as well as colour. */}
              {isActive && <span aria-hidden="true" className="mr-1.5 inline-block h-1.5 w-1.5 rotate-45 bg-accent align-middle" />}
              {/* Art on: the room's small medallion before its name (decoration; the label stays the name). */}
              <TabCrest to={item.to} />
              {item.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function TabCrest({ to }: { to: string }) {
  const id = roomCrestId(crestForPath(to));
  if (!id) return null;
  return (
    <span className="mr-1.5 inline-block align-middle">
      <ObjectArtImage id={id as ObjectArtId} width={20} fallback={null} />
    </span>
  );
}
