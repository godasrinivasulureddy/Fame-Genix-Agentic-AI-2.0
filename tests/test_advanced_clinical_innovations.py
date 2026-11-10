"""
Tests for FAME-GENIX Next-Generation Medical & Physical AI Innovations:
- Tablet Camera Scanner & Wholesale Price Estimator
- Autonomous Medical Scribe SOAP Note Generator
- Cryptographic Black Box Chain of Custody
- Smart Helmet Heat Strain & Electrolyte Hydration
- Smart Mask Exhaled Breath VOCs (Acetone/DKA, Ammonia)
- Remote Photoplethysmography (rPPG) WebCam Face Scan
- Cincinnati Prehospital Stroke Scale / FAST Screener
- Smart City Green Corridor Preemption Broker
- Ayushman Bharat (ABDM) Instant Cashless Pre-Auth
"""

import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
from tests.conftest import auth_headers, register
from app.db.models import Role


def test_tablet_scanner_and_price_estimation(client):
    """Tests tablet camera scanner, pricing savings, voiceover script and allergy safety."""
    p_token = register(client, "tablet_patient@test.com", "PATIENT", full_name="Rajesh Verma")
    headers = auth_headers(p_token)

    # 1. Update patient allergies to include Penicillin
    client.put("/api/v1/patients/me", json={"allergies": "Penicillin, Dust"}, headers=headers)

    # 2. Scan Dolo 650 (Safe Analgesic)
    dolo_resp = client.post("/api/v1/patients/pharmacy/scan-tablet", json={"query": "Dolo 650"}, headers=headers)
    assert dolo_resp.status_code == 200
    dolo_data = dolo_resp.json()["data"]
    assert "Paracetamol" in dolo_data["generic_compound"]
    assert dolo_data["pricing"]["estimated_wholesale_inr"] < dolo_data["pricing"]["estimated_retail_mrp_inr"]
    assert dolo_data["pricing"]["patient_savings_percent"] > 40.0
    assert dolo_data["allergy_alert"] is False
    assert "Dolo 650 contains Paracetamol" in dolo_data["audio_voiceover_script"]
    assert len(dolo_data["suggested_recovery_foods"]) >= 2

    # 3. Scan Augmentin 625 (Contains Amoxicillin - triggers Penicillin contraindication!)
    aug_resp = client.post("/api/v1/patients/pharmacy/scan-tablet", json={"query": "Augmentin 625"}, headers=headers)
    assert aug_resp.status_code == 200
    aug_data = aug_resp.json()["data"]
    assert aug_data["allergy_alert"] is True
    assert len(aug_data["contraindications"]) >= 1
    assert "Penicillin allergy" in aug_data["contraindications"][0]


def test_autonomous_medical_scribe_soap_note(client):
    """Tests autonomous generation of standardized EHR SOAP notes for doctors."""
    doc_token = register(client, "scribe_doctor@test.com", "DOCTOR", full_name="Dr. Haranadha")
    doc_headers = auth_headers(doc_token)

    p_token = register(client, "soap_patient@test.com", "PATIENT", full_name="Venkatesh Naidu")
    p_headers = auth_headers(p_token)
    p_id = client.get("/api/v1/patients/me", headers=p_headers).json()["data"]["id"]

    payload = {
        "transcript": "Patient reports severe chest heaviness and shortness of breath starting 2 hours ago.",
        "vitals": {"spo2": 89.0, "hr": 118.0, "rr": 24.0, "temp": 37.4},
        "labs": {"troponin_i": 85.0, "creatinine": 1.2},
        "language": "en"
    }
    resp = client.post(f"/api/v1/doctors/patients/{p_id}/soap-note", json=payload, headers=doc_headers)
    assert resp.status_code == 200
    soap = resp.json()["data"]
    assert "SUBJECTIVE" in soap["raw_formatted_markdown"]
    assert "OBJECTIVE" in soap["raw_formatted_markdown"]
    assert "ASSESSMENT" in soap["raw_formatted_markdown"]
    assert "PLAN" in soap["raw_formatted_markdown"]
    assert soap["assessment"]["clinical_risk_tier"] == "HIGH_ACUITY"


