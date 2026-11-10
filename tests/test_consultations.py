import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.db.models import User, Patient, Doctor, DoctorConsultationRequest, Role
import uuid

client = TestClient(app)

@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_consultation_endpoints_missing_auth():
    # Attempt to request consultation without auth
    response = client.post("/api/v1/patients/me/consultations", json={"specialty": "Pulmonologist"})
    assert response.status_code == 401

def test_consultation_endpoints_doctor_queue_missing_auth():
    response = client.get("/api/v1/doctors/consultations/queue")
    assert response.status_code == 401
