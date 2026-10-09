"""PreToolUse hook: refuse in-place edits of an existing prompt/schema version (Rule 3).
New files (v2.md) pass; editing an existing tracked backend/prompts/** file exits 2 with a reason."""
import json, subprocess, sys
data = json.load(sys.stdin)
path = (data.get("tool_input") or {}).get("file_path", "").replace("\\", "/")
if "/backend/prompts/" in path:
    tracked = subprocess.run(["git", "ls-files", "--error-unmatch", path], capture_output=True).returncode == 0
    if tracked:
        print("Rule 3: prompts/schemas are versioned. Create a new vN+1 file instead of editing a used version.", file=sys.stderr)
        sys.exit(2)
