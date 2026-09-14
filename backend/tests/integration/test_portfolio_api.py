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
