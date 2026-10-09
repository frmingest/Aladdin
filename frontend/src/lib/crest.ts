/** Which crest a game room wears (page-scene kit). Pure so it is tested. */

export type CrestKind = "council" | "circle" | "map" | "records" | "chronicle" | "siege" | "market" | "fortress";

export function crestForPath(pathname: string): CrestKind {
  if (pathname.startsWith("/fortress/council")) return "council";
  if (pathname.startsWith("/fortress/circle")) return "circle";
  if (pathname.startsWith("/fortress/map")) return "map";
  if (pathname.startsWith("/fortress/records")) return "records";
  if (pathname.startsWith("/fortress/chronicle")) return "chronicle";
  if (pathname.startsWith("/fortress/siege")) return "siege";
  if (pathname.startsWith("/fortress/marketplace")) return "market";
  return "fortress";
}

