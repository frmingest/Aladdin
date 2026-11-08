import { promptParts } from "./actionPrompt";

/**
 * The one HUD prompt, bottom centre: a key cap and the action ("[E] Talk to Barren Wuffet"), with an
 * optional small note under it. Only one shows at a time. It is also a button, so a tap does what E does.
 */
export default function ActionPrompt({ text, note, onPress }: { text: string; note?: string | null; onPress?: () => void }) {
  const { key, action } = promptParts(text);
  return (
    <div className="pointer-events-none absolute bottom-16 left-1/2 w-max max-w-[90%] -translate-x-1/2">
      <button type="button" onClick={onPress} className="g3d-prompt" aria-label={key ? `${key}: ${action}` : action}>
        {key && (
          <kbd className="g3d-keycap" aria-hidden="true">
            {key}
          </kbd>
        )}
        <span>{action}</span>
      </button>
      {note && <span className="g3d-prompt-note">{note}</span>}
    </div>
  );
}
