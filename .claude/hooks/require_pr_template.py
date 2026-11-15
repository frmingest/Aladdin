"""PreToolUse hook (Bash): refuse to create or edit a pull request whose body is not the filled-in
.github/pull_request_template.md. Exits 2 with the problems listed, so the PR is never opened half-done.

It recognises `gh pr create|edit` and a write (POST/PATCH, or any -f/-F/--input/-d field) to
`repos/<owner>/<repo>/pulls` or `pulls/<n>` through `gh api` or curl. The body is read from `--input FILE`,
`--body-file FILE`, `-F body=@FILE`, `-d @FILE`, or the command text itself. The check is the same code CI runs
(.github/scripts/check_pr_template.py). A PR labelled no-issue (typo or link fix) is the only bypass, and
it is applied in CI, not here: write a short filled-in body anyway.
Added after PR #427 (2026-11-15) was opened by hand without the template or the review agents."""
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.join(os.getcwd(), ".github", "scripts"))
try:
    from check_pr_template import check
except Exception:  # the checker is missing: fail closed, say why
    print("PR guardrail: .github/scripts/check_pr_template.py cannot be imported; run from the repo root.", file=sys.stderr)
    sys.exit(2)

data = json.load(sys.stdin)
cmd = (data.get("tool_input") or {}).get("command", "") or ""

gh_pr = re.search(r"\bgh\s+pr\s+(create|edit)\b", cmd)
endpoint = re.search(r"repos/[^\s'\"]+/pulls(/\d+)?(?=[\s'\"]|$)", cmd)
writes = re.search(r"(-X\s*(POST|PATCH)|--method\s+(POST|PATCH)|\s-[fF]\s|--input\b|\s-d\s|--data\b)", cmd)
if not (gh_pr or (endpoint and writes)):
    sys.exit(0)

text = cmd
has_body = bool(re.search(r"\bbody\b|--body", cmd))
for pattern in (r"--input\s+(\S+)", r"--body-file\s+(\S+)", r"-F\s+body=@(\S+)", r"(?:-d|--data)\s+@(\S+)"):
    for m in re.finditer(pattern, cmd):
        path = m.group(1).strip("'\"")
        try:
            raw = open(path, encoding="utf-8").read()
        except OSError:
            continue
        has_body = has_body or "--body-file" in m.group(0) or bool(re.search(r'"body"\s*:', raw))
        try:
            raw = json.loads(raw).get("body", raw)
        except (ValueError, AttributeError):
            pass
        text += "\n" + str(raw)

# A PATCH that only changes title, state or milestone carries no body and is fine; a create always needs one.
creating = bool(gh_pr and gh_pr.group(1) == "create") or bool(endpoint and not endpoint.group(1) and writes)
if not creating and not has_body:
    sys.exit(0)

try:
    changed = subprocess.run(
        ["git", "diff", "--name-only", "origin/main...HEAD"], capture_output=True, text=True, timeout=20
    ).stdout.split()
except Exception:
    changed = []
# The body text inside the command is JSON or shell-quoted; unescape the common cases before checking.
body = text.replace("\\n", "\n").replace('\\"', '"')
errors = check(body, changed)
if errors:
    print("PR guardrail: this PR body is not the filled-in template (.github/pull_request_template.md; /ship-pr does it).", file=sys.stderr)
    for e in errors:
        print(f"  - {e}", file=sys.stderr)
    print("Fix the body and retry. Do not weaken this check to get a PR through.", file=sys.stderr)
    sys.exit(2)
