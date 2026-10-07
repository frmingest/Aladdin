import { Disclosure } from "../ui";

/** The one footer every game-mode page shares (UX noise audit, game mode, Wave G2). The promise is
 * said once, in one line; the rule versions and page-specific notes sit one click deeper for
 * whoever wants the evidence. Nothing here changes what a page reads or computes. */
export default function GameFooter({ rules, children }: { rules: string; children?: React.ReactNode }) {
  return (
    <footer className="px-1 text-xs text-ink-faint">
      <p>Read-only: nothing on this page trades, scores or rewards anything. Missing data stays unknown.</p>
      <Disclosure label="the rules behind this page" level="evidence" className="mt-1">
        <p>{rules}</p>
        {children}
      </Disclosure>
    </footer>
  );
}
