from decimal import Decimal

from tests.support import make_portfolio_csv

VALID_CSV = make_portfolio_csv(
    [
        "VAR.OL,Vår Energi,Aksje,1200,60,28.40,NOK,Energy,BlueNord merger thesis",
        "EQNR.OL,Equinor,Aksje,500,40,300,NOK,Energy,",
    ]
)


def test_upload_valid_portfolio_creates_snapshot_and_holdings(client):
    response = client.post(
        "/portfolio/upload",
        files={"file": ("portfolio.csv", VALID_CSV, "text/csv")},
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["snapshot"]["status"] == "VALIDATED"
    assert body["snapshot"]["reporting_currency"] == "NOK"
    assert len(body["snapshot"]["positions"]) == 2
    tickers = {p["ticker"] for p in body["snapshot"]["positions"]}
    assert tickers == {"VAR.OL", "EQNR.OL"}


def test_upload_with_missing_ticker_returns_422_with_row_errors(client):
    bad_csv = make_portfolio_csv([",Vår Energi,Aksje,1200,60,28.40,NOK,Energy,"])

    response = client.post(
        "/portfolio/upload",
        files={"file": ("portfolio.csv", bad_csv, "text/csv")},
    )

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["row_errors"][0]["row"] == 1


def test_unsupported_file_type_is_rejected(client):
    response = client.post(
        "/portfolio/upload",
        files={"file": ("portfolio.txt", b"not a real portfolio", "text/plain")},
    )
    assert response.status_code == 415


def test_snapshot_is_listed_and_retrievable(client):
    upload = client.post(
        "/portfolio/upload", files={"file": ("portfolio.csv", VALID_CSV, "text/csv")}
    )
    snapshot_id = upload.json()["snapshot"]["id"]

    listing = client.get("/portfolio/snapshots")
    assert listing.status_code == 200
    assert any(s["id"] == snapshot_id for s in listing.json())

    detail = client.get(f"/portfolio/snapshots/{snapshot_id}")
    assert detail.status_code == 200
    assert len(detail.json()["positions"]) == 2


def test_unknown_snapshot_returns_404(client):
    response = client.get("/portfolio/snapshots/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


def test_holdings_are_listed_after_upload(client):
    client.post("/portfolio/upload", files={"file": ("portfolio.csv", VALID_CSV, "text/csv")})

    response = client.get("/portfolio/holdings")
    assert response.status_code == 200
    tickers = {h["ticker"] for h in response.json()}
    assert tickers == {"VAR.OL", "EQNR.OL"}


def test_reuploading_identical_file_is_flagged_as_duplicate(client):
    first = client.post(
        "/portfolio/upload", files={"file": ("portfolio.csv", VALID_CSV, "text/csv")}
    )
    second = client.post(
        "/portfolio/upload", files={"file": ("portfolio.csv", VALID_CSV, "text/csv")}
    )

    assert first.json()["was_duplicate_file"] is False
    assert second.json()["was_duplicate_file"] is True
    # Re-upload still creates a new snapshot pointing at the same source file.
    assert first.json()["snapshot"]["id"] != second.json()["snapshot"]["id"]


def test_first_upload_reports_all_positions_as_new(client):
    response = client.post(
        "/portfolio/upload", files={"file": ("portfolio.csv", VALID_CSV, "text/csv")}
    )
    body = response.json()
    assert body["new_position_count"] == 2
    assert body["updated_position_count"] == 0
    assert body["carried_forward_position_count"] == 0


def test_second_upload_merges_onto_previous_snapshot(client):
    """A second upload adds to the current portfolio instead of replacing it:
    a ticker present in the new file is updated in place, a ticker absent
    from it is carried forward unchanged, and a brand-new ticker is added."""
    client.post("/portfolio/upload", files={"file": ("portfolio.csv", VALID_CSV, "text/csv")})

    second_csv = make_portfolio_csv(
        [
            # VAR.OL re-priced/re-weighted — should overwrite the first upload's row.
            "VAR.OL,Vår Energi,Aksje,1500,55,30.00,NOK,Energy,updated",
            # Brand-new ticker not present before.
            "MOWI.OL,Mowi,Aksje,300,45,150,NOK,Consumer,",
        ]
    )
    response = client.post(
        "/portfolio/upload", files={"file": ("portfolio.csv", second_csv, "text/csv")}
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["new_position_count"] == 1
    assert body["updated_position_count"] == 1
    assert body["carried_forward_position_count"] == 1

    positions = {p["ticker"]: p for p in body["snapshot"]["positions"]}
    assert set(positions) == {"VAR.OL", "EQNR.OL", "MOWI.OL"}
    assert float(positions["VAR.OL"]["quantity"]) == 1500  # overwritten
    assert float(positions["EQNR.OL"]["quantity"]) == 500  # carried forward unchanged
    assert any("merged with previous snapshot" in w for w in body["warnings"])


def test_reset_requires_confirmation(client):
    client.post("/portfolio/upload", files={"file": ("portfolio.csv", VALID_CSV, "text/csv")})

    unconfirmed = client.delete("/portfolio/reset")
    assert unconfirmed.status_code == 400

    # Nothing was deleted.
    assert len(client.get("/portfolio/snapshots").json()) == 1


def test_reset_wipes_all_portfolio_data(client):
    client.post("/portfolio/upload", files={"file": ("portfolio.csv", VALID_CSV, "text/csv")})

    response = client.delete("/portfolio/reset?confirm=true")
    assert response.status_code == 200
    body = response.json()
    assert body["holdings_deleted"] == 2
    assert body["snapshots_deleted"] == 1
    assert body["documents_deleted"] == 1

    assert client.get("/portfolio/snapshots").json() == []
    assert client.get("/portfolio/holdings").json() == []

    # A fresh upload afterward behaves like a first-ever upload again.
    fresh = client.post("/portfolio/upload", files={"file": ("portfolio.csv", VALID_CSV, "text/csv")})
    assert fresh.json()["new_position_count"] == 2
    assert fresh.json()["carried_forward_position_count"] == 0


# --- Regression: holdings.ticker used to be varchar(32) (Postgres-enforced,
# not caught by SQLite tests) — a Nordnet export with a long fund name as its
# instrument-name-as-ticker (see app.services.portfolio.parser) blew straight
# past that limit and raised StringDataRightTruncation. ------------------------

LONG_TICKER = "A" * 60  # well past the old 32-char limit


def test_upload_accepts_a_ticker_longer_than_the_old_32_char_limit(client):
    csv = make_portfolio_csv([f"{LONG_TICKER},Some Long Fund Name,Aksje,100,100,10,NOK,,"])

    response = client.post("/portfolio/upload", files={"file": ("portfolio.csv", csv, "text/csv")})

    assert response.status_code == 201, response.text
    positions = response.json()["snapshot"]["positions"]
    assert positions[0]["ticker"] == LONG_TICKER  # not truncated

    holdings = client.get("/portfolio/holdings").json()
    assert holdings[0]["ticker"] == LONG_TICKER


# --- Accounts (§26 accounts feature) ----------------------------------------


def _create_account(client, name: str, account_number: str) -> str:
    response = client.post("/accounts", json={"name": name, "account_number": account_number})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_upload_can_be_tagged_with_an_account(client):
    account_id = _create_account(client, "Aksje & fonds konto", "70541644")

    response = client.post(
        "/portfolio/upload",
        files={"file": ("portfolio.csv", VALID_CSV, "text/csv")},
        data={"account_id": account_id},
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["snapshot"]["account_id"] == account_id
    assert body["snapshot"]["account_name"] == "Aksje & fonds konto"
    for position in body["snapshot"]["positions"]:
        assert position["account_id"] == account_id


def test_upload_with_unknown_account_id_returns_404(client):
    response = client.post(
        "/portfolio/upload",
        files={"file": ("portfolio.csv", VALID_CSV, "text/csv")},
        data={"account_id": "00000000-0000-0000-0000-000000000000"},
    )
    assert response.status_code == 404


def test_same_instrument_in_two_accounts_stays_two_distinct_positions(client):
    """The merge key is (account_id, ticker), not ticker alone — otherwise
    uploading a second account's file that happens to hold the same
    instrument would silently collapse the first account's position."""
    account_a = _create_account(client, "ASK konto", "24175564")
    account_b = _create_account(client, "Ezra's ASK konto", "50911270")

    shared_position_csv = make_portfolio_csv(["SALM.OL,Salmon Evolution,Aksje,209,100,3.9588,NOK,,"])
    other_position_csv = make_portfolio_csv(["SALM.OL,Salmon Evolution,Aksje,522,100,4.0028,NOK,,"])

    client.post(
        "/portfolio/upload",
        files={"file": ("a.csv", shared_position_csv, "text/csv")},
        data={"account_id": account_a},
    )
    response = client.post(
        "/portfolio/upload",
        files={"file": ("b.csv", other_position_csv, "text/csv")},
        data={"account_id": account_b},
    )

    assert response.status_code == 201, response.text
    positions = response.json()["snapshot"]["positions"]
    salm_positions = [p for p in positions if p["ticker"] == "SALM.OL"]
    assert len(salm_positions) == 2
    by_account = {p["account_id"]: p for p in salm_positions}
    assert float(by_account[account_a]["quantity"]) == 209
    assert float(by_account[account_b]["quantity"]) == 522


def test_snapshots_and_holdings_can_be_filtered_by_account(client):
    account_a = _create_account(client, "ASK konto", "24175564")
    account_b = _create_account(client, "Ezra's ASK konto", "50911270")

    client.post(
        "/portfolio/upload",
        files={"file": ("a.csv", VALID_CSV, "text/csv")},
        data={"account_id": account_a},
    )
    only_b_csv = make_portfolio_csv(["MOWI.OL,Mowi,Aksje,300,100,150,NOK,,"])
    client.post(
        "/portfolio/upload",
        files={"file": ("b.csv", only_b_csv, "text/csv")},
        data={"account_id": account_b},
    )

    snapshots_a = client.get(f"/portfolio/snapshots?account_id={account_a}").json()
    assert len(snapshots_a) == 1
    assert snapshots_a[0]["account_id"] == account_a

    # Holdings filtering reflects the latest snapshot only (current picture).
    holdings_b = client.get(f"/portfolio/holdings?account_id={account_b}").json()
    assert {h["ticker"] for h in holdings_b} == {"MOWI.OL"}


def test_deleting_an_account_referenced_by_a_snapshot_is_blocked(client):
    account_id = _create_account(client, "Aksje & fonds konto", "70541644")
    client.post(
        "/portfolio/upload",
        files={"file": ("portfolio.csv", VALID_CSV, "text/csv")},
        data={"account_id": account_id},
    )

    response = client.delete(f"/accounts/{account_id}")
    assert response.status_code == 409


def test_accounts_crud(client):
    created = client.post(
        "/accounts", json={"name": "EPK Aktiv konto", "account_number": "73898066"}
    )
    assert created.status_code == 201
    account_id = created.json()["id"]

    duplicate = client.post(
        "/accounts", json={"name": "Duplicate", "account_number": "73898066"}
    )
    assert duplicate.status_code == 409

    listed = client.get("/accounts").json()
    assert any(a["id"] == account_id for a in listed)

    updated = client.patch(f"/accounts/{account_id}", json={"institution": "Nordnet"})
    assert updated.status_code == 200
    assert updated.json()["institution"] == "Nordnet"

    deleted = client.delete(f"/accounts/{account_id}")
    assert deleted.status_code == 204
    assert client.get("/accounts").json() == []


# --- Phase 8 (ADR 0011) — manual single-lot entry for alternative assets ---


def test_manual_holding_creates_a_new_holding_and_position(client):
    response = client.post(
        "/portfolio/holdings/manual",
        json={
            "ticker": "XAU-COIN-2026-09",
            "name": "1oz Gold Coin",
            "asset_class": "COMMODITY",
            "trading_currency": "USD",
            "quantity": "1",
            "cost_basis": "2450.00",
            "cost_basis_currency": "USD",
            "market_ticker": "XAU",
            "custody_type": "allocated_physical",
            "acquired_at": "2026-09-10T00:00:00Z",
            "notes": "bought at the local dealer",
        },
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["ticker"] == "XAU-COIN-2026-09"
    assert body["asset_class"] == "COMMODITY"
    assert Decimal(body["quantity"]) == Decimal("1")
    assert Decimal(body["cost_basis"]) == Decimal("2450.00")
    assert body["acquired_at"] is not None

    holdings = client.get("/portfolio/holdings").json()
    assert any(h["ticker"] == "XAU-COIN-2026-09" and h["market_ticker"] == "XAU" for h in holdings)


def test_manual_holding_rejects_ordinary_brokerage_asset_classes(client):
    response = client.post(
        "/portfolio/holdings/manual",
        json={
            "ticker": "VAR.OL",
            "name": "Vår Energi",
            "asset_class": "EQUITY",
            "trading_currency": "NOK",
            "quantity": "100",
        },
    )

    assert response.status_code == 422


def test_manual_holding_second_lot_of_same_ticker_adds_a_second_position(client):
    payload = {
        "ticker": "XAU-COIN-2026-09",
        "name": "1oz Gold Coin",
        "asset_class": "COMMODITY",
        "trading_currency": "USD",
        "quantity": "1",
        "cost_basis": "2450.00",
        "market_ticker": "XAU",
    }
    client.post("/portfolio/holdings/manual", json=payload)
    second = client.post(
        "/portfolio/holdings/manual",
        json={**payload, "quantity": "2", "cost_basis": "2500.00"},
    )
    assert second.status_code == 201

    snapshots = client.get("/portfolio/snapshots").json()
    manual_snapshots = [s for s in snapshots if s["position_count"] >= 2]
    assert len(manual_snapshots) == 1
    detail = client.get(f"/portfolio/snapshots/{manual_snapshots[0]['id']}").json()
    assert len(detail["positions"]) == 2


def test_manual_holding_with_unknown_account_is_rejected(client):
    response = client.post(
        "/portfolio/holdings/manual",
        json={
            "ticker": "XAU-COIN-2026-09",
            "name": "1oz Gold Coin",
            "asset_class": "COMMODITY",
            "trading_currency": "USD",
            "quantity": "1",
            "account_id": "00000000-0000-0000-0000-000000000000",
        },
    )

    assert response.status_code == 422


def test_manual_holding_collectible_with_no_market_ticker(client):
    response = client.post(
        "/portfolio/holdings/manual",
        json={
            "ticker": "WHISKY-001",
            "name": "Macallan 18",
            "asset_class": "COLLECTIBLE",
            "trading_currency": "GBP",
            "quantity": "1",
            "cost_basis": "150.00",
        },
    )

    assert response.status_code == 201, response.text
    assert response.json()["asset_class"] == "COLLECTIBLE"


def test_list_manual_holdings_returns_only_manual_entries(client):
    client.post(
        "/portfolio/holdings/manual",
        json={
            "ticker": "XAU-COIN-LIST-1",
            "name": "1oz Gold Coin",
            "asset_class": "COMMODITY",
            "trading_currency": "USD",
            "quantity": "1",
            "cost_basis": "2450.00",
            "cost_basis_currency": "USD",
            "market_ticker": "XAU",
        },
    )
    # An ordinary brokerage upload should never show up in this list.
    client.post("/portfolio/upload", files={"file": ("p.csv", VALID_CSV, "text/csv")})

    listed = client.get("/portfolio/holdings/manual").json()
    assert len(listed) == 1
    assert listed[0]["ticker"] == "XAU-COIN-LIST-1"


def test_update_manual_holding_fixes_a_wrong_currency(client):
    """Faiz's real scenario: "Holding currency" was changed to NOK but "Buy
    price currency" was left at its USD default, so the NOK amount he paid
    got stored (and would be FX-converted) as if it were USD. This is the
    correction path — PATCH .../holdings/manual/{id} fixing both after the
    fact, with no way to do this before this endpoint existed short of
    wiping all portfolio data."""
    created = client.post(
        "/portfolio/holdings/manual",
        json={
            "ticker": "XAU-COIN-FIX-1",
            "name": "1oz Gold Krugerrand",
            "asset_class": "COMMODITY",
            "trading_currency": "NOK",
            "quantity": "1",
            "cost_basis": "31000.00",
            "cost_basis_currency": "USD",  # the mistake: should have been NOK
            "market_ticker": "XAU",
        },
    ).json()
    holding_id = [h["id"] for h in client.get("/portfolio/holdings").json() if h["ticker"] == "XAU-COIN-FIX-1"][0]
    assert created["cost_basis_currency"] == "USD"

    fixed = client.patch(
        f"/portfolio/holdings/manual/{holding_id}",
        json={"cost_basis_currency": "NOK"},
    )
    assert fixed.status_code == 200, fixed.text
    body = fixed.json()
    assert body["cost_basis_currency"] == "NOK"
    assert Decimal(body["cost_basis"]) == Decimal("31000.00")  # untouched — only currency was wrong
    assert body["trading_currency"] == "NOK"  # untouched, wasn't part of this PATCH

    # Persisted, not just echoed back.
    listed = client.get("/portfolio/holdings/manual").json()
    assert listed[0]["cost_basis_currency"] == "NOK"


def test_update_manual_holding_partial_update_leaves_other_fields_alone(client):
    created = client.post(
        "/portfolio/holdings/manual",
        json={
            "ticker": "XAU-COIN-PARTIAL-1",
            "name": "1oz Gold Maple Leaf",
            "asset_class": "COMMODITY",
            "trading_currency": "NOK",
            "quantity": "1",
            "cost_basis": "31000.00",
            "cost_basis_currency": "NOK",
            "market_ticker": "XAU",
            "notes": "bought at the local dealer",
        },
    ).json()
    holding_id = [
        h["id"] for h in client.get("/portfolio/holdings").json() if h["ticker"] == "XAU-COIN-PARTIAL-1"
    ][0]

    updated = client.patch(f"/portfolio/holdings/manual/{holding_id}", json={"quantity": "2"})
    assert updated.status_code == 200, updated.text
    body = updated.json()
    assert Decimal(body["quantity"]) == Decimal("2")
    assert Decimal(body["cost_basis"]) == Decimal("31000.00")
    assert body["notes"] == "bought at the local dealer"
    assert created["ticker"] == body["ticker"]


def test_update_manual_holding_404_for_unknown_or_non_manual_holding(client):
    client.post("/portfolio/upload", files={"file": ("p.csv", VALID_CSV, "text/csv")})
    ordinary_holding_id = client.get("/portfolio/holdings").json()[0]["id"]

    unknown = client.patch(
        "/portfolio/holdings/manual/00000000-0000-0000-0000-000000000000",
        json={"quantity": "2"},
    )
    assert unknown.status_code == 404

    not_manual = client.patch(f"/portfolio/holdings/manual/{ordinary_holding_id}", json={"quantity": "2"})
    assert not_manual.status_code == 404


def test_update_manual_holding_rejects_bad_currency_code(client):
    created = client.post(
        "/portfolio/holdings/manual",
        json={
            "ticker": "XAU-COIN-BADCCY-1",
            "name": "1oz Gold Coin",
            "asset_class": "COMMODITY",
            "trading_currency": "USD",
            "quantity": "1",
        },
    ).json()
    holding_id = [
        h["id"] for h in client.get("/portfolio/holdings").json() if h["ticker"] == "XAU-COIN-BADCCY-1"
    ][0]
    assert created["ticker"] == "XAU-COIN-BADCCY-1"

    response = client.patch(
        f"/portfolio/holdings/manual/{holding_id}", json={"trading_currency": "N"}
    )
    assert response.status_code == 422
