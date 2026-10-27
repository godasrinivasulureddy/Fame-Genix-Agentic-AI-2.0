"""
Security regression tests for hackathon readiness.
These tests verify the highest-risk authorization, object-level, and integrity controls.

They are written test-first (RED) and verified green after the corresponding fix.
"""
from tests.conftest import auth_headers, register
from fastapi import status


# ---------------------------------------------------------------------------
# 1. Registration privilege escalation
# ---------------------------------------------------------------------------
def test_anonymous_register_cannot_become_doctor(client):
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": "evil.doctor@famegenix.org", "password": "Password123!", "role": "DOCTOR", "full_name": "Evil Doc"},
    )
    assert resp.status_code in (400, 403, 422), resp.text


def test_anonymous_register_cannot_become_emergency_operator(client):
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": "evil.emergency@famegenix.org", "password": "Password123!", "role": "EMERGENCY_OPERATOR", "full_name": "Evil Op"},
    )
    assert resp.status_code in (400, 403, 422), resp.text


def test_anonymous_register_cannot_become_ambulance_team(client):
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": "evil.amb@famegenix.org", "password": "Password123!", "role": "AMBULANCE_TEAM", "full_name": "Evil Amb"},
    )
    assert resp.status_code in (400, 403, 422), resp.text


def test_anonymous_register_cannot_become_admin(client):
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": "evil.admin@famegenix.org", "password": "Password123!", "role": "SYSTEM_ADMIN", "full_name": "Evil Admin"},
    )
    assert resp.status_code in (400, 403, 422), resp.text


# ---------------------------------------------------------------------------
# 2. AI status endpoint public, AI analysis requires auth
# ---------------------------------------------------------------------------
def test_ai_status_is_public(client):
    resp = client.get("/api/v1/ai/status")
    assert resp.status_code == 200


def test_conversation_endpoints_require_auth(client):
    base = "/api/v1/ai/conversations"
    assert client.get(base).status_code == 401
    assert client.post(base).status_code == 401
    assert client.put(f"{base}/abc").status_code == 401
    assert client.delete(f"{base}/abc").status_code == 401


# ---------------------------------------------------------------------------
# 3. Conversations are scoped to authenticated user
# ---------------------------------------------------------------------------
def test_conversation_ownership_scoped_to_user(client):
    """A user can only list/modify their own conversations."""
    alice = register(client, "alice.conv@famegenix.org", "PATIENT", "Alice")
    bob = register(client, "bob.conv@famegenix.org", "PATIENT", "Bob")
    ah, bh = auth_headers(alice), auth_headers(bob)

    # Bob creates a conversation
    resp = client.post("/api/v1/ai/conversations", json={"title": "Bob's conv"}, headers=bh)
    assert resp.status_code == 200, resp.text
    conv_id = resp.json()["data"]["id"]
    # With fix applied, it must belong to Bob, not hardcoded demo_user_1
    assert resp.json()["data"]["user_id"] != "demo_user_1"

    # Alice cannot see Bob's conversation
    listing = client.get("/api/v1/ai/conversations", headers=ah)
    assert listing.status_code == 200
    ids = [c["id"] for c in listing.json()["data"]]
    assert conv_id not in ids

    # Alice cannot update Bob's conversation
    upd = client.put(f"/api/v1/ai/conversations/{conv_id}", json={"title": "hacked"}, headers=ah)
    assert upd.status_code == 403 or upd.status_code == 404

    # Alice cannot delete Bob's conversation
    dele = client.delete(f"/api/v1/ai/conversations/{conv_id}", headers=ah)
    assert dele.status_code == 403 or dele.status_code == 404


# ---------------------------------------------------------------------------
# 4. Consent / location handling does not coerce false->true
# ---------------------------------------------------------------------------
def test_patient_sos_explicit_false_consent_stays_false(client):
    token = register(client, "sos.consent@famegenix.org", "PATIENT", "Consent Patient")
    h = auth_headers(token)
    resp = client.post(
        "/api/v1/emergency/cases/patient",
        json={"latitude": 12.0, "longitude": 77.0, "location_consent": False},
        headers=h,
    )
    assert resp.status_code == 200, resp.text
    loc = resp.json()["data"]["location"]
    assert loc["consent"] is False, "Explicit false consent must remain False"


# ---------------------------------------------------------------------------
# 5. JWT config rejection
# ---------------------------------------------------------------------------
def test_jwt_secret_validation():
    """Production-like config must reject weak/empty/placeholder JWT secrets."""
    from app.core.config import Settings
    import os

    os.environ["ENVIRONMENT"] = "production"
    os.environ["JWT_SECRET"] = ""
    try:
        raised = False
        try:
            Settings()
        except ValueError:
            raised = True
        assert raised, "Production config must reject empty/placeholder JWT secret"
    finally:
        os.environ.pop("JWT_SECRET", None)
        os.environ["ENVIRONMENT"] = "development"
        # Restore the module-level Settings instance's development environment for later tests.
        from app.core.config import settings
        settings.ENVIRONMENT = "development"
        settings.JWT_SECRET = "test-only-secret-key-for-local-pytest-suite-runs-only"

