from tests.support import make_pdf, make_pptx, make_portfolio_csv, make_xlsx

VALID_CSV = make_portfolio_csv(["VAR.OL,Vår Energi,Aksje,1200,100,28.40,NOK,Energy,"])


def _create_holding(client) -> str:
    upload = client.post(
        "/portfolio/upload", files={"file": ("portfolio.csv", VALID_CSV, "text/csv")}
    )
    return upload.json()["snapshot"]["positions"][0]["holding_id"]


def test_upload_document_for_unknown_holding_returns_404(client):
    response = client.post(
        "/documents/upload",
        data={"holding_id": "00000000-0000-0000-0000-000000000000", "document_type": "OTHER"},
        files={"file": ("deck.pptx", make_pptx([("Slide 1", None)]), "application/vnd.ms-powerpoint")},
    )
    assert response.status_code == 404


def test_upload_pdf_report_extracts_pages(client):
    holding_id = _create_holding(client)
    content = make_pdf(["Annual report page one", "Annual report page two"])

    response = client.post(
        "/documents/upload",
        data={"holding_id": holding_id, "document_type": "ANNUAL_REPORT", "reporting_period": "FY2025"},
        files={"file": ("annual_report.pdf", content, "application/pdf")},
    )

    assert response.status_code == 201, response.text
    document = response.json()["document"]
    assert document["status"] == "PROCESSED"
    assert document["page_count"] == 2
    assert document["holding_id"] == holding_id
    assert document["reporting_period"] == "FY2025"


def test_upload_pptx_extracts_slide_text_and_notes(client):
    holding_id = _create_holding(client)
    content = make_pptx([("Q4 highlights", "Growth accelerated in Q4")])

    response = client.post(
        "/documents/upload",
        data={"holding_id": holding_id, "document_type": "PRESENTATION"},
        files={"file": ("deck.pptx", content, "application/vnd.openxmlformats-officedocument.presentationml.presentation")},
    )

    assert response.status_code == 201, response.text
    detail = client.get(f"/documents/{response.json()['document']['id']}").json()
    assert "Q4 highlights" in detail["pages"][0]["text_preview"]
    assert "Growth accelerated" in detail["pages"][0]["text_preview"]


def test_upload_xlsx_extracts_recognized_financial_line_items(client):
    holding_id = _create_holding(client)
    content = make_xlsx(
        {
            "Financials": [
                ["Metric", "FY2024", "FY2025"],
                ["Revenue", 1000, 1200],
                ["Some Unrecognized Row", 5, 6],
            ]
        }
    )

    response = client.post(
        "/documents/upload",
        data={"holding_id": holding_id, "document_type": "ANNUAL_REPORT", "reporting_period": "FY2025"},
        files={
            "file": (
                "financials.xlsx",
                content,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert response.status_code == 201, response.text
    document = response.json()["document"]
    assert document["fact_count"] == 2  # Revenue x 2 periods; unrecognized row is skipped

    facts = {(f["metric"], f["period"]): float(f["value"]) for f in document["facts"]}
    assert facts[("revenue", "FY2024")] == 1000
    assert facts[("revenue", "FY2025")] == 1200


def test_documents_are_listed_and_filterable_by_holding(client):
    holding_id = _create_holding(client)
    client.post(
        "/documents/upload",
        data={"holding_id": holding_id, "document_type": "OTHER"},
        files={"file": ("deck.pptx", make_pptx([("hi", None)]), "application/vnd.ms-powerpoint")},
    )

    response = client.get("/documents", params={"holding_id": holding_id})
    assert response.status_code == 200
    assert len(response.json()) == 1

    empty = client.get(
        "/documents", params={"holding_id": "00000000-0000-0000-0000-000000000000"}
    )
    assert empty.json() == []


def test_reuploading_identical_document_is_flagged_duplicate_and_not_reprocessed(client):
    holding_id = _create_holding(client)
    content = make_pdf(["same content"])

    first = client.post(
        "/documents/upload",
        data={"holding_id": holding_id, "document_type": "OTHER"},
        files={"file": ("report.pdf", content, "application/pdf")},
    )
    second = client.post(
        "/documents/upload",
        data={"holding_id": holding_id, "document_type": "OTHER"},
        files={"file": ("report.pdf", content, "application/pdf")},
    )

    assert first.json()["was_duplicate_file"] is False
    assert second.json()["was_duplicate_file"] is True
    assert first.json()["document"]["id"] == second.json()["document"]["id"]
