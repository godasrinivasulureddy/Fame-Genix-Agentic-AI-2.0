from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.audit.helper import record_audit
from app.core.dependencies import require_role
from app.core.events import DOCTOR_REVIEW_COMPLETED, event_bus
from app.core.exceptions import app_error
from app.core.response import ok
from app.db.models import Doctor, DoctorReview, Role, User
from app.db.session import get_db
from app.doctors.schemas import EscalateRequest, ReviewRequest
from app.doctors.service import build_queue, latest_vitals
from app.patients.service import build_timeline, get_patient_or_404
from app.db.models import RiskAssessment, RiskFactor

router = APIRouter(prefix="/api/v1/doctors", tags=["doctors"])


def _get_doctor(db: Session, user: User) -> Doctor:
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise app_error("NOT_FOUND", "Doctor profile not found for current user.")
    return doctor


@router.get("/queue")
def get_queue(user: User = Depends(require_role(Role.DOCTOR)), db: Session = Depends(get_db)):
    return ok(build_queue(db))


@router.get("/patients/{patient_id}")
def get_patient_view(patient_id: str, user: User = Depends(require_role(Role.DOCTOR)), db: Session = Depends(get_db)):
    patient = get_patient_or_404(db, patient_id)
    latest = (
        db.query(RiskAssessment)
        .filter(RiskAssessment.patient_id == patient_id)
        .order_by(RiskAssessment.created_at.desc())
        .first()
    )
    factors = []
    if latest:
        factors = db.query(RiskFactor).filter(RiskFactor.assessment_id == latest.id).all()
    reviews = db.query(DoctorReview).filter(DoctorReview.patient_id == patient_id).all()

    return ok({
        "patient": {"id": patient.id, "full_name": patient.full_name,
                    "known_conditions": patient.known_conditions},
        "latest_assessment": None if not latest else {
            "id": latest.id, "risk_score": latest.risk_score, "confidence_score": latest.confidence_score,
            "care_level": latest.care_level, "suggested_action": latest.suggested_action,
        },
        "explanation_factors": [{"factor_name": f.factor_name, "contribution": f.contribution,
                                  "direction": f.direction} for f in factors],
        "latest_vitals": latest_vitals(db, patient_id),
        "previous_reviews": [{"id": r.id, "decision": r.decision, "note": r.note, "created_at": r.created_at}
                              for r in reviews],
        "timeline": build_timeline(db, patient_id),
    })


@router.post("/reviews")
def add_review(payload: ReviewRequest, user: User = Depends(require_role(Role.DOCTOR)), db: Session = Depends(get_db)):
    doctor = _get_doctor(db, user)
    review = DoctorReview(doctor_id=doctor.id, patient_id=payload.patient_id,
                           assessment_id=payload.assessment_id, note=payload.note, decision=payload.decision)
    db.add(review)
    db.commit()
    db.refresh(review)

    record_audit(db, user.id, user.role, "DOCTOR_REVIEW", "patient", payload.patient_id,
                 metadata={"decision": payload.decision, "review_id": review.id})
    event_bus.publish(DOCTOR_REVIEW_COMPLETED, {"patient_id": payload.patient_id, "decision": payload.decision,
                                                 "doctor_id": doctor.id, "review_id": review.id})
    return ok({"id": review.id, "decision": review.decision, "created_at": review.created_at})


@router.post("/escalate")
def escalate(payload: EscalateRequest, user: User = Depends(require_role(Role.DOCTOR)), db: Session = Depends(get_db)):
    doctor = _get_doctor(db, user)
    review = DoctorReview(doctor_id=doctor.id, patient_id=payload.patient_id, note=payload.note,
                           decision="URGENT_REVIEW")
    db.add(review)
    db.commit()
    record_audit(db, user.id, user.role, "ESCALATE", "patient", payload.patient_id)
    return ok({"patient_id": payload.patient_id, "decision": "URGENT_REVIEW"})


@router.post("/deescalate")
def deescalate(payload: EscalateRequest, user: User = Depends(require_role(Role.DOCTOR)), db: Session = Depends(get_db)):
    doctor = _get_doctor(db, user)
    review = DoctorReview(doctor_id=doctor.id, patient_id=payload.patient_id, note=payload.note,
                           decision="MONITOR")
    db.add(review)
    db.commit()
    record_audit(db, user.id, user.role, "DEESCALATE", "patient", payload.patient_id)
    return ok({"patient_id": payload.patient_id, "decision": "MONITOR"})


@router.delete("/reviews/{review_id}")
def delete_review(review_id: str, user: User = Depends(require_role(Role.DOCTOR)), db: Session = Depends(get_db)):
    review = db.query(DoctorReview).filter(DoctorReview.id == review_id).first()
    if not review:
        raise app_error("NOT_FOUND", "Review not found")
    patient_id = review.patient_id
    db.delete(review)
    db.commit()
    record_audit(db, user.id, user.role, "DOCTOR_REVIEW_DELETED", "review", review_id,
                 metadata={"patient_id": patient_id})
    return ok({"deleted_id": review_id})


