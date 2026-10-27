"""
Integration tests for FAME-GENIX 2.0 Real-World Clinical Ecosystem:
- Multi-Channel Notification Gateway (SMS, Email, WhatsApp)
- Patient Clinical Dossier (UHID, chronic conditions, verified allergies, emergency contacts)
- Publication-grade Patient Health Summary PDF Generator with date filtering
- Autonomous Metropolitan Hospital Resource & Emergency Bed Allocation Broker
"""

import os
import sys
import pytest
from datetime import datetime, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
from tests.conftest import auth_headers, register, register_privileged
from app.db.models import Patient, DeviceReading, RiskAssessment, DoctorConsultationRequest, Role


def test_patient_clinical_dossier_and_contacts(client):
    """Verifies that patient dossier exposes primary/secondary SOS contacts, allergies, and UHID."""
    token = register(client, "dossier_patient@test.com", "PATIENT", full_name="Srinivasulu Reddy")
    headers = auth_headers(token)

    # 1. Update demographics with primary and secondary contacts
    update_payload = {
        "age": 42,
        "sex": "MALE",
        "blood_group": "B+",
        "known_conditions": "Hypertension, Mild Asthma",
        "allergies": "Sulfa Drugs, Pollen",
        "emergency_contact_name": "Lakshmi Reddy",
        "emergency_contact_phone": "+91 98480 12345",
        "emergency_contact_relationship": "Spouse (Primary SOS)",
        "secondary_contact_name": "Kiran Kumar Reddy",
        "secondary_contact_phone": "+91 98480 67890",
        "secondary_contact_relationship": "Brother (Secondary SOS)",
    }
    update_resp = client.put("/api/v1/patients/me", json=update_payload, headers=headers)
    assert update_resp.status_code == 200
    p_data = update_resp.json()["data"]
    assert p_data["blood_group"] == "B+"
    assert p_data["secondary_contact_name"] == "Kiran Kumar Reddy"
    patient_id = p_data["id"]

    # 2. Retrieve rich clinical dossier
    dossier_resp = client.get(f"/api/v1/patients/{patient_id}/clinical-dossier", headers=headers)
    assert dossier_resp.status_code == 200
    dossier = dossier_resp.json()["data"]
    assert dossier["full_name"] == "Srinivasulu Reddy"
    assert dossier["contacts"]["primary_sos"]["name"] == "Lakshmi Reddy"
    assert dossier["contacts"]["secondary_sos"]["phone"] == "+91 98480 67890"
    assert "Hypertension" in dossier["medical_background"]["known_conditions"][0]
    assert "Sulfa Drugs" in dossier["medical_background"]["allergies"][0]


def test_download_patient_health_pdf_with_filters(client):
    """Verifies dynamic PDF generation with date range filtering and sections selection."""
    token = register(client, "pdf_patient@test.com", "PATIENT", full_name="Aarav Sharma")
    headers = auth_headers(token)

    me_resp = client.get("/api/v1/patients/me", headers=headers)
    patient_id = me_resp.json()["data"]["id"]

    # Submit sample observation
    obs_payload = {
        "readings": [
            {"metric": "hr", "value": 78, "unit": "bpm"},
            {"metric": "spo2", "value": 98.5, "unit": "%"}
        ],
        "source_type": "DEVICE",
        "simulation_label": "SIMULATED TELEMETRY"
    }
    client.post("/api/v1/patients/me/observations", json=obs_payload, headers=headers)

    # Download PDF without date filter
    pdf_resp = client.get(f"/api/v1/patients/{patient_id}/report/pdf", headers=headers)
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert len(pdf_resp.content) > 1000  # Valid non-empty PDF bytes
    assert b"%PDF" in pdf_resp.content[:10]

    # Download PDF with date filter and section selection
    start_date = (datetime.utcnow() - timedelta(days=1)).isoformat()
    end_date = (datetime.utcnow() + timedelta(days=1)).isoformat()
    pdf_filtered = client.get(
        f"/api/v1/patients/{patient_id}/report/pdf?start_date={start_date}&end_date={end_date}&sections=vitals,assessments",
        headers=headers
    )
    assert pdf_filtered.status_code == 200
    assert len(pdf_filtered.content) > 1000


def test_multi_channel_notification_gateway(client):
    """Verifies SMS, Email, and WhatsApp dispatch for acute health deterioration."""
    from app.notifications.gateway import notification_gateway
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        token = register(client, "alert_patient@test.com", "PATIENT", full_name="Mohammad Yasin")
        headers = auth_headers(token)
        patient_id = client.get("/api/v1/patients/me", headers=headers).json()["data"]["id"]
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        patient.emergency_contact_name = "Farooq Yasin"
        patient.emergency_contact_phone = "+91 99887 76655"
        patient.emergency_contact_relationship = "Brother"
        patient.secondary_contact_name = "Zainab Begum"
        patient.secondary_contact_phone = "+91 99887 76656"
        patient.secondary_contact_relationship = "Mother"
        db.commit()

        # Trigger multi-channel alert
        result = notification_gateway.dispatch_critical_vitals_alert(
            db=db,
            patient=patient,
            metric="spo2",
            value=84.5,
            unit="%",
            care_level="EMERGENCY"
        )

        assert result["status"] == "SUCCESS"
        assert len(result["dispatched_sms"]) == 2  # Primary and secondary SOS
        assert len(result["dispatched_whatsapp"]) == 2
        assert result["email_payload"] is not None
        assert "EMERGENCY" in result["email_payload"]["subject"]
    finally:
        db.close()


def test_hospital_resource_grid_and_handover_passport(client):
    """Verifies regional hospital bed telemetry and pre-hospital handover passport routing."""
    op_token = register_privileged(client, "trauma_operator@test.com", "EMERGENCY_OPERATOR", full_name="Trauma Chief")
    headers = auth_headers(op_token)

    # 1. Query real-time hospital resource grid
    grid_resp = client.get("/api/v1/emergency/hospitals/grid", headers=headers)
    assert grid_resp.status_code == 200
    hospitals = grid_resp.json()["data"]
    assert len(hospitals) >= 3
    # Check that hospitals track ICU beds and Cath Lab
    apollo = next(h for h in hospitals if "Apollo" in h["name"])
    assert apollo["available_icu_beds"] > 0
    assert apollo["cath_lab_operational"] is True

    # 2. Create emergency case and request digital handover passport
    p_token = register(client, "stemi_patient@test.com", "PATIENT", full_name="Kishore Kumar")
    p_headers = auth_headers(p_token)
    p_id = client.get("/api/v1/patients/me", headers=p_headers).json()["data"]["id"]

    case_resp = client.post("/api/v1/emergency/cases", json={
        "patient_id": p_id,
        "trigger_type": "RULE",
        "description": "Acute chest pressure radiating to left arm with diaphoresis (Suspected STEMI)"
    }, headers=headers)
    assert case_resp.status_code == 200
    case_id = case_resp.json()["data"]["id"]

    # 3. Retrieve pre-hospital digital handover passport
    passport_resp = client.get(f"/api/v1/emergency/cases/{case_id}/handover-passport", headers=headers)
    assert passport_resp.status_code == 200
    passport = passport_resp.json()["data"]
    assert "PASS-" in passport["passport_id"]
    assert passport["patient"]["full_name"] == "Kishore Kumar"
    # Ensure routing selected facility with Cath Lab
    recommended_hosp = passport["hospital_routing"]["recommended_hospital"]
    assert recommended_hosp["cath_lab_operational"] is True
    assert len(passport["interventions_en_route"]) >= 2
