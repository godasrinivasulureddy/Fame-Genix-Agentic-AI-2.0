import json

from sqlalchemy.orm import Session

from app.core.events import (AMBULANCE_STATUS_CHANGED, DISPATCH_REQUESTED,
                              EMERGENCY_CASE_CREATED, EMERGENCY_VERIFIED,
                              HOSPITAL_NOTIFIED, event_bus)
from app.core.exceptions import app_error
from app.db.models import (EMERGENCY_TRANSITIONS, AmbulanceAssignment,
                            DeviceReading, EmergencyCase, EmergencyCaseEvent,
                            EmergencyStatus, HospitalHandoff)

# Forward sequence used by the manual "advance" demo control once dispatched.
ADVANCE_SEQUENCE = [
    EmergencyStatus.DISPATCHED,
    EmergencyStatus.EN_ROUTE,
    EmergencyStatus.ON_SCENE,
    EmergencyStatus.TRANSPORTING,
    EmergencyStatus.HOSPITAL_REACHED,
    EmergencyStatus.COMPLETED,
]


def _snapshot_measurements(db: Session, patient_id: str) -> dict:
    metrics = ["heart_rate", "spo2", "respiratory_rate", "temperature", "voc_index"]
    snapshot = {}
    for m in metrics:
        r = (
            db.query(DeviceReading)
            .filter(DeviceReading.patient_id == patient_id, DeviceReading.metric == m)
            .order_by(DeviceReading.recorded_at.desc())
            .first()
        )
        if r:
            snapshot[m] = {"value": r.value, "quality": r.quality}
    return snapshot


def _log_event(db: Session, case_id: str, event_type: str, payload: dict) -> None:
    db.add(EmergencyCaseEvent(case_id=case_id, event_type=event_type, payload=json.dumps(payload)))


def create_case(
    db: Session, patient_id: str, trigger_type: str, severity: str = "POSSIBLE_EMERGENCY",
    trigger_rule_id: str | None = None, trigger_assessment_id: str | None = None,
) -> EmergencyCase:
    measurements = _snapshot_measurements(db, patient_id)
    quality_values = {v["quality"] for v in measurements.values()} or {"UNKNOWN"}

    case = EmergencyCase(
        patient_id=patient_id, status=EmergencyStatus.DETECTED, severity=severity,
        trigger_type=trigger_type, trigger_rule_id=trigger_rule_id,
        trigger_assessment_id=trigger_assessment_id,
        trigger_measurements=json.dumps(measurements),
        measurement_quality=",".join(sorted(quality_values)),
        simulation_status="SIMULATED",
    )
    db.add(case)
    db.flush()
    _log_event(db, case.id, "DETECTED", {"trigger_type": trigger_type, "measurements": measurements})
    db.commit()
    db.refresh(case)

    event_bus.publish(EMERGENCY_CASE_CREATED, {"case_id": case.id, "patient_id": patient_id,
                                                "trigger_type": trigger_type})
    return case


def get_case_or_404(db: Session, case_id: str) -> EmergencyCase:
    case = db.query(EmergencyCase).filter(EmergencyCase.id == case_id).first()
    if not case:
        raise app_error("EMERGENCY_CASE_NOT_FOUND", "Emergency case not found.")
    return case


def _transition(db: Session, case: EmergencyCase, new_status: str, event_type: str, payload: dict) -> EmergencyCase:
    allowed = EMERGENCY_TRANSITIONS.get(case.status, [])
    if new_status not in allowed:
        raise app_error("INVALID_STATE_TRANSITION", f"Cannot move from {case.status} to {new_status}.")
    case.status = new_status
    _log_event(db, case.id, event_type, payload)
    db.commit()
    db.refresh(case)
    return case


def mark_under_review(db: Session, case: EmergencyCase) -> EmergencyCase:
    return _transition(db, case, EmergencyStatus.UNDER_REVIEW, "UNDER_REVIEW", {})


def verify(db: Session, case: EmergencyCase, verified_by_user_id: str) -> EmergencyCase:
    if case.status == EmergencyStatus.DETECTED:
        case = mark_under_review(db, case)
    case = _transition(db, case, EmergencyStatus.VERIFIED, "VERIFIED", {"verified_by": verified_by_user_id})
    event_bus.publish(EMERGENCY_VERIFIED, {"case_id": case.id, "patient_id": case.patient_id})
    return case


def request_dispatch(db: Session, case: EmergencyCase) -> EmergencyCase:
    case = _transition(db, case, EmergencyStatus.DISPATCH_REQUESTED, "DISPATCH_REQUESTED", {})
    case = _transition(db, case, EmergencyStatus.DISPATCHED, "DISPATCHED", {})
    assignment = AmbulanceAssignment(case_id=case.id, status="DISPATCHED")
    db.add(assignment)
    db.commit()
    event_bus.publish(DISPATCH_REQUESTED, {"case_id": case.id, "patient_id": case.patient_id})
    return case


def advance(db: Session, case: EmergencyCase) -> EmergencyCase:
    """Manually steps the simulated ambulance/hospital workflow forward one stage."""
    if case.status not in EMERGENCY_TRANSITIONS or not EMERGENCY_TRANSITIONS[case.status]:
        raise app_error("INVALID_STATE_TRANSITION", f"No further transitions from {case.status}.")

    current_status = case.status
    if current_status == "PATIENT_REACHED":
        current_status = "ON_SCENE"

    current_index = ADVANCE_SEQUENCE.index(current_status) if current_status in ADVANCE_SEQUENCE else -1
    next_status = ADVANCE_SEQUENCE[current_index + 1] if current_index + 1 < len(ADVANCE_SEQUENCE) else None
    if next_status is None:
        raise app_error("INVALID_STATE_TRANSITION", "Case already complete.")

    case = _transition(db, case, next_status, f"ADVANCED_TO_{next_status}", {})

    assignment = db.query(AmbulanceAssignment).filter(AmbulanceAssignment.case_id == case.id).first()
    if assignment:
        assignment.status = next_status
        db.commit()
    event_bus.publish(AMBULANCE_STATUS_CHANGED, {"case_id": case.id, "status": next_status})

    if next_status == EmergencyStatus.HOSPITAL_REACHED:
        handoff = HospitalHandoff(case_id=case.id, status="PATIENT_ARRIVED", eta_minutes=0,
                                   summary="Simulated hospital arrival.")
        db.add(handoff)
        db.commit()
        event_bus.publish(HOSPITAL_NOTIFIED, {"case_id": case.id, "status": "PATIENT_ARRIVED"})
    elif next_status == EmergencyStatus.DISPATCHED:
        handoff = HospitalHandoff(case_id=case.id, status="NOTIFIED", eta_minutes=15,
                                   summary="Simulated pre-arrival notification.")
        db.add(handoff)
        db.commit()
        event_bus.publish(HOSPITAL_NOTIFIED, {"case_id": case.id, "status": "NOTIFIED"})

    return case


def attach_location(db: Session, case: EmergencyCase, lat: float, lng: float, accuracy: float | None,
                     consent: bool) -> EmergencyCase:
    if not consent:
        raise app_error("CONSENT_REQUIRED", "Location sharing consent is required for this action.")
    case.latitude, case.longitude, case.location_accuracy = lat, lng, accuracy
    case.location_source = "MANUAL_DEMO"
    case.location_consent = True
    db.commit()
    _log_event(db, case.id, "LOCATION_UPDATED", {"lat": lat, "lng": lng})
    db.commit()
    db.refresh(case)
    return case
