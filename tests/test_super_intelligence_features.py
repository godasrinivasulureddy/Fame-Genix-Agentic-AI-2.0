"""
Tests for FAME-GENIX Super-Intelligence Upgrades:
- WebBluetooth BLE Device Discovery & Pairing
- Ambient CCTV Fall Detection Ingestion
- Multi-Agent Medical Society (Specialists + Evaluator)
- Unified Portal Settings Engine for all 5 Roles
"""

import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
from tests.conftest import auth_headers, register, register_privileged
from app.db.models import Role


def test_bluetooth_peripheral_scan_and_pairing(client):
    """Tests WebBluetooth peripheral scan and GATT pairing flow."""
    p_token = register(client, "ble_patient@test.com", "PATIENT", full_name="Srinivasulu")
    headers = auth_headers(p_token)

    # 1. Scan for nearby BLE devices (Smart Mask, Smart Helmet, CCTV)
    scan_resp = client.get("/api/v1/devices/bluetooth/scan", headers=headers)
    assert scan_resp.status_code == 200
    devices = scan_resp.json()["data"]
    assert len(devices) >= 3
    mask = next(d for d in devices if "FAME_MASK" in d["hardware_type"])
    assert mask["battery_percent"] > 50
    assert len(mask["gatt_services"]) >= 2

    # 2. Pair with Smart Mask
    pair_resp = client.post(f"/api/v1/devices/bluetooth/{mask['device_id']}/pair", headers=headers)
    assert pair_resp.status_code == 200
    p_res = pair_resp.json()["data"]
    assert p_res["status"] == "SUCCESS"
    assert p_res["pairing_status"] == "CONNECTED"

    # 3. Unpair
    unpair_resp = client.post(f"/api/v1/devices/bluetooth/{mask['device_id']}/unpair", headers=headers)
    assert unpair_resp.status_code == 200
    assert unpair_resp.json()["data"]["pairing_status"] == "UNPAIRED"


def test_ambient_cctv_fall_detection_ingestion(client):
    """Tests edge CCTV skeleton fall-alert ingestion."""
    op_token = register_privileged(client, "cctv_op@test.com", "EMERGENCY_OPERATOR", full_name="Camera Chief")
    headers = auth_headers(op_token)

    resp = client.post("/api/v1/devices/cctv/fall-alert?cctv_id=VISION-CCTV-ER-ROOM-1&patient_id=p-test-101&confidence=0.96", headers=headers)
    assert resp.status_code == 200
    event = resp.json()["data"]
    assert "FALL-EVT-" in event["event_id"]
    assert event["confidence_score"] == 0.96
    assert event["trigger_action"] == "EMERGENCY_FALL_DISPATCH_REQUIRED"


def test_multi_agent_society_consensus(client):
    """Tests clinical deliberation across specialized agents and safety evaluator."""
    doc_token = register_privileged(client, "ai_doctor@test.com", "DOCTOR", full_name="Dr. Skyline")
    headers = auth_headers(doc_token)

    payload = {
        "symptom_text": "Severe chest pressure and sudden shortness of breath",
        "vitals": {"spo2": 88.0, "hr": 128.0, "temp": 37.2},
        "conditions": "Chronic Renal Disease",
        "allergies": "Sulfa",
        "lab_values": {"creatinine": 2.1}
    }
    resp = client.post("/api/v1/ai/multi-agent/consensus", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["primary_triage_acuity"] in ["EMERGENT", "RESUSCITATION"]
    assert len(data["participating_agents"]) >= 3

    # Check that Renal agent flagged contraindications
    renal_agent = next(a for a in data["participating_agents"] if "Metabolic" in a["agent_name"])
    assert any("NSAID" in c for c in renal_agent["contraindications_detected"])
    assert any("Sulfa" in c for c in renal_agent["contraindications_detected"])

    # Check Evaluator critique passed
    assert data["safety_critique"]["evaluator_passed"] is True
    assert data["safety_critique"]["guideline_conformance"] == "FULLY_CONFORMANT"


def test_portal_settings_management(client):
    """Tests role-specific operational configuration endpoints."""
    p_token = register(client, "settings_user@test.com", "PATIENT", full_name="Settings Test")
    headers = auth_headers(p_token)

    # 1. Fetch current settings
    get_resp = client.get("/api/v1/settings/me", headers=headers)
    assert get_resp.status_code == 200
    settings = get_resp.json()["data"]["settings"]
    assert "vitals_desaturation_threshold_spo2" in settings

    # 2. Update settings
    put_resp = client.put("/api/v1/settings/me", json={"vitals_desaturation_threshold_spo2": 85, "dark_mode": True}, headers=headers)
    assert put_resp.status_code == 200
    updated = put_resp.json()["data"]["updated_settings"]
    assert updated["vitals_desaturation_threshold_spo2"] == 85
