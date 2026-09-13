from app.domain.financial_metrics import match_metric


def test_matches_known_english_labels():
    assert match_metric("Revenue") == "revenue"
    assert match_metric("Net income") == "net_income"
    assert match_metric("Total assets") == "total_assets"


def test_matches_known_norwegian_labels():
    assert match_metric("Driftsinntekter") == "revenue"
    assert match_metric("Årsresultat") == "net_income"
    assert match_metric("Sum eiendeler") == "total_assets"


def test_is_case_and_whitespace_insensitive():
    assert match_metric("  REVENUE  ") == "revenue"
    assert match_metric("net    income") == "net_income"


def test_unmatched_label_returns_none_rather_than_guessing():
    assert match_metric("Some Random Row Label") is None
    assert match_metric("") is None
    assert match_metric(None) is None
