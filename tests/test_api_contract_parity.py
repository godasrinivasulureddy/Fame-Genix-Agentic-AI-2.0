import pytest
from tests.conftest import auth_headers, register


def test_rag_retrieve_endpoint(client):
    """Test POST /api/v1/rag/retrieve endpoint expected by frontend."""
    # Requires authentication to prevent external API quota abuse
    token = register(client, "rag.tester@famegenix.org", "PATIENT", "RAG Tester")
    resp = client.post("/api/v1/rag/retrieve", json={"query": "chest pain dyspnea"}, headers=auth_headers(token))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert isinstance(data, list)
    assert len(data) > 0
    first = data[0]
    assert "title" in first
    assert "excerpt" in first
    assert "publisher" in first
    assert "score" in first

    # Unauthenticated request rejected with 401
    unauth = client.post("/api/v1/rag/retrieve", json={"query": "chest pain dyspnea"})
    assert unauth.status_code == 401


def test_patient_direct_assessment_and_insight_flow(client):
    """Test POST /api/v1/patients/me/assessments and POST /api/v1/ai/patient-insight with assessment_id."""
    token = register(client, "patient.flow@famegenix.org", "PATIENT", "Jane Triage")
    headers = auth_headers(token)

    # 1. Create assessment directly with symptoms and vitals
    assess_payload = {
        "symptoms": [
            {"name": "Severe breathlessness", "severity": "HIGH"},
            {"name": "Chest tightness", "severity": "HIGH"}
        ],
        "vitals": {
            "heart_rate": 115,
            "spo2": 88,
            "respiratory_rate": 26,
            "temperature": 37.5
        }
    }
    resp = client.post("/api/v1/patients/me/assessments", json=assess_payload, headers=headers)
    assert resp.status_code == 200
    assessment = resp.json()["data"]
    assert assessment["id"] is not None
    assert assessment["risk_score"] > 50
    assert assessment["care_level"] in ["URGENT", "POSSIBLE_EMERGENCY", "PRIORITY_REVIEW", "EMERGENCY_DISPATCH"]
    assert "vitals" in assessment
    assert assessment["vitals"]["spo2"] == 88

    # 2. Call patient-insight passing { assessment_id: ... }
    insight_resp = client.post("/api/v1/ai/patient-insight", json={"assessment_id": assessment["id"]}, headers=headers)
    assert insight_resp.status_code == 200
    insight_data = insight_resp.json()["data"]
    assert "explanation" in insight_data
    assert "suggested_specialty" in insight_data
    assert len(insight_data["explanation"]) > 10
