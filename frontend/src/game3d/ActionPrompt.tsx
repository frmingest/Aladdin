import { promptParts } from "./actionPromptLogic";

/**
 * The one HUD prompt, bottom centre: a key cap and the action ("[E] Talk to Barren Wuffet"), with an
 * optional small note under it. Only one shows at a time. It is also a button, so a tap does what E does.
 * It has no place of its own: the page stacks it above the controls hint (HudBottomStack), so a hint that wraps on a
 * phone pushes the prompt up instead of sliding under it (#524).
 */
export default function ActionPrompt({ text, note, onPress }: { text: string; note?: string | null; onPress?: () => void }) {
  const { key, action } = promptParts(text);
  return (
    <div className="pointer-events-none w-max max-w-[90%]">
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
