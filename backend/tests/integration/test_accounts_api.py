"""End-to-end tests for the accounts CRUD API (app/api/accounts.py)."""
from __future__ import annotations


def _create(client, account_number="ACC-001", **overrides):
    payload = {"name": "Nordnet ASK", "account_number": account_number, "institution": "Nordnet"}
    payload.update(overrides)
    return client.post("/accounts", json=payload)


def test_create_account(client):
    response = _create(client)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["account_number"] == "ACC-001"
    assert body["position_count"] == 0
    assert body["snapshot_count"] == 0


def test_create_account_duplicate_number_is_rejected(client):
    assert _create(client).status_code == 201
    assert _create(client).status_code == 409


def test_list_accounts(client):
    _create(client, account_number="ACC-001", name="Nordnet ASK")
    _create(client, account_number="ACC-002", name="DNB Aksjesparekonto")
    response = client.get("/accounts")
    assert response.status_code == 200
    assert sorted(a["account_number"] for a in response.json()) == ["ACC-001", "ACC-002"]


def test_get_account(client):
    created = _create(client).json()
    response = client.get(f"/accounts/{created['id']}")
    assert response.status_code == 200
    assert response.json()["name"] == "Nordnet ASK"


def test_get_missing_account_returns_404(client):
    response = client.get("/accounts/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


def test_update_account(client):
    created = _create(client).json()
    response = client.patch(f"/accounts/{created['id']}", json={"institution": "DNB"})
    assert response.status_code == 200
    assert response.json()["institution"] == "DNB"
    assert response.json()["account_number"] == "ACC-001"


def test_delete_account_requires_confirm(client):
    created = _create(client).json()
    assert client.delete(f"/accounts/{created['id']}").status_code == 400
    assert client.get(f"/accounts/{created['id']}").status_code == 200


def test_delete_account_with_confirm(client):
    created = _create(client).json()
    response = client.delete(f"/accounts/{created['id']}", params={"confirm": "true"})
    assert response.status_code == 204
    assert client.get(f"/accounts/{created['id']}").status_code == 404
