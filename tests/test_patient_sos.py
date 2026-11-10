import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.db.models import User, Patient, EmergencyCase, Role
import uuid

client = TestClient(app)

def test_patient_sos_endpoints_missing_auth():
    response = client.post("/api/v1/emergency/cases/patient", json={})
    assert response.status_code == 401

def test_patient_active_emergency_endpoints_missing_auth():
    response = client.get("/api/v1/emergency/cases/patient/active")
    assert response.status_code == 401
