import { usePlainView } from "../../../lib/plainView";
import { Card } from "../../ui";

/** A dark, candlelit folio for game rooms that should sit with the study skin (page-scene kit). Same
 * contract as ParchmentPanel: the `.nightpanel` class re-points the colour tokens, so text inside stays
 * readable, and Plain view brings the ordinary card back with the same content. */
export default function NightPanel({
  children,
  className = "",
  id,
  tabIndex,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
  tabIndex?: number;
}) {
  const [plain] = usePlainView();
  if (plain) {
    return (
      <div id={id} tabIndex={tabIndex} className={className}>
        <Card>{children}</Card>
      </div>
    );
  }
  return (
    <div id={id} tabIndex={tabIndex} className={`nightpanel relative rounded-lg p-4 ${className}`}>
      {children}
    </div>
  );
}