def test_cryptographic_black_box_chain_of_custody(client):
    """Tests SHA-256 chained tamper-evident audit ledger."""
    admin_token = register(client, "box_admin@test.com", "SYSTEM_ADMIN", full_name="Compliance Officer")
    headers = auth_headers(admin_token)

    from app.audit.black_box import clinical_black_box
    clinical_black_box.record_event(
        event_type="DISPATCH_EXECUTED",
        actor_id="OP-001",
        actor_role="EMERGENCY_OPERATOR",
        patient_id="PAT-99",
        event_data={"ambulance_id": "AMB-01", "vitals_at_dispatch": {"spo2": 85}}
    )

    verify_resp = client.get("/api/v1/audit/black-box/verify", headers=headers)
    assert verify_resp.status_code == 200
    v_data = verify_resp.json()["data"]
    assert v_data["valid"] is True
    assert v_data["total_blocks"] >= 2


def test_smart_helmet_heat_strain_and_mask_breathomics(client):
    """Tests helmet sweat electrolyte hydration and smart mask exhaled breath volatilome."""
    p_token = register(client, "sensor_user@test.com", "PATIENT", full_name="Kiran Worker")
    headers = auth_headers(p_token)

    # 1. Helmet Heat Strain
    strain_resp = client.get("/api/v1/emergency/diagnostics/helmet-heat-strain?patient_id=p-test&sodium=65.0&skin_temp=39.2", headers=headers)
    assert strain_resp.status_code == 200
    strain_data = strain_resp.json()["data"]
    assert strain_data["heat_strain_level"] == "CRITICAL_HEATSTROKE"
    assert "URGENT WARNING" in strain_data["audio_warning_prompt"]

    # 2. Mask Exhaled Breathomics (Acetone spike -> DKA detection)
    breath_resp = client.get("/api/v1/emergency/diagnostics/mask-breath-vocs?patient_id=p-test&acetone=3.5&ammonia=0.4", headers=headers)
    assert breath_resp.status_code == 200
    breath_data = breath_resp.json()["data"]
    assert any("Diabetic Ketoacidosis" in p for p in breath_data["detected_pathology"])
    assert "ACETONE ELEVATION" in breath_data["clinical_alert"]


def test_rppg_fast_stroke_and_green_corridor(client):
    """Tests webcam face vitals, FAST stroke screener, and smart city traffic green corridor."""
    p_token = register(client, "stroke_test@test.com", "PATIENT", full_name="Grandpa Somesh")
    p_headers = auth_headers(p_token)

    # 1. rPPG non-contact face scan
    rppg_resp = client.post("/api/v1/patients/diagnostics/rppg-face-scan", json={"frames_count": 450}, headers=p_headers)
    assert rppg_resp.status_code == 200
    rppg_data = rppg_resp.json()["data"]
    assert rppg_data["estimated_heart_rate_bpm"] > 60
    assert rppg_data["confidence_score"] > 0.85

    # 2. FAST Stroke Screen
    fast_resp = client.post("/api/v1/patients/diagnostics/fast-stroke-screen", json={
        "facial_droop": True,
        "arm_drift": True,
        "slurred_speech": False
    }, headers=p_headers)
    assert fast_resp.status_code == 200
    fast_data = fast_resp.json()["data"]
    assert fast_data["stroke_code_activated"] is True
    assert "ACTIVATE STROKE CODE" in fast_data["immediate_directive"]

    # 3. Smart City Green Corridor Preemption
    op_token = register(client, "green_op@test.com", "EMERGENCY_OPERATOR", full_name="Dispatch Chief")
    op_headers = auth_headers(op_token)
    green_resp = client.post("/api/v1/emergency/green-corridor", json={
        "ambulance_id": "AMB-07",
        "hospital_id": "HOSP-APOLLO-MAIN"
    }, headers=op_headers)
    assert green_resp.status_code == 200
    green_data = green_resp.json()["data"]
    assert green_data["status"] == "GREEN_CORRIDOR_ACTIVE"
    assert green_data["preempted_intersections_count"] >= 5