@router.get("/consultations/queue")
def get_consultation_queue(user: User = Depends(require_role(Role.DOCTOR)), db: Session = Depends(get_db)):
    from app.db.models import DoctorConsultationRequest, Patient, CareLevel
    reqs = (
        db.query(DoctorConsultationRequest)
        .filter(DoctorConsultationRequest.status.in_(["WAITING", "IN_REVIEW"]))
        .all()
    )

    def sort_key(r: DoctorConsultationRequest):
        care_level_idx = CareLevel.ORDER.index(r.care_level) if r.care_level in CareLevel.ORDER else 0
        return (-care_level_idx, -r.risk_score, r.requested_at)

    reqs.sort(key=sort_key)

    res = []
    for r in reqs:
        patient = db.query(Patient).filter(Patient.id == r.patient_id).first()
        res.append({
            "id": r.id,
            "patient_id": r.patient_id,
            "patient_name": patient.full_name if patient else "Unknown",
            "assessment_id": r.assessment_id,
            "doctor_id": r.doctor_id,
            "specialty": r.specialty,
            "health_summary": r.health_summary,
            "risk_score": r.risk_score,
            "care_level": r.care_level,
            "token_number": r.token_number,
            "status": r.status,
            "requested_at": r.requested_at.isoformat() if r.requested_at else None,
            "started_at": r.started_at.isoformat() if r.started_at else None,
        })
    return ok(res)


@router.get("/consultations/{request_id}")
def get_consultation_detail(request_id: str, user: User = Depends(require_role(Role.DOCTOR)), db: Session = Depends(get_db)):
    from app.db.models import DoctorConsultationRequest, Patient
    r = db.query(DoctorConsultationRequest).filter(DoctorConsultationRequest.id == request_id).first()
    if not r:
        raise app_error("NOT_FOUND", "Consultation request not found")

    patient = db.query(Patient).filter(Patient.id == r.patient_id).first()
    return ok({
        "id": r.id,
        "patient_id": r.patient_id,
        "patient_name": patient.full_name if patient else "Unknown",
        "assessment_id": r.assessment_id,
        "doctor_id": r.doctor_id,
        "specialty": r.specialty,
        "health_summary": r.health_summary,
        "risk_score": r.risk_score,
        "care_level": r.care_level,
        "token_number": r.token_number,
        "status": r.status,
        "requested_at": r.requested_at.isoformat() if r.requested_at else None,
        "started_at": r.started_at.isoformat() if r.started_at else None,
        "completed_at": r.completed_at.isoformat() if r.completed_at else None,
    })


@router.post("/consultations/{request_id}/start")
def start_consultation_review(request_id: str, user: User = Depends(require_role(Role.DOCTOR)), db: Session = Depends(get_db)):
    from app.db.models import DoctorConsultationRequest
    from datetime import datetime
    r = db.query(DoctorConsultationRequest).filter(DoctorConsultationRequest.id == request_id).first()
    if not r:
        raise app_error("NOT_FOUND", "Consultation request not found")
    if r.status != "WAITING":
        raise app_error("INVALID_STATE", f"Cannot start review for status: {r.status}")

    doctor = _get_doctor(db, user)
    r.status = "IN_REVIEW"
    r.started_at = datetime.utcnow()
    r.doctor_id = doctor.id
    db.commit()
    db.refresh(r)
    record_audit(db, user.id, user.role, "CONSULTATION_IN_REVIEW", "consultation", r.id)
    return ok({"status": "IN_REVIEW", "started_at": r.started_at.isoformat()})


@router.post("/consultations/{request_id}/complete")
def complete_consultation_review(request_id: str, user: User = Depends(require_role(Role.DOCTOR)), db: Session = Depends(get_db)):
    from app.db.models import DoctorConsultationRequest
    from datetime import datetime
    r = db.query(DoctorConsultationRequest).filter(DoctorConsultationRequest.id == request_id).first()
    if not r:
        raise app_error("NOT_FOUND", "Consultation request not found")
    if r.status != "IN_REVIEW":
        raise app_error("INVALID_STATE", f"Cannot complete review for status: {r.status}")

    r.status = "COMPLETED"
    r.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(r)
    record_audit(db, user.id, user.role, "CONSULTATION_COMPLETED", "consultation", r.id)
    return ok({"status": "COMPLETED", "completed_at": r.completed_at.isoformat()})



@router.post("/patients/{patient_id}/soap-note")
def generate_patient_soap_note(
    patient_id: str,
    payload: dict,
    user=Depends(require_role(Role.DOCTOR)),
    db: Session = Depends(get_db)
):
    """Autonomous Medical Scribe: Generates standardized Clinical SOAP Note with 1-click EHR export."""
    from app.doctors.scribe_engine import scribe_engine
    patient = get_patient_or_404(db, patient_id)
    vitals = payload.get("vitals", {"spo2": 96.0, "hr": 78.0, "rr": 16.0, "temp": 37.0})
    labs = payload.get("labs", {})
    transcript = payload.get("transcript", "Routine medical follow-up encounter.")
    lang = payload.get("language", "en")

    note = scribe_engine.generate_soap_note(
        patient_id=patient.id,
        patient_name=patient.full_name,
        transcript_or_text=transcript,
        vitals=vitals,
        lab_markers=labs,
        language=lang
    )
    return ok(note.model_dump())
