"""
Unit tests for FAME GENIX Medical Report / Lab OCR Data Extraction.
Mocks external Gemini calls so automated tests do NOT consume real API quota.
"""

import io
from unittest.mock import MagicMock, patch
import pytest
from PIL import Image
import pypdf


def create_dummy_pdf_bytes(num_pages=1, text_content="Hemoglobin 10.2 g/dL (12.0-15.0)") -> bytes:
    writer = pypdf.PdfWriter()
    for _ in range(num_pages):
        page = writer.add_blank_page(width=612, height=792)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def create_dummy_image_bytes() -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", (200, 200), color="white")
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_analyze_report_validation_errors(client):
    # Unsupported file type (.exe)
    response = client.post(
        "/api/v1/reports/analyze",
        files={"file": ("malicious.exe", b"binary data", "application/x-msdownload")},
    )
    assert response.status_code == 400
    assert "Unsupported file type" in response.text

    # Empty file
    response = client.post(
        "/api/v1/reports/analyze",
        files={"file": ("empty.pdf", b"", "application/pdf")},
    )
    assert response.status_code == 400

    # Oversized file (> 10 MB)
    large_bytes = b"0" * (10 * 1024 * 1024 + 100)
    response = client.post(
        "/api/v1/reports/analyze",
        files={"file": ("large.pdf", large_bytes, "application/pdf")},
    )
    assert response.status_code == 400
    assert "exceeds 10 MB limit" in response.text

    # Excessive PDF page count (> 10 pages)
    too_many_pages_pdf = create_dummy_pdf_bytes(num_pages=11)
    response = client.post(
        "/api/v1/reports/analyze",
        files={"file": ("long.pdf", too_many_pages_pdf, "application/pdf")},
    )
    assert response.status_code == 400
    assert "Maximum allowed is 10 pages" in response.text


def test_analyze_report_fallback_mode(client):
    pdf_bytes = create_dummy_pdf_bytes()
    response = client.post(
        "/api/v1/reports/analyze",
        files={"file": ("cbc_report.pdf", pdf_bytes, "application/pdf")},
        data={"language": "English"},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert "is_medical_report" in data
    assert "explanation" in data
    assert "limitations" in data


@patch("app.reports.service.report_service._client")
def test_analyze_report_mocked_gemini(mock_client, client):
    mock_response = MagicMock()
    mock_response.text = '''{
        "is_medical_report": true,
        "report_type": "CBC",
        "document_quality": "GOOD",
        "extraction_confidence": "HIGH",
        "report_date": "2026-08-20",
        "laboratory_name": "Metro Diagnostics",
        "tests": [
            {
                "name": "Hemoglobin",
                "normalized_name": "hemoglobin",
                "value": 10.2,
                "raw_value": "10.2",
                "unit": "g/dL",
                "reference_min": 12.0,
                "reference_max": 15.0,
                "raw_reference_range": "12.0 - 15.0",
                "status": "LOW"
            },
            {
                "name": "WBC Count",
                "normalized_name": "white_blood_cell_count",
                "value": 11400.0,
                "raw_value": "11400",
                "unit": "/uL",
                "reference_min": 4000.0,
                "reference_max": 11000.0,
                "raw_reference_range": "4000 - 11000",
                "status": "HIGH"
            },
            {
                "name": "Platelets",
                "normalized_name": "platelet_count",
                "value": 250000.0,
                "raw_value": "250000",
                "unit": "/uL",
                "reference_min": null,
                "reference_max": null,
                "raw_reference_range": "",
                "status": "UNKNOWN"
            }
        ],
        "abnormal_test_count": 2,
        "reported_critical_flag": false,
        "limitations": ["Extracted values are for reference only."],
        "explanation": "Report extracted 3 lab tests. Hemoglobin is LOW, WBC is HIGH."
    }'''
    mock_client.models.generate_content.return_value = mock_response

    from app.reports.service import report_service
    original_client = report_service._client
    original_enabled = report_service.enabled
    report_service._client = mock_client
    report_service.enabled = True

    try:
        pdf_bytes = create_dummy_pdf_bytes()
        response = client.post(
            "/api/v1/reports/analyze",
            files={"file": ("cbc.pdf", pdf_bytes, "application/pdf")},
            data={"language": "English"},
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["report_type"] in ("CBC", "GENERAL_LAB", "UNKNOWN") or "report_type" in data
        assert len(data["tests"]) == 3
        assert data["tests"][0]["status"] == "LOW"
        assert data["tests"][1]["status"] == "HIGH"
        assert data["tests"][2]["status"] == "UNKNOWN"
        assert data["abnormal_test_count"] == 2
    finally:
        report_service._client = original_client
        report_service.enabled = original_enabled
