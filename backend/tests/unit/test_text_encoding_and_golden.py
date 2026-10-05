"""Safety net for the ESEF reader (2026-10-05).

1. A mis-decoded copy of a Norwegian filing ("Ã¸" for "ø") is flagged.
2. Golden figures: the FY2025 annual reports of Aker BP, Orkla, Salmon
   Evolution and Subsea 7 were read by hand; the printed identities below
   (numbers only, no filing committed) must hold for the numbers the app
   stores. Any future change to the extractor's arithmetic or the metrics
   layer that breaks one of these identities fails here."""
from decimal import Decimal

from app.services.documents.extraction.ixbrl import extract_ixbrl, looks_mojibake
from app.services.metrics import compute_holding_metrics, owner_earnings_from_facts
from tests.unit.test_extraction_ixbrl import BALANCE, INCOME, _filing

D = Decimal
M = D(1_000_000)


def test_mis_decoded_norwegian_text_is_detected():
    assert looks_mojibake(["Ã¸rsta Ã¥rsrapport â€™ Ã¦ Ã¸ Ã¥"])
    assert not looks_mojibake(["Årsrapport for Ørsta, 2025: ø å æ — and ’quoted’"])
    assert not looks_mojibake(["One stray Ã¸ is not enough"])


def test_a_filing_with_mis_decoded_text_is_flagged():
    text = "<div><p>" + "Ã¸ " * 5 + "</p></div>"
    flagged = extract_ixbrl(_filing(INCOME, BALANCE, extra_pages=text))
    assert "text_encoding_suspect" in flagged.quality_flags
    assert "text_encoding_suspect" not in extract_ixbrl(_filing(INCOME, BALANCE)).quality_flags


# --- golden figures (printed in the FY2025 reports, hand-checked 2026-10-05) -------------------------
def test_orkla_profit_walk_and_owner_view():
    # EBIT 7 086 + associates 2 181 + finance items = PBT 8 379; less tax 1 442 = 6 937 continuing;
    # + discontinued 5 120 = 12 057; less minorities 584 = 11 473 to the owners.
    assert D(8_379) - D(1_442) == D(6_937)
    assert D(6_937) + D(5_120) == D(12_057)
    assert D(12_057) - D(584) == D(11_473)
    facts = {
        "net_income": 11_473 * M,
        "profit_discontinued_operations": 5_120 * M,
        "depreciation_and_amortization": 2_732 * M,
        "capital_expenditures": 2_551 * M,
        "lease_payments_financing": 722 * M,
    }
    value, _ = owner_earnings_from_facts(facts)
    assert value == (6_353 + 2_732 - 2_551 - 722) * M  # 5 812m, not the 10 932m of reported profit


def test_orkla_equity_is_counted_once():
    facts = {
        "total_debt": 16_742 * M,
        "cash_and_equivalents": 2_044 * M,
        "total_equity": 48_664 * M,  # owners' (52 147 - 3 483 minorities)
        "minority_interests": 3_483 * M,
        "ebit": 7_086 * M,
    }
    result = compute_holding_metrics(facts)
    assert 48_664 + 3_483 == 52_147
    assert "incl. minority interests" in result.notes["roce"]
    assert result.computed["roce"] == (7_086 * M) / ((16_742 + 48_664 + 3_483 - 2_044) * M)


def test_subsea7_free_cash_flow_is_after_lease_cash():
    # Printed: operating cash flow 1 470.7 (after tax), capex 281.0, lease principal 266.8, lease interest 25.1.
    facts = {
        "operating_cash_flow": D("1470.7") * M,
        "capital_expenditures": 281 * M,
        "lease_payments_financing": D("266.8") * M,
        "interest_paid_financing": D("25.1") * M,
    }
    assert compute_holding_metrics(facts).computed["free_cash_flow"] == D("897.8") * M
    assert D("1470.7") - D("213.6") - D("873.8") == D("383.3")  # change in cash, ties to 969.7 - 586.4


def test_aker_bp_net_income_is_what_survives_a_97_percent_tax_rate():
    assert D("4607.1") - D("4474.8") == D("132.3")
    flags = compute_holding_metrics(
        {"income_before_tax": D("4607.1") * M, "income_tax_expense": D("4474.8") * M, "net_income": D("132.3") * M}
    ).warnings
    assert any("Effective tax rate is 97.1%" in w for w in flags)


def test_salmon_evolution_loss_stays_a_loss():
    # Printed: revenue 326.0, loss before and after tax -171.6 (no tax). A loss is
    # shown as a negative margin, never skipped or turned positive.
    result = compute_holding_metrics({"net_income": D("-171.6") * M, "revenue": D("326.0") * M})
    assert result.computed["net_margin"] == D("-171.6") / D("326.0")
