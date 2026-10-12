
/** A static parchment folio for ritual content (page-scene kit). The `.parchment` class re-points the
 * colour tokens to dark ink on paper, so text inside stays readable in both themes.  Use SealMark, not the state pills, inside it. */
export default function ParchmentPanel({
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
    <div id={id} tabIndex={tabIndex} className={`parchment relative rounded-lg p-4 ${className}`}>
      {children}
    </div>
  );
}
