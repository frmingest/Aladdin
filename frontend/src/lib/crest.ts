/** Which crest a game room wears (page-scene kit). Pure so it is tested. */

export type CrestKind = "map" | "records" | "siege" | "market" | "fortress" | "journal";

export function crestForPath(pathname: string): CrestKind {
  if (pathname.startsWith("/fortress/map")) return "map";
  if (pathname.startsWith("/fortress/records")) return "records";
  if (pathname.startsWith("/fortress/siege")) return "siege";
  if (pathname.startsWith("/fortress/marketplace")) return "market";
  if (pathname === "/journal") return "journal";
  return "fortress";
}

