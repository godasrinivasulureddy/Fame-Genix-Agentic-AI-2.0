"""
FAME-GENIX Unified Portal Settings & Configuration Engine:
Provides dedicated operational settings for Patient, Doctor, Emergency Ops,
Ambulance Team, and Admin portals.
"""

from typing import Dict, Any, List
from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_role
from app.core.response import ok
from app.db.models import Role, User
from app.db.session import get_db

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])

# In-memory Portal Settings Store (Initialized with clinical defaults)
PORTAL_SETTINGS: Dict[str, Dict[str, Any]] = {
    Role.PATIENT: {
        "telemetry_stream_interval_sec": 5,
        "auto_sos_contact_escalation": True,
        "vitals_desaturation_threshold_spo2": 88,
        "heart_rate_tachycardia_threshold_bpm": 120,
        "language_preference": "en",
        "voice_synthesis_enabled": True,
        "dark_mode": True,
        "high_contrast_mode": False
    },
    Role.DOCTOR: {
        "clinical_queue_sorting": "TRIAGE_ACUITY_DESC",
        "auto_refresh_queue_seconds": 10,
        "highlight_abnormal_biomarkers": True,
        "contraindication_safety_intercept": True,
        "prescribing_formulary": "HOSPITAL_STANDARD_2026",
        "sound_alerts_on_critical_case": True,
        "xai_reasoning_accordion_expanded": True
    },
    Role.EMERGENCY_OPERATOR: {
        "auto_route_ambulance_on_verification": True,
        "preferred_hospital_network": "METROPOLITAN_ZONE_A",
        "enable_ambient_cctv_fall_feed": True,
        "telemetry_stream_refresh_hz": 1,
        "dispatch_protocol": "ADVANCED_CARDIAC_LIFE_SUPPORT",
        "auto_generate_handover_passport": True
    },
    Role.AMBULANCE_TEAM: {
        "gps_beacon_interval_seconds": 5,
        "auto_transit_status_advancement": False,
        "offline_caching_enabled": True,
        "enable_voice_paramedic_scribe": True,
        "screen_always_on": True
    },
    Role.SYSTEM_ADMIN: {
        "self_healing_retry_attempts": 3,
        "audit_log_immutable_retention_days": 365,
        "ai_model_failover_order": ["NEBIUS_NVIDIA", "GEMINI_2_5", "DETERMINISTIC_RULES"],
        "rate_limit_per_minute": 120,
        "maintenance_mode": False
    }
}


@router.get("/me")
def get_user_portal_settings(user: User = Depends(get_current_user)):
    """Retrieves role-specific portal operational configuration."""
    role = user.role
    config = PORTAL_SETTINGS.get(role, PORTAL_SETTINGS[Role.PATIENT])
    return ok({"role": role, "settings": config})


@router.put("/me")
def update_user_portal_settings(
    payload: Dict[str, Any] = Body(...),
    user: User = Depends(get_current_user)
):
    """Updates role-specific operational preferences."""
    role = user.role
    if role in PORTAL_SETTINGS:
        PORTAL_SETTINGS[role].update(payload)
    return ok({
        "status": "SUCCESS",
        "role": role,
        "updated_settings": PORTAL_SETTINGS.get(role, {}),
        "message": f"Successfully updated settings for {role} portal."
    })
