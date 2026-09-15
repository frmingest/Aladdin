from app.domain.asset_class import AssetClass, normalize_asset_class


def test_recognizes_norwegian_and_english_labels():
    assert normalize_asset_class("Aksje") == AssetClass.EQUITY
    assert normalize_asset_class("equity") == AssetClass.EQUITY
    assert normalize_asset_class("ETF") == AssetClass.ETF
    assert normalize_asset_class("Fond") == AssetClass.FUND
    assert normalize_asset_class("Cash") == AssetClass.CASH


def test_is_case_and_whitespace_insensitive():
    assert normalize_asset_class("  AKSJE  ") == AssetClass.EQUITY


def test_unknown_label_maps_to_other_rather_than_raising():
    assert normalize_asset_class("Cryptocurrency") == AssetClass.OTHER


def test_none_maps_to_other():
    assert normalize_asset_class(None) == AssetClass.OTHER


def test_recognizes_phase8_commodity_labels():
    """ADR 0011 — physical precious metals get their own asset class rather
    than falling into OTHER."""
    assert normalize_asset_class("Commodity") == AssetClass.COMMODITY
    assert normalize_asset_class("gold") == AssetClass.COMMODITY
    assert normalize_asset_class("Silver") == AssetClass.COMMODITY
    assert normalize_asset_class("precious metal") == AssetClass.COMMODITY


def test_recognizes_phase8_collectible_labels():
    """ADR 0011 — a whisky collection (or other collectible) gets its own
    asset class rather than falling into OTHER."""
    assert normalize_asset_class("Collectible") == AssetClass.COLLECTIBLE
    assert normalize_asset_class("whisky") == AssetClass.COLLECTIBLE
    assert normalize_asset_class("Whiskey") == AssetClass.COLLECTIBLE
