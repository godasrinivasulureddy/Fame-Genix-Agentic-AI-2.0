from tests.conftest import register, auth_headers

def test_observation_validation_empty_rejected(client):
    token = register(client, "obs_patient1@famegenix.org", "PATIENT", "Observation Patient 1")
    headers = auth_headers(token)

    # Empty readings
    res = client.post("/api/v1/patients/me/observations", json={"readings": []}, headers=headers)
    assert res.status_code == 400
    assert "empty" in res.json()["error"]["message"].lower()

def test_observation_validation_and_unit_boundary_normalization(client):
    token = register(client, "obs_patient2@famegenix.org", "PATIENT", "Observation Patient 2")
    headers = auth_headers(token)

    payload = {
        "source_type": "SIMULATED_MASK",
        "simulation_label": "SIMULATED TELEMETRY",
        "readings": [
            {"metric": "hr", "value": 78.5, "unit": "bpm"},
            {"metric": "spo2", "value": 98.0, "unit": "%"},
            {"metric": "rr", "value": 16.0, "unit": "br/min"},
            {"metric": "temp", "value": 36.8, "unit": "C"},
            {"metric": "voc", "value": 0.12, "unit": "ppm"}
        ]
    }
    res = client.post("/api/v1/patients/me/observations", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["accepted_count"] == 5
    assert len(data["readings"]) == 5
    assert data["readings"][0]["simulation_label"] == "SIMULATED TELEMETRY"
