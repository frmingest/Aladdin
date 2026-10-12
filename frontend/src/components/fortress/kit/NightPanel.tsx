
/** A dark, candlelit folio for game rooms that should sit with the study skin (page-scene kit). Same
 * contract as ParchmentPanel: the `.nightpanel` class re-points the colour tokens, so text inside stays
 * readable (game mode off uses the ordinary card elsewhere). */
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
  return (
    <div id={id} tabIndex={tabIndex} className={`nightpanel relative rounded-lg p-4 ${className}`}>
      {children}
    </div>
  );
}
