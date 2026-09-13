"""
Regression test for the versioned LLM output contract (architecture §12:
"the exact production schema should be maintained as a versioned contract").

schemas/versions/analysis_output_v1.json is meant to always match
HoldingAnalysisOutput.model_json_schema() exactly — this test fails loudly
the moment someone changes the pydantic model without regenerating the
checked-in file, which is the whole point of versioning it explicitly
(§2.4) rather than letting the "contract" silently drift from the code that
actually enforces it.

Regenerate the file after a deliberate schema change with:

    python -c "
    import json
    from app.schemas.analysis import HoldingAnalysisOutput
    schema = HoldingAnalysisOutput.model_json_schema()
    with open('../schemas/versions/analysis_output_v1.json', 'w') as f:
        json.dump(schema, f, indent=2, sort_keys=True)
        f.write('\n')
    "

and bump to a new versions/v2.json (plus settings.active_prompt_version /
a new AnalysisRun using it) rather than overwriting v1 once any
analysis_runs row references it (§28 rule 9).
"""

import json

from app.config.paths import SCHEMAS_DIR
from app.schemas.analysis import HoldingAnalysisOutput


def test_analysis_output_v1_json_matches_pydantic_model():
    path = SCHEMAS_DIR / "versions" / "analysis_output_v1.json"
    assert path.exists(), "schemas/versions/analysis_output_v1.json is missing"

    checked_in = json.loads(path.read_text(encoding="utf-8"))
    current = json.loads(json.dumps(HoldingAnalysisOutput.model_json_schema(), sort_keys=True))
    checked_in_sorted = json.loads(json.dumps(checked_in, sort_keys=True))

    assert checked_in_sorted == current, (
        "schemas/versions/analysis_output_v1.json has drifted from "
        "HoldingAnalysisOutput — regenerate it (see this test's docstring) "
        "or, if the contract itself is meant to change, add a new "
        "versions/v2.json instead of editing v1 in place (§28 rule 9)."
    )
