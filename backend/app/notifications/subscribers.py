from app.core.events import (AMBULANCE_STATUS_CHANGED, DISPATCH_REQUESTED,
                              DOCTOR_REVIEW_COMPLETED, DRIFT_DETECTED,
                              EMERGENCY_CASE_CREATED, HOSPITAL_NOTIFIED,
                              RISK_ASSESSMENT_CREATED, event_bus)
from app.db.models import CareLevel, EmergencyCase, Patient, Role, User
from app.db.session import SessionLocal
from app.notifications.service import notify
from app.notifications.gateway import notification_gateway

HIGH_PRIORITY_LEVELS = {CareLevel.URGENT, CareLevel.POSSIBLE_EMERGENCY}


def _patient_user_id(db, patient_id: str) -> str | None:
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    return p.user_id if p else None


def _user_ids_for_role(db, role: str) -> list[str]:
    return [u.id for u in db.query(User).filter(User.role == role).all()]


def _on_drift_detected(payload: dict) -> None:
    db = SessionLocal()
    try:
        user_id = _patient_user_id(db, payload["patient_id"])
        if user_id:
            notify(db, user_id, "HEALTH_DRIFT_DETECTED", payload["drift"])
    finally:
        db.close()


def _on_risk_assessment_created(payload: dict) -> None:
    db = SessionLocal()
    try:
        patient_id = payload.get("patient_id")
        patient = db.query(Patient).filter(Patient.id == patient_id).first() if patient_id else None
        user_id = patient.user_id if patient else None

        if user_id:
            notify(db, user_id, "ASSESSMENT_READY", payload)

        # Multi-channel notification: SMS and Email dispatch for health analysis
        if patient:
            care_level_str = str(payload.get("care_level", "STABLE"))
            risk_score = float(payload.get("risk_score", 0.0))
            notification_gateway.dispatch_critical_vitals_alert(
                db=db,
                patient=patient,
                metric="AI Health Analysis Risk Score",
                value=risk_score,
                unit="%",
                care_level=care_level_str
            )

        if payload.get("care_level") in HIGH_PRIORITY_LEVELS:
            for doc_user_id in _user_ids_for_role(db, Role.DOCTOR):
                notify(db, doc_user_id, "DOCTOR_REVIEW_REQUIRED", payload)
    finally:
        db.close()


def _on_doctor_review_completed(payload: dict) -> None:
    db = SessionLocal()
    try:
        user_id = _patient_user_id(db, payload["patient_id"])
        if user_id:
            notify(db, user_id, "DOCTOR_REVIEW_COMPLETED", payload)
    finally:
        db.close()


def _on_emergency_case_created(payload: dict) -> None:
    db = SessionLocal()
    try:
        user_id = _patient_user_id(db, payload["patient_id"])
        if user_id:
            notify(db, user_id, "EMERGENCY_CASE_CREATED", payload)
        for op_user_id in _user_ids_for_role(db, Role.EMERGENCY_OPERATOR):
            notify(db, op_user_id, "EMERGENCY_CASE_CREATED", payload)
    finally:
        db.close()


def _on_dispatch_or_status(payload: dict) -> None:
    db = SessionLocal()
    try:
        case = db.query(EmergencyCase).filter(EmergencyCase.id == payload["case_id"]).first()
        if not case:
            return
        user_id = _patient_user_id(db, case.patient_id)
        if user_id:
            notify(db, user_id, "DISPATCH_UPDATED", payload)
        for amb_user_id in _user_ids_for_role(db, Role.AMBULANCE_TEAM):
            notify(db, amb_user_id, "DISPATCH_UPDATED", payload)
    finally:
        db.close()


def _on_hospital_notified(payload: dict) -> None:
    db = SessionLocal()
    try:
        for op_user_id in _user_ids_for_role(db, Role.EMERGENCY_OPERATOR):
            notify(db, op_user_id, "HOSPITAL_NOTIFIED", payload)
    finally:
        db.close()


def register_subscribers() -> None:
    event_bus.subscribe(DRIFT_DETECTED, _on_drift_detected)
    event_bus.subscribe(RISK_ASSESSMENT_CREATED, _on_risk_assessment_created)
    event_bus.subscribe(DOCTOR_REVIEW_COMPLETED, _on_doctor_review_completed)
    event_bus.subscribe(EMERGENCY_CASE_CREATED, _on_emergency_case_created)
    event_bus.subscribe(DISPATCH_REQUESTED, _on_dispatch_or_status)
    event_bus.subscribe(AMBULANCE_STATUS_CHANGED, _on_dispatch_or_status)
    event_bus.subscribe(HOSPITAL_NOTIFIED, _on_hospital_notified)
