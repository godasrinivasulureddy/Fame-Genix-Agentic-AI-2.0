from fastapi import APIRouter, Depends, Request
from jwt import PyJWTError
from sqlalchemy.orm import Session

from app.audit.helper import record_audit
from app.auth.schemas import (LoginRequest, MeResponse, RefreshRequest,
                               RegisterRequest, TokenResponse)
from app.core.dependencies import get_current_user
from app.core.exceptions import app_error
from app.core.response import ok
from app.core.security import (create_access_token, create_refresh_token,
                                decode_token, hash_password, verify_password)
from app.core.limiter import limiter
from app.db.models import Doctor, Patient, Role, User
from app.db.session import get_db

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


# Roles that may NOT be self-registered. Clinician, emergency operator,
# ambulance team and system-admin accounts must be created through an
# administrative invite/onboarding flow (or the seed script) to preserve the
# strict privilege boundary documented for FAME-GENIX.
_SELF_SERVICE_ROLES = {Role.PATIENT}


@router.post("/register")
@limiter.limit("15/minute")
def register(request: Request, payload: RegisterRequest, db: Session = Depends(get_db)):
    if payload.role not in Role.ALL:
        raise app_error("VALIDATION_ERROR", f"role must be one of {Role.ALL}")
    if payload.role not in _SELF_SERVICE_ROLES:
        raise app_error(
            "ACCESS_DENIED",
            f"Self-registration as '{payload.role}' is not permitted. "
            f"Self-service registration is limited to: {', '.join(sorted(_SELF_SERVICE_ROLES))}. "
            f"Clinician/admin accounts must be provisioned by a SYSTEM_ADMIN.",
        )
    if db.query(User).filter(User.email == payload.email).first():
        raise app_error("ALREADY_EXISTS", "Email already registered.")

    user = User(email=payload.email, password_hash=hash_password(payload.password), role=payload.role)
    db.add(user)
    db.flush()

    if payload.role == Role.PATIENT:
        count = db.query(Patient).count() + 1
        pub_id = f"FG-P-{str(count).zfill(6)}"
        db.add(Patient(user_id=user.id, full_name=payload.full_name, public_id=pub_id))

    db.commit()
    record_audit(db, user.id, user.role, "REGISTER", "user", user.id)

    access = create_access_token(user.id, user.role)
    refresh = create_refresh_token(user.id, user.role)
    return ok(TokenResponse(access_token=access, refresh_token=refresh).model_dump())


import time

# In-memory progressive failed login tracking: {email: [timestamp, failed_count]}
_FAILED_LOGINS: dict[str, tuple[float, int]] = {}
_MAX_FAILED_ATTEMPTS = 5
_LOCKOUT_DURATION_SECONDS = 300  # 5 minutes lockout


@router.post("/login")
@limiter.limit("20/minute")
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    email_key = payload.email.lower().strip()
    now = time.time()

    # Check progressive lockout
    if email_key in _FAILED_LOGINS:
        last_failed_time, failed_count = _FAILED_LOGINS[email_key]
        if failed_count >= _MAX_FAILED_ATTEMPTS:
            remaining = int(_LOCKOUT_DURATION_SECONDS - (now - last_failed_time))
            if remaining > 0:
                record_audit(db, None, None, "LOGIN_LOCKED", "user", email_key, result="BLOCKED")
                raise app_error(
                    "ACCOUNT_TEMPORARILY_LOCKED",
                    f"Too many failed login attempts. Account temporarily locked for security. Please try again in {remaining} seconds."
                )
            else:
                # Lockout expired, reset counter
                _FAILED_LOGINS.pop(email_key, None)

    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        current_count = _FAILED_LOGINS.get(email_key, (now, 0))[1] + 1
        _FAILED_LOGINS[email_key] = (now, current_count)
        record_audit(db, None, None, "LOGIN", "user", payload.email, result="FAILED")
        
        remaining_attempts = max(0, _MAX_FAILED_ATTEMPTS - current_count)
        if remaining_attempts > 0:
            msg = f"Invalid email or password. {remaining_attempts} attempt(s) remaining before temporary lockout."
        else:
            msg = f"Invalid credentials. Account locked for {_LOCKOUT_DURATION_SECONDS // 60} minutes due to multiple failed attempts."
        raise app_error("INVALID_CREDENTIALS", msg)

    # Reset failed attempts upon successful login
    _FAILED_LOGINS.pop(email_key, None)

    record_audit(db, user.id, user.role, "LOGIN", "user", user.id)
    access = create_access_token(user.id, user.role)
    refresh = create_refresh_token(user.id, user.role)
    return ok(TokenResponse(access_token=access, refresh_token=refresh).model_dump())


@router.post("/refresh")
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    try:
        data = decode_token(payload.refresh_token)
        if data.get("type") != "refresh":
            raise app_error("AUTH_REQUIRED", "Invalid token type.")
    except PyJWTError:
        raise app_error("AUTH_REQUIRED", "Invalid or expired refresh token.")

    user = db.query(User).filter(User.id == data["sub"]).first()
    if not user:
        raise app_error("AUTH_REQUIRED", "User no longer exists.")

    access = create_access_token(user.id, user.role)
    new_refresh = create_refresh_token(user.id, user.role)
    return ok(TokenResponse(access_token=access, refresh_token=new_refresh).model_dump())


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return ok(MeResponse(id=user.id, email=user.email, role=user.role).model_dump())
