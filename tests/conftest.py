import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET"] = "test-only-secret-key-for-local-pytest-suite-runs-only"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db import session as db_session_module
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
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}
