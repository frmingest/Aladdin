import { NavLink } from "react-router-dom";
import { emblemForPath } from "../../lib/artAssets";
import { useArtPack } from "../../lib/artPack";
import { FORTRESS_NAV } from "../../lib/nav";
import { usePlainView } from "../../lib/plainView";

/** The Fortress rooms as one tab strip (UX noise audit, Wave 3), replacing six
 * extra sidebar links and six buttons on the Fortress page. Shown on every
 * /fortress page while game mode is on. */
export default function FortressTabs() {
  const [art] = useArtPack();
  const [plain] = usePlainView();
  return (
    <nav
      aria-label="Fortress rooms"
      className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto border-b border-border px-4 sm:px-6"
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
          {art && !plain && emblemForPath(item.to) && (
            <img src={emblemForPath(item.to) ?? ""} alt="" aria-hidden="true" width={20} height={20} className="mr-1.5 inline-block h-5 w-5 align-[-5px]" />
          )}
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
