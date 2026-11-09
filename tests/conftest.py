import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db import session as db_session_module
from app.db.models import Role
from app.main import app


@pytest.fixture()
def client():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False},
                            poolclass=StaticPool)
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    # Patch the shared session factory + engine used across the app.
    db_session_module.engine = engine
    db_session_module.SessionLocal = TestSession
    from app.db import models as _models  # noqa: F401 ensure models registered before create_all
    Base.metadata.create_all(bind=engine)

    with TestClient(app) as c:
        yield c


def register(client, email, role, full_name="Test User", password="Password123!"):
    resp = client.post("/api/v1/auth/register", json={
        "email": email, "password": password, "role": role, "full_name": full_name,
    })
    if resp.status_code == 200:
        return resp.json()["data"]["access_token"]
    # Self-registration is restricted to PATIENT by the production privilege
    # boundary (clinician/admin accounts must be provisioned by SYSTEM_ADMIN).
    # Provision those users directly in the test DB so existing role-based
    # test scenarios keep working while the HTTP endpoint stays secured.
    from app.core.security import create_access_token, hash_password
    from app.db.session import SessionLocal
    from app.db.models import User, Patient, Doctor
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(email=email, password_hash=hash_password(password), role=role)
            db.add(user)
            db.flush()
            if role == Role.PATIENT:
                count = db.query(Patient).count() + 1
                db.add(Patient(user_id=user.id, full_name=full_name,
                               public_id=f"FG-P-{str(count).zfill(6)}"))
            elif role == Role.DOCTOR:
                db.add(Doctor(user_id=user.id, full_name=full_name))
            db.commit()
        return create_access_token(user.id, user.role)
    finally:
        db.close()


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}
