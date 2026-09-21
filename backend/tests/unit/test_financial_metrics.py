from app.domain.financial_metrics import match_metric


def test_matches_known_english_labels_case_and_whitespace_insensitive():
    assert match_metric("Revenue") == "revenue"
    assert match_metric("  Total   Revenue ") == "revenue"
    assert match_metric("NET SALES") == "revenue"


def test_matches_known_norwegian_labels():
    assert match_metric("Driftsinntekter") == "revenue"
    assert match_metric("Sum egenkapital") == "total_equity"
    assert match_metric("Rentekostnader") == "interest_expense"


def test_unrecognized_label_returns_none_rather_than_guessing():
    assert match_metric("Some made up line item") is None
    assert match_metric("") is None
    assert match_metric(None) is None
