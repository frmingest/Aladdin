#!/usr/bin/env python3
"""
Claude Code PreToolUse hook for Edit/Write/MultiEdit.

Blocks two specific, high-confidence-dangerous patterns before a file write
lands on disk (see CLAUDE.md's "AI/LLM guardrails" / docs/decisions/0015):

  1. Writing to a real `.env` file (secrets live only in `backend/.env` /
     the deployment platform's env vars — never in a tracked file).
  2. Writing what looks like a hardcoded secret (a real-looking API
     key/token/password value, not a placeholder) into any file.

Reads the tool-call JSON Claude Code sends on stdin and either exits 0
(allow, no output) or exits 2 (block, reason on stderr).
"""

import json
import os
import re
import sys

# .env.example is the one intentional exception — it documents key *names*
# with empty/placeholder values and is meant to be committed.
_ENV_FILE_RE = re.compile(r"(^|[\\/])\.env(\.(?!example$)[^\\/]*)?$")

# A real secret value: a recognizable prefix or a KEY=value/KEY: value shape
# where the value is long and random-looking (placeholders like
# "your-key-here" or "" don't match \S{16,} in a way that looks random, but
# to stay simple/predictable this checks length + charset, not entropy).
_SECRET_VALUE_RE = re.compile(
    r"""
    (?:API[_-]?KEY|SECRET|ACCESS[_-]?KEY|PRIVATE[_-]?KEY|TOKEN|PASSWORD)
    \s*[:=]\s*
    ['"]?
    (?!your[_-]|xxx|changeme|example|placeholder|<|\{\{)
    [A-Za-z0-9_\-/+=]{20,}
    ['"]?
    """,
    re.IGNORECASE | re.VERBOSE,
)


def _content_of(tool_input: dict) -> str:
    # Write uses "content"; Edit uses "new_string"; MultiEdit uses "edits"
    # (a list of {old_string, new_string}).
    if "content" in tool_input:
        return str(tool_input.get("content", ""))
    if "new_string" in tool_input:
        return str(tool_input.get("new_string", ""))
    if "edits" in tool_input and isinstance(tool_input["edits"], list):
        return "\n".join(str(e.get("new_string", "")) for e in tool_input["edits"])
    return ""


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0

    tool_input = payload.get("tool_input", {}) or {}
    file_path = str(tool_input.get("file_path", ""))

    if file_path and _ENV_FILE_RE.search(file_path.replace(os.sep, "/")):
        print(
            "[guard_edit] blocked: refusing to write a real .env file. Secrets belong in "
            "backend/.env (gitignored, never committed) or the deployment platform's env vars — "
            "not a tracked file. .env.example is fine (names + placeholders only).",
            file=sys.stderr,
        )
        return 2

    content = _content_of(tool_input)
    match = _SECRET_VALUE_RE.search(content)
    if match:
        print(
            "[guard_edit] blocked: this write contains what looks like a real, hardcoded secret "
            f"value ({match.group(0)[:40]}...). Use an environment variable / .env reference "
            "instead of a literal value in a tracked file. If this is a false positive (e.g. a "
            "genuinely long non-secret token in test fixture data), tell Faiz and he can adjust "
            ".claude/hooks/guard_edit.py's pattern.",
            file=sys.stderr,
        )
        return 2

    return 0


if __name__ == "__main__":
    sys.exit(main())
