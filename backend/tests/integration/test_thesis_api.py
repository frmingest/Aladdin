"""Integration tests for the Phase 5 thesis-ledger endpoints (architecture §16)."""

from tests.support import make_portfolio_csv

VALID_CSV = make_portfolio_csv(
    ["VAR.OL,Vår Energi,Aksje,1200,100,28.40,NOK,Energy,Long-term conviction holding"]
)


def _upload_holding_id(client) -> str:
    upload = client.post("/portfolio/upload", files={"file": ("portfolio.csv", VALID_CSV, "text/csv")})
    return upload.json()["snapshot"]["positions"][0]["holding_id"]


def test_create_and_get_thesis(client):
    holding_id = _upload_holding_id(client)

    response = client.post(
        f"/thesis/holdings/{holding_id}",
        json={
            "thesis": "Durable moat in a niche market.",
            "bull_case": "Volume growth outpaces cost inflation.",
            "bear_case": "New entrant compresses margins.",
            "key_assumptions": ["10% revenue CAGR"],
            "invalidation_conditions": ["Margin falls below 15%"],
            "confidence": "high",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "ACTIVE"
    assert body["holding_id"] == holding_id
    assert body["key_assumptions"] == ["10% revenue CAGR"]

    fetched = client.get(f"/thesis/{body['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["thesis"] == "Durable moat in a niche market."


def test_create_thesis_unknown_holding_returns_404(client):
    response = client.post(
        "/thesis/holdings/00000000-0000-0000-0000-000000000000",
        json={"thesis": "X"},
    )
    assert response.status_code == 404


def test_patch_thesis_updates_supplied_fields_only(client):
    holding_id = _upload_holding_id(client)
    created = client.post(f"/thesis/holdings/{holding_id}", json={"thesis": "Original."}).json()

    patched = client.patch(f"/thesis/{created['id']}", json={"status": "UNDER_REVIEW"})
    assert patched.status_code == 200
    assert patched.json()["status"] == "UNDER_REVIEW"
    assert patched.json()["thesis"] == "Original."


def test_patch_thesis_unknown_status_returns_422(client):
    holding_id = _upload_holding_id(client)
    created = client.post(f"/thesis/holdings/{holding_id}", json={"thesis": "Original."}).json()

    response = client.patch(f"/thesis/{created['id']}", json={"status": "NOT_REAL"})
    assert response.status_code == 422


def test_list_theses_for_holding_returns_full_ledger(client):
    holding_id = _upload_holding_id(client)
    client.post(f"/thesis/holdings/{holding_id}", json={"thesis": "First take."})
    client.post(f"/thesis/holdings/{holding_id}", json={"thesis": "Revised take."})

    response = client.get(f"/thesis/holdings/{holding_id}")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_invalidation_check_with_no_analysis_yet(client):
    holding_id = _upload_holding_id(client)
    created = client.post(f"/thesis/holdings/{holding_id}", json={"thesis": "X"}).json()

    response = client.get(f"/thesis/{created['id']}/invalidation-check")
    assert response.status_code == 200
    body = response.json()
    assert body["has_signal"] is False
    assert "no completed analysis run" in body["reasons"][0]


def test_get_unknown_thesis_returns_404(client):
    response = client.get("/thesis/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
