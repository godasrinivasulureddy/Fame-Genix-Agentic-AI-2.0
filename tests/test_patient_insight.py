import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from tests.conftest import auth_headers, register


def _patient_token(client):
    return register(client, "insight-patient@famegenix.org", "PATIENT", "Insight Patient")


def test_patient_insight_guidance_only(client):
    token = _patient_token(client)
    payload = {
        "risk_score": 64.0,
        "confidence_score": 78.0,
        "care_level": "PRIORITY_REVIEW",
        "top_factors": ["fever", "headache"],
        "symptom_text": "I have fever and headache for 2 days",
        "concepts": ["fever", "headache"],
        "followup_answers": ["No breathing difficulty"],
        "language": "en"
    }
    response = client.post("/api/v1/ai/patient-insight", json=payload, headers=auth_headers(token))
    assert response.status_code == 200
    data = response.json().get("data", response.json())
    assert "explanation" in data
    assert "possible_patterns" in data
    assert "specialist" in data
    assert "self_care" in data
    assert "food_guidance" in data


def test_urgent_case_suppresses_routine_selfcare(client):
    token = _patient_token(client)
    payload = {
        "risk_score": 92.0,
        "confidence_score": 85.0,
        "care_level": "URGENT",
        "top_factors": ["chest_pain", "breathing_difficulty"],
        "symptom_text": "I have severe chest pressure, shortness of breath, sweating and dizziness",
        "concepts": ["chest_pain", "breathing_difficulty"],
        "followup_answers": [],
        "language": "en"
    }
    response = client.post("/api/v1/ai/patient-insight", json=payload, headers=auth_headers(token))
    assert response.status_code == 200
    data = response.json().get("data", response.json())
    # Verify urgent case prioritizes emergency review
    assert len(data["self_care"]) >= 1
    assert "Immediate Medical" in data["self_care"][0]["title"] or "Emergency" in data["self_care"][0]["title"] or "Seek" in data["self_care"][0]["title"]


def test_patient_insight_rejects_unauthenticated(client):
    payload = {
        "risk_score": 64.0,
        "confidence_score": 78.0,
        "care_level": "PRIORITY_REVIEW",
        "top_factors": ["fever"],
        "symptom_text": "fever",
        "concepts": ["fever"],
        "followup_answers": [],
        "language": "en"
    }
    response = client.post("/api/v1/ai/patient-insight", json=payload)
    assert response.status_code == 401
