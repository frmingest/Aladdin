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


def test_matches_new_balance_sheet_health_labels():
    """Added for the Buffett/Munger redesign (2026-09-20) -- Step 2's
    balance-sheet-health/owner-earnings ratios need these four metrics
    extractable from XLSX facts. See
    claude/buffett-munger-redesign-sprint-plan-2026-09-20.md."""
    assert match_metric("Total debt") == "total_debt"
    assert match_metric("Cash and cash equivalents") == "cash_and_equivalents"
    assert match_metric("Capital expenditures") == "capital_expenditures"
    assert match_metric("Interest expense") == "interest_expense"


def test_matches_new_balance_sheet_health_norwegian_labels():
    assert match_metric("Rentekostnader") == "interest_expense"
    assert match_metric("Kontanter og kontantekvivalenter") == "cash_and_equivalents"