def test_breathomics_thresholds_match_documented_limits(client):
    """Smart Mask VOC thresholds must match the audit dossier:
    Acetone > 1.8 ppm (DKA), Ammonia > 1.0 ppm (renal/hepatic), eNO > 35 ppb (asthma)."""
    p_token = register(client, "voc_thresholds@test.com", "PATIENT", full_name="Threshold Probe")
    headers = auth_headers(p_token)

    # Acetone at the documented boundary: 1.8 should NOT flag, 1.9 should flag DKA.
    below = client.get("/api/v1/emergency/diagnostics/mask-breath-vocs?patient_id=p-voc&acetone=1.8&ammonia=0.4&no_ppb=20",
                       headers=headers).json()["data"]
    assert not any("Diabetic Ketoacidosis" in p for p in below["detected_pathology"])

    above = client.get("/api/v1/emergency/diagnostics/mask-breath-vocs?patient_id=p-voc&acetone=1.9&ammonia=0.4&no_ppb=20",
                       headers=headers).json()["data"]
    assert any("Diabetic Ketoacidosis" in p for p in above["detected_pathology"])
    assert "ACETONE ELEVATION" in above["clinical_alert"]

    # Ammonia: 1.0 should NOT flag, 1.1 should flag renal distress.
    below = client.get("/api/v1/emergency/diagnostics/mask-breath-vocs?patient_id=p-voc&acetone=0.5&ammonia=1.0&no_ppb=20",
                       headers=headers).json()["data"]
    assert not any("Uremic Breath" in p for p in below["detected_pathology"])

    above = client.get("/api/v1/emergency/diagnostics/mask-breath-vocs?patient_id=p-voc&acetone=0.5&ammonia=1.1&no_ppb=20",
                       headers=headers).json()["data"]
    assert any("Uremic Breath" in p for p in above["detected_pathology"])
    assert "AMMONIA ELEVATION" in above["clinical_alert"]

    # Nitric Oxide: 35 should NOT flag, 36 should flag asthma exacerbation.
    below = client.get("/api/v1/emergency/diagnostics/mask-breath-vocs?patient_id=p-voc&acetone=0.5&ammonia=0.4&no_ppb=35",
                       headers=headers).json()["data"]
    assert not any("Eosinophilic" in p for p in below["detected_pathology"])

    above = client.get("/api/v1/emergency/diagnostics/mask-breath-vocs?patient_id=p-voc&acetone=0.5&ammonia=0.4&no_ppb=36",
                       headers=headers).json()["data"]
    assert any("Eosinophilic" in p for p in above["detected_pathology"])
    assert "NITRIC OXIDE SPIKE" in above["clinical_alert"]


def test_black_box_survives_reload(client):
    """The cryptographic chain is DB-backed: a fresh ledger instance loaded from
    the same DB must verify the blocks recorded earlier."""
    from app.db.session import SessionLocal
    from app.audit.black_box import CryptographicBlackBox

    admin_token = register(client, "box_admin2@test.com", "SYSTEM_ADMIN", full_name="Compliance Officer 2")
    headers = auth_headers(admin_token)

    # Record a fresh event through the audit path (record_audit mirrors into the ledger).
    client.post("/api/v1/auth/login", json={
        "email": "box_admin2@test.com", "password": "Password123!"
    }, headers=headers)

    # Simulate a server restart: new in-memory instance hydrated from the DB.
    from app.db import session as db_session_module
    db = db_session_module.SessionLocal()
    try:
        fresh_box = CryptographicBlackBox()
        fresh_box.load_from_db(db)
        v = fresh_box.verify_chain_integrity()
    finally:
        db.close()

    assert v["valid"] is True
    assert v["total_blocks"] >= 1  # at least the genesis block persisted


def test_direct_assessment_returns_triggered_safety_rules(client):
    """POST /api/v1/patients/me/assessments must surface authoritative
    triggered safety rules to the frontend vitals interface."""
    p_token = register(client, "direct_assess@test.com", "PATIENT", full_name="Direct Vitals")
    headers = auth_headers(p_token)

    # heart_rate 155 > 140 triggers rule RF-003 (POSSIBLE_EMERGENCY-ish URGENT).
    resp = client.post("/api/v1/patients/me/assessments", json={
        "symptoms": [{"name": "palpitations", "severity": "moderate"}],
        "vitals": {"heart_rate": 155.0, "spo2": 97.0},
    }, headers=headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["triggered_safety_rules"], "expected triggered safety rules"
    rf003 = [r for r in data["triggered_safety_rules"] if r["rule_id"] == "RF-003"]
    assert rf003, "expected RF-003 tachycardia rule"
    assert rf003[0]["forced_care_level"] == "URGENT"
    assert "vitals" in data and data["vitals"]["heart_rate"] == 155.0
