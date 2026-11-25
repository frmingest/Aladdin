"""PreToolUse hook (Bash): refuse to create or edit a pull request whose body is not the filled-in
.github/pull_request_template.md. Exits 2 with the problems listed, so the PR is never opened half-done.

What it recognises, only at the START of a command segment (so `git commit -m "... gh pr create ..."` and
`echo gh pr create` are left alone): `gh pr create|edit`; a write (POST/PATCH, or any -f/-F/--input/-d field)
to `repos/<owner>/<repo>/pulls` or `pulls/<n>` through `gh api`, curl or a python script; and a GraphQL
createPullRequest / updatePullRequest. The body is read from `--input FILE`, `--body-file FILE` / `-F FILE`
(gh pr), `-F body=@FILE`, `-d @FILE`, or the command text itself; a body piped on stdin cannot be read, so
the command text is checked instead and fails closed.

This is a guard against honest mistakes, not a security boundary: `GH=gh; $GH pr create` gets past it. The CI job
"PR template filled" (same checker) is the backstop. A PR labelled no-issue (typo or link fix) is the only
bypass and it lives in CI, not here: write a short filled-in body anyway.
Added after PR #427 (2026-11-15) was opened by hand without the template or the review agents."""
import json
import os
import re
import subprocess
import sys

ROOT = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
sys.path.insert(0, os.path.join(ROOT, ".github", "scripts"))
try:
    from check_pr_template import check
except ImportError:  # the checker is missing: fail closed, say why
    print(f"PR guardrail: .github/scripts/check_pr_template.py cannot be imported from {ROOT}.", file=sys.stderr)
    sys.exit(2)

PULLS = re.compile(r"repos/[^\s'\"]+/pulls(/\d+)?(?=[\s'\"]|$)")
WRITES = re.compile(r"(-X\s*(POST|PATCH)|--method\s+(POST|PATCH)|\s-[fF]\s|--input\b|\s-d\s|--data\b)")
BODY_FILE_PATTERNS = (r"--input\s+(\S+)", r"--body-file\s+(\S+)", r"-F\s+body=@(\S+)", r"(?:-d|--data)\s+@(\S+)")


def segments(cmd: str) -> list[str]:
    """Command segments, each stripped of leading VAR=x assignments, `cd dir &&` and sudo/env/time."""
    out = []
    for seg in re.split(r"&&|\|\||[;|\n]", cmd):
        seg = seg.strip()
        while True:
            new = re.sub(r"^(\w+=\S*|sudo|env|time|command|exec)\s+", "", seg)
            if new == seg:
                break
            seg = new
        if seg and not re.match(r"^cd\s", seg):
            out.append(seg)
    return out


def classify(seg: str):
    """(kind, creating) for a segment that creates or edits a PR, else None."""
    m = re.match(r"gh\s+pr\s+(create|edit)\b", seg)
    if m:
        return "gh_pr", m.group(1) == "create"
    if re.match(r"gh\s+api\s+graphql\b", seg) and re.search(r"createPullRequest|updatePullRequest", seg):
        return "graphql", "createPullRequest" in seg
    if re.match(r"(gh\s+api|curl|python3?)\b", seg):
        ep = PULLS.search(seg)
        is_python = seg.startswith("python")
        wrote = WRITES.search(seg) or (is_python and re.search(r"post|patch", seg, re.IGNORECASE))
        if ep and wrote:
            return "api", not ep.group(1)
    return None


def body_text(seg: str, whole: str, kind: str) -> tuple[str, bool]:
    """The body text to check and whether the command carries a body at all."""
    text = seg
    has_body = bool(re.search(r"\bbody\b|--body|createPullRequest|updatePullRequest", seg))
    patterns = list(BODY_FILE_PATTERNS) + ([r"(?:^|\s)-F\s+(?!body=)(\S+)"] if kind == "gh_pr" else [])
    for pattern in patterns:
        for m in re.finditer(pattern, seg):
            path = m.group(1).strip("'\"")
            if path == "-":  # stdin (heredoc): the whole command holds it
                text, has_body = whole, True
                continue
            try:
                with open(path, encoding="utf-8") as fh:
                    raw = fh.read()
            except OSError:
                continue
            has_body = has_body or "--input" not in m.group(0) or bool(re.search(r'"body"\s*:', raw))
            try:
                raw = json.loads(raw).get("body", raw)
            except (ValueError, AttributeError):
                pass
            text += "\n" + str(raw)
    return text, has_body


def changed_files(session_cwd: str = "") -> list[str]:
    """Files this branch changes against main. Diffed in the session's own folder first (the hook input's `cwd`): in a
    worktree session CLAUDE_PROJECT_DIR is the main checkout, whose branch is not the one being opened as a PR (#508)."""
    folders = [d for d in (session_cwd, ROOT) if d and os.path.isdir(d)]
    for folder in dict.fromkeys(folders):
        for ref in ("origin/main...HEAD", "main...HEAD"):
            try:
                res = subprocess.run(["git", "diff", "--name-only", "--no-renames", ref], capture_output=True, text=True, timeout=20, cwd=folder, check=False)
            except (OSError, subprocess.SubprocessError):
                res = None
            if res is not None and res.returncode == 0:
                return res.stdout.split()
    print("PR guardrail warning: could not list changed files (no origin/main or main); the reviewer rules that depend on "
          "them are not checked here, CI will check them.", file=sys.stderr)
    return []


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except ValueError:  # not a tool event we understand: never block ordinary work on a parse problem
        return
    cmd = (data.get("tool_input") or {}).get("command", "") or ""
    problems: list[str] = []
    for seg in segments(cmd):
        found = classify(seg)
        if not found:
            continue
        kind, creating = found
        text, has_body = body_text(seg, cmd, kind)
        # A PATCH that only changes title, state or milestone carries no body and is fine; a create always needs one.
        if not creating and not has_body:
            continue
        body = text.replace("\\n", "\n").replace('\\"', '"')
        problems += check(body, changed_files(data.get("cwd") or ""))
    if problems:
        print("PR guardrail: this PR body is not the filled-in template (.github/pull_request_template.md; /ship-pr does it).", file=sys.stderr)
        for e in dict.fromkeys(problems):
            print(f"  - {e}", file=sys.stderr)
        print("Fix the body and retry. Do not weaken this check to get a PR through.", file=sys.stderr)
        sys.exit(2)


main()
