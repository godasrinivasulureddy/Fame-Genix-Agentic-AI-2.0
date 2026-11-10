"""
Unit tests for FAME GENIX Image Input & Multimodal AI Analysis.
Mocks external Gemini Vision API calls so tests do NOT consume real API quota.
"""

import io
from unittest.mock import MagicMock, patch
import pytest
from PIL import Image


def create_dummy_image_bytes(format="PNG", color="red", size=(100, 100)) -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=color)
    img.save(buf, format=format)
    return buf.getvalue()


def test_analyze_image_validation_errors(client):
    # Unsupported file type test (.txt)
    response = client.post(
        "/api/v1/images/analyze",
        files={"file": ("test.txt", b"plain text content", "text/plain")},
    )
    assert response.status_code == 400
    assert "Unsupported image format" in response.text

    # Empty file test
    response = client.post(
        "/api/v1/images/analyze",
        files={"file": ("empty.png", b"", "image/png")},
    )
    assert response.status_code == 400

    # Oversized file test (> 5 MB)
    large_bytes = b"0" * (5 * 1024 * 1024 + 100)
    response = client.post(
        "/api/v1/images/analyze",
        files={"file": ("large.png", large_bytes, "image/png")},
    )
    assert response.status_code == 400
    assert "exceeds 5 MB limit" in response.text


def test_analyze_image_fallback_mode(client):
    # Test fallback when Gemini Vision is disabled or unconfigured
    img_bytes = create_dummy_image_bytes()
    response = client.post(
        "/api/v1/images/analyze",
        files={"file": ("skin_rash.png", img_bytes, "image/png")},
        data={"text_context": "Red rash on forearm", "language": "English"},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert "is_health_related" in data
    assert "explanation" in data
    assert "limitations" in data


@patch("app.images.service.image_service._client")
def test_analyze_image_mocked_gemini(mock_client, client):
    mock_response = MagicMock()
    mock_response.text = '''{
        "is_health_related": true,
        "is_medical_document": false,
        "image_quality": "ADEQUATE",
        "body_area": "forearm",
        "visual_findings": [{"finding": "localized redness", "severity": "mild", "location": "forearm"}],
        "red_flag_visual_signals": [],
        "possible_visual_categories": ["skin irritation pattern"],
        "limitations": ["Visual appearance alone cannot determine the cause."],
        "recommended_next_input": ["duration", "itching"],
        "explanation": "Observed mild localized redness on forearm."
    }'''
    mock_client.models.generate_content.return_value = mock_response

    from app.images.service import image_service
    original_client = image_service._client
    original_enabled = image_service.enabled
    image_service._client = mock_client
    image_service.enabled = True

    try:
        img_bytes = create_dummy_image_bytes()
        response = client.post(
            "/api/v1/images/analyze",
            files={"file": ("rash.png", img_bytes, "image/png")},
            data={"text_context": "Itchy arm", "language": "English"},
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["source"] in ("AI_GEMINI_VISION", "AI_NVIDIA_SUPERVL")
        assert data["body_area"] == "forearm"
        assert len(data["visual_findings"]) == 1
        assert data["visual_findings"][0]["finding"] == "localized redness"
    finally:
        image_service._client = original_client
        image_service.enabled = original_enabled
