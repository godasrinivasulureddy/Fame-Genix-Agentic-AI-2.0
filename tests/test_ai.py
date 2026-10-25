"""
Unit tests for FAME GENIX Gemini AI Integration Foundation & Fallback.
Mocks external Gemini API calls so tests do NOT consume real API quota.
"""

from unittest.mock import MagicMock, patch
import pytest


def test_ai_status_endpoint(client):
    response = client.get("/api/v1/ai/status")
    assert response.status_code == 200
    data = response.json()["data"]
    assert "enabled" in data
    assert "provider" in data
    assert data["provider"] == "Gemini"
    assert "configured" in data
    assert "reachable" in data


def test_symptom_extract_fallback(client):
    # Test deterministic fallback when AI is unconfigured or disabled
    response = client.post(
        "/api/v1/ai/symptoms/extract",
        json={"text": "I have fever and chest pain since yesterday", "language": "en"},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["original_text"] == "I have fever and chest pain since yesterday"
    assert "source" in data
    # Concepts extracted deterministically
    symptom_names = [s["name"] for s in data["symptoms"]]
    assert "fever" in symptom_names or "chest_pain" in symptom_names


def test_assessment_explain_fallback(client):
    # Test assessment explanation fallback
    payload = {
        "risk_score": 64.0,
        "confidence_score": 85.0,
        "care_level": "PRIORITY_REVIEW",
        "top_factors": ["SpO2 deviation", "increased heart rate"],
        "language": "English",
    }
    response = client.post("/api/v1/ai/assessment/explain", json=payload)
    assert response.status_code == 200
    data = response.json()["data"]
    assert any(term in data["suggested_specialty"] for term in ["Pulmonolog", "Cardiolog", "General Medicine"])
    assert "explanation" in data
    assert "requires_professional_review" in data
    assert data["requires_professional_review"] is True


def test_ai_chat_fallback(client):
    from tests.conftest import register, auth_headers
    token = register(client, "chat_user@test.com", "PATIENT")
    payload = {
        "message": "Why is my risk score elevated?",
        "care_level": "STABLE",
        "risk_score": 20.0,
        "top_factors": ["mild fatigue"],
        "language": "English",
    }
    response = client.post("/api/v1/ai/chat", json=payload, headers=auth_headers(token))
    assert response.status_code == 200
    data = response.json()["data"]
    assert "message" in data
    assert data["safety_level"] == "NORMAL"


@patch("app.ai.service.ai_service._client")
def test_ai_extract_mocked_gemini(mock_client, client):
    # Mock Gemini Client response to test AI branch without consuming quota
    mock_response = MagicMock()
    mock_response.text = '{"original_text": "fever and headache", "detected_language": "English", "symptoms": [{"name": "fever", "severity": 7, "duration_hours": 24}], "red_flag_phrases": [], "missing_information": ["temperature"]}'
    mock_client.models.generate_content.return_value = mock_response

    # Temporarily force enabled and client present
    from app.ai.service import ai_service
    original_client = ai_service._client
    original_enabled = ai_service.enabled
    ai_service._client = mock_client
    ai_service.enabled = True

    try:
        response = client.post(
            "/api/v1/ai/symptoms/extract",
            json={"text": "fever and headache", "language": "English"},
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["source"] == "AI_GEMINI"
        assert len(data["symptoms"]) == 1
        assert data["symptoms"][0]["name"] == "fever"
    finally:
        ai_service._client = original_client
        ai_service.enabled = original_enabled
