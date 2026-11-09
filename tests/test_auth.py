from tests.conftest import auth_headers, register


def test_register_and_login(client):
    token = register(client, "p1@test.com", "PATIENT")
    assert token

    resp = client.post("/api/v1/auth/login", json={"email": "p1@test.com", "password": "Password123!"})
    assert resp.status_code == 200
    assert resp.json()["data"]["access_token"]


def test_login_wrong_password_rejected(client):
    register(client, "p2@test.com", "PATIENT")
    resp = client.post("/api/v1/auth/login", json={"email": "p2@test.com", "password": "wrong"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_non_patient_self_registration_is_rejected(client):
    """Privilege boundary: PATIENT is the only role open to self-registration."""
    for privileged_role in ["DOCTOR", "EMERGENCY_OPERATOR", "SYSTEM_ADMIN", "AMBULANCE_TEAM"]:
        resp = client.post("/api/v1/auth/register", json={
            "email": f"priv_{privileged_role.lower()}@test.com",
            "password": "Password123!",
            "role": privileged_role,
            "full_name": f"Privileged {privileged_role}",
        })
        assert resp.status_code == 403, resp.text
        assert resp.json()["error"]["code"] == "ACCESS_DENIED"


def test_forbidden_role_cannot_access_doctor_queue(client):
    token = register(client, "p3@test.com", "PATIENT")
    resp = client.get("/api/v1/doctors/queue", headers=auth_headers(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "ACCESS_DENIED"


def test_patient_cannot_access_other_patient(client):
    token_a = register(client, "a@test.com", "PATIENT", full_name="A")
    token_b = register(client, "b@test.com", "PATIENT", full_name="B")

    me_a = client.get("/api/v1/patients/me", headers=auth_headers(token_a)).json()["data"]
    resp = client.get(f"/api/v1/patients/{me_a['id']}", headers=auth_headers(token_b))
    assert resp.status_code == 403
