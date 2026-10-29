import ObjectArtImage from "../../ObjectArtImage";

/** The study lamp. The picture is an unlit brass lamp; the flame is drawn here from the lamp reading (lit while the
 * portfolio snapshot is recent, dim when older, out when there is none), so "out" is a dark chimney, never a lit one. Static. */
export default function DeskLamp({ state, label, fallback }: { state: "lit" | "dim" | "out"; label: string; fallback: React.ReactNode }) {
  return (
    <div className="relative h-16 w-12 shrink-0" data-testid="desk-lamp" data-state={state} role="img" aria-label={label}>
      <ObjectArtImage id="desk-lamp" width={19} className="relative mx-auto" fallback={fallback} />
      {state !== "out" && (
        <svg viewBox="0 0 12 16" className="pointer-events-none absolute left-1/2 top-[17px] -translate-x-1/2" width={state === "lit" ? 11 : 7} height={state === "lit" ? 15 : 9} aria-hidden="true" focusable="false">
          <path d="M6 1c1.5 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1.6.8-2.6 1.6-4 .6.8 1 1.4 1.4 1.4C5.4 4.2 5 3 6 1Z" className="fill-accent" />
        </svg>
      )}
    </div>
  );
}
