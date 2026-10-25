import json

from sqlalchemy.orm import Session

from app.core.exceptions import app_error
from app.db.models import (DoctorReview, DriftEvent, EmergencyCase,
                            EmergencyCaseEvent, Patient, RiskAssessment,
                            Role, SymptomSession, User)


def get_patient_by_user(db: Session, user: User) -> Patient:
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise app_error("PATIENT_NOT_FOUND", "No patient profile for current user.")
    return patient


def get_patient_or_404(db: Session, patient_id: str) -> Patient:
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise app_error("PATIENT_NOT_FOUND", "Patient not found.")
    return patient


def assert_can_view_patient(user: User, patient: Patient) -> None:
    """Authorization check: patient sees only self; clinical/ops roles
    may view any patient."""
    if user.role == Role.PATIENT and patient.user_id != user.id:
        raise app_error("ACCESS_DENIED", "Access denied: cannot view another patient's profile.")
    return


def build_timeline(db: Session, patient_id: str) -> list[dict]:
    events: list[dict] = []

    for s in db.query(SymptomSession).filter(SymptomSession.patient_id == patient_id).all():
        events.append({"type": "SYMPTOM_SESSION", "timestamp": s.created_at, "summary": s.raw_text[:80],
                        "data": {"id": s.id, "status": s.status}})

    for r in db.query(RiskAssessment).filter(RiskAssessment.patient_id == patient_id).all():
        events.append({"type": "RISK_ASSESSMENT", "timestamp": r.created_at,
                        "summary": f"Risk {r.risk_score} / Care {r.care_level}",
                        "data": {"id": r.id, "risk_score": r.risk_score,
                                 "confidence_score": r.confidence_score, "care_level": r.care_level}})

    for d in db.query(DriftEvent).filter(DriftEvent.patient_id == patient_id).all():
        events.append({"type": "DRIFT_EVENT", "timestamp": d.detected_at,
                        "summary": f"Drift {d.severity} ({d.direction})",
                        "data": {"id": d.id, "drift_score": d.drift_score, "severity": d.severity}})

    for rv in db.query(DoctorReview).filter(DoctorReview.patient_id == patient_id).all():
        events.append({"type": "DOCTOR_REVIEW", "timestamp": rv.created_at,
                        "summary": f"Doctor decision: {rv.decision}",
                        "data": {"id": rv.id, "decision": rv.decision, "note": rv.note}})

    for c in db.query(EmergencyCase).filter(EmergencyCase.patient_id == patient_id).all():
        events.append({"type": "EMERGENCY_CASE", "timestamp": c.created_at,
                        "summary": f"Emergency case {c.status} ({c.simulation_status})",
                        "data": {"id": c.id, "status": c.status}})
        for ce in db.query(EmergencyCaseEvent).filter(EmergencyCaseEvent.case_id == c.id).all():
            events.append({"type": f"EMERGENCY_{ce.event_type}", "timestamp": ce.created_at,
                            "summary": ce.event_type,
                            "data": json.loads(ce.payload) if ce.payload else {}})

    events.sort(key=lambda e: e["timestamp"])
    return events
