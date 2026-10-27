from tests.conftest import auth_headers, register, register_privileged


def test_emergency_state_machine_rejects_invalid_transition(client):
    patient_token = register(client, "e1@test.com", "PATIENT")
    op_token = register_privileged(client, "op1@test.com", "EMERGENCY_OPERATOR", full_name="Op")

    patient = client.get("/api/v1/patients/me", headers=auth_headers(patient_token)).json()["data"]
    case = client.post("/api/v1/emergency/cases", json={"patient_id": patient["id"], "trigger_type": "SIMULATED_TRIGGER"},
                        headers=auth_headers(op_token)).json()["data"]

    # Cannot dispatch before verification.
    resp = client.post(f"/api/v1/emergency/cases/{case['id']}/dispatch", headers=auth_headers(op_token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "INVALID_STATE_TRANSITION"


def test_emergency_full_happy_path_and_audit_trail(client):
    patient_token = register(client, "e2@test.com", "PATIENT")
    op_token = register_privileged(client, "op2@test.com", "EMERGENCY_OPERATOR", full_name="Op2")
    amb_token = register_privileged(client, "amb2@test.com", "AMBULANCE_TEAM", full_name="Amb2")
    admin_token = register_privileged(client, "admin2@test.com", "SYSTEM_ADMIN", full_name="Admin2")

    patient = client.get("/api/v1/patients/me", headers=auth_headers(patient_token)).json()["data"]
    case = client.post("/api/v1/emergency/cases", json={"patient_id": patient["id"], "trigger_type": "SIMULATED_TRIGGER"},
                        headers=auth_headers(op_token)).json()["data"]
    case_id = case["id"]

    assert client.post(f"/api/v1/emergency/cases/{case_id}/verify", headers=auth_headers(op_token)).status_code == 200
    assert client.post(f"/api/v1/emergency/cases/{case_id}/dispatch", headers=auth_headers(op_token)).status_code == 200

    for _ in range(5):  # DISPATCHED -> PATIENT_REACHED -> TRANSPORTING -> HOSPITAL_REACHED -> COMPLETED
        resp = client.post(f"/api/v1/emergency/cases/{case_id}/advance", headers=auth_headers(amb_token))
        assert resp.status_code == 200

    final = client.get(f"/api/v1/emergency/cases/{case_id}", headers=auth_headers(op_token)).json()["data"]
    assert final["status"] == "COMPLETED"
    assert final["simulation_status"] == "SIMULATED"

    logs = client.get("/api/v1/audit/logs", headers=auth_headers(admin_token)).json()["data"]
    actions = {row["action"] for row in logs}
    assert "EMERGENCY_CASE_CREATED" in actions
    assert "EMERGENCY_VERIFIED" in actions
    assert "DISPATCH_REQUESTED" in actions
    assert "AMBULANCE_ADVANCE" in actions
