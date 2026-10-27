from tests.conftest import auth_headers, register, register_privileged


def _setup_patient_with_device(client):
    token = register(client, "sim@test.com", "PATIENT")
    h = auth_headers(token)
    device = client.post("/api/v1/devices", json={"type": "FAME_MASK"}, headers=h).json()["data"]
    client.post(f"/api/v1/devices/{device['id']}/connect", headers=h)
    return token, h, device["id"]


def test_healthy_scenario_produces_low_drift_and_stable_care_level(client):
    token, h, device_id = _setup_patient_with_device(client)
    client.post("/api/v1/simulator/start", json={"device_id": device_id, "scenario": "HEALTHY"}, headers=h)

    last = None
    for _ in range(4):
        resp = client.post("/api/v1/simulator/step", headers=h)
        assert resp.status_code == 200
        last = resp.json()["data"]

    assert last["assessment"]["care_level"] in ("STABLE", "MONITOR")


def test_respiratory_drift_scenario_escalates_care_level(client):
    token, h, device_id = _setup_patient_with_device(client)
    client.post("/api/v1/simulator/start", json={"device_id": device_id, "scenario": "RESPIRATORY_DRIFT"}, headers=h)

    care_levels = []
    for _ in range(6):
        resp = client.post("/api/v1/simulator/step", headers=h)
        assert resp.status_code == 200
        care_levels.append(resp.json()["data"]["assessment"]["care_level"])

    order = ["STABLE", "MONITOR", "ROUTINE_REVIEW", "PRIORITY_REVIEW", "URGENT", "POSSIBLE_EMERGENCY"]
    # Deterioration scenario must reach at least PRIORITY_REVIEW by the final step.
    assert order.index(care_levels[-1]) >= order.index("PRIORITY_REVIEW")


def test_assessment_returns_separate_risk_confidence_care_level(client):
    token, h, device_id = _setup_patient_with_device(client)
    client.post("/api/v1/simulator/start", json={"device_id": device_id, "scenario": "RESPIRATORY_DRIFT"}, headers=h)
    for _ in range(3):
        client.post("/api/v1/simulator/step", headers=h)

    resp = client.post("/api/v1/assessments", json={}, headers=h)
    data = resp.json()["data"]
    assert "risk_score" in data and "confidence_score" in data and "care_level" in data
    assert data["risk_score"] != data["confidence_score"]  # never merged into one number


def test_worsening_patient_enters_doctor_queue(client):
    token, h, device_id = _setup_patient_with_device(client)
    doctor_token = register_privileged(client, "docqueue@test.com", "DOCTOR", full_name="Dr Q")

    client.post("/api/v1/simulator/start", json={"device_id": device_id, "scenario": "CRITICAL_RESPIRATORY"}, headers=h)
    for _ in range(7):
        client.post("/api/v1/simulator/step", headers=h)

    queue = client.get("/api/v1/doctors/queue", headers=auth_headers(doctor_token)).json()["data"]
    assert any(q for q in queue)  # at least one patient reached review threshold
