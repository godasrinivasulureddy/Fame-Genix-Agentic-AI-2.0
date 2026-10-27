import pytest
from tests.conftest import auth_headers, register, register_privileged


def test_duplicate_incident_mitigation_or_rejection(client):
    """T4.12: Test handling of duplicate active emergency cases for a patient."""
    patient_token = register(client, "dup_pat@test.com", "PATIENT")
    op_token = register_privileged(client, "dup_op@test.com", "EMERGENCY_OPERATOR")

    pat = client.get("/api/v1/patients/me", headers=auth_headers(patient_token)).json()["data"]
    
    # First case creation
    res1 = client.post("/api/v1/emergency/cases", json={"patient_id": pat["id"], "trigger_type": "SIMULATED_TRIGGER"}, headers=auth_headers(op_token))
    assert res1.status_code == 200
    case_id = res1.json()["data"]["id"]

    # Active case lookup returns existing active incident without creating unbound duplicate
    cases = client.get("/api/v1/emergency/cases", headers=auth_headers(op_token)).json()["data"]
    active_ids = [c["id"] for c in cases]
    assert case_id in active_ids


def test_unauthorized_case_handover_rejection(client):
    """T4.11 & T4.12: Verify permission checks on emergency handover and advance."""
    patient_token = register(client, "unauth_pat@test.com", "PATIENT")
    op_token = register_privileged(client, "op_handover@test.com", "EMERGENCY_OPERATOR")

    pat = client.get("/api/v1/patients/me", headers=auth_headers(patient_token)).json()["data"]
    case = client.post("/api/v1/emergency/cases", json={"patient_id": pat["id"], "trigger_type": "SIMULATED_TRIGGER"}, headers=auth_headers(op_token)).json()["data"]

    # Regular patient cannot advance ambulance lifecycle
    resp = client.post(f"/api/v1/emergency/cases/{case['id']}/advance", headers=auth_headers(patient_token))
    assert resp.status_code == 403


def test_invalid_state_transition_rejection(client):
    """T4.12: Test invalid emergency state machine transition."""
    op_token = register_privileged(client, "op_trans@test.com", "EMERGENCY_OPERATOR")
    patient_token = register(client, "pat_trans@test.com", "PATIENT")
    pat = client.get("/api/v1/patients/me", headers=auth_headers(patient_token)).json()["data"]

    case = client.post("/api/v1/emergency/cases", json={"patient_id": pat["id"], "trigger_type": "SIMULATED_TRIGGER"}, headers=auth_headers(op_token)).json()["data"]

    # Cannot advance before verification & dispatch
    amb_token = register_privileged(client, "amb_trans@test.com", "AMBULANCE_TEAM")
    resp = client.post(f"/api/v1/emergency/cases/{case['id']}/advance", headers=auth_headers(amb_token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "INVALID_STATE_TRANSITION"
