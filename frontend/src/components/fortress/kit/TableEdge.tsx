import { useArtPack } from "../../../lib/artPack";
import { usePlainView } from "../../../lib/plainView";

/** A strip of the painted cartographer's table (candle, divider, inkwell) above the map. It is
 * deliberately the table edge only: the full painting has five fog patches baked in, and baked fog
 * would say "five unsurveyed areas" whatever the survey actually found. Decoration, no facts, no text.
 * Renders nothing in Plain view or with the art pack off. */
export default function TableEdge() {
  const [on] = useArtPack();
  const [plain] = usePlainView();
  if (!on || plain) return null;
  return <div aria-hidden="true" className="table-edge" />;
}
