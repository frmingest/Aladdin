#!/usr/bin/env python3
"""
Claude Code PreToolUse hook for the Bash tool.

Deterministically blocks a short list of specific, high-confidence-dangerous
shell command patterns before they run, instead of relying on a prompt
asking the model nicely not to run them (see CLAUDE.md's "AI/LLM guardrails"
/ docs/decisions/0015 for why deterministic > prompt-level enforcement).

Reads the tool-call JSON Claude Code sends on stdin, inspects
tool_input.command, and either:
  - exits 0 (allow) with no output, or
  - exits 2 (block) and prints a short reason to stderr, which Claude Code
    surfaces back to the agent as why the command was refused.

Deliberately conservative: this blocks a small set of patterns that are
almost never what you actually meant to run in this repo, not a general
"security scanner". A block here should be rare and always explainable in
one sentence.
"""

import json
import re
import sys

# (pattern, human-readable reason) — first match wins.
BLOCKED_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (
        re.compile(r"rm\s+(-\w*r\w*f\w*|-\w*f\w*r\w*)\s+.*(~|\$HOME|/\s*$|[A-Za-z]:\\?\s*$)"),
        "rm -rf targeting a home directory or drive root — almost certainly not intended; "
        "scope it to a specific subdirectory or ask Faiz first.",
    ),
    (
        re.compile(r"git\s+push\b.*(\s-f\b|\s--force\b)"),
        "git push --force is blocked — never force-push to a shared branch. If history genuinely "
        "needs rewriting, confirm with Faiz first.",
    ),
    (
        re.compile(r"git\s+reset\s+--hard\b"),
        "git reset --hard can discard uncommitted work permanently — confirm with Faiz before "
        "running this, then run it yourself if he agrees.",
    ),
    (
        re.compile(r"\b(curl|wget|iwr|invoke-webrequest)\b.*\|\s*(bash|sh|iex|invoke-expression)\b", re.I),
        "piping a remote download straight into a shell/interpreter is blocked — download it, "
        "read it, then run it explicitly if it's legitimate.",
    ),
    (
        re.compile(r"\b(DROP\s+TABLE|TRUNCATE\s+TABLE|DELETE\s+FROM)\b", re.I),
        "destructive SQL (DROP/TRUNCATE/DELETE FROM) in a raw command is blocked — use the "
        "app's own scoped reset endpoint (which requires confirm=true) or an Alembic migration "
        "instead of hand-run SQL against a real database.",
    ),
]


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        # If we can't parse the hook payload, fail open rather than blocking
        # every single bash call in the session on a parsing bug.
        return 0

    command = str(payload.get("tool_input", {}).get("command", ""))
    if not command:
        return 0

    for pattern, reason in BLOCKED_PATTERNS:
        if pattern.search(command):
            print(f"[guard_bash] blocked: {reason}", file=sys.stderr)
            return 2

    return 0


if __name__ == "__main__":
    sys.exit(main())
