/**
 * The HUD prompt: the one action you can take right now, as a key cap and a few words.
 * The game's prompt strings are written "Press E to read the signpost"; this splits them so the screen
 * shows `[E] Read the signpost`. Strings that do not start with "Press E to" show as plain words.
 */
export interface PromptParts {
  key: string | null;
  action: string;
}

const LEAD = /^Press ([A-Z]) to /;

export function promptParts(text: string): PromptParts {
  const m = LEAD.exec(text);
  if (!m) return { key: null, action: text };
  const rest = text.slice(m[0].length);
  return { key: m[1], action: rest.charAt(0).toUpperCase() + rest.slice(1) };
}
