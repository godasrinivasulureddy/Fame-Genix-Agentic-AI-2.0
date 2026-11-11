import json

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.assessments.schemas import CreateAssessmentRequest
from app.assessments.service import run_assessment
from app.core.dependencies import get_current_user, require_role
from app.core.exceptions import app_error
from app.core.response import ok
from app.db.models import RiskAssessment, RiskFactor, Role, User
from app.db.session import get_db
from app.patients.service import assert_can_view_patient, get_patient_by_user, get_patient_or_404

router = APIRouter(prefix="/api/v1/assessments", tags=["assessments"])

# Concepts treated as self-reported conditions (get "Reported Concern:" prefix)
_CONDITION_NAMES = {
    "kidney_failure", "heart_failure", "stroke_symptoms", "heart_attack_symptoms",
    "spinal_injury", "sepsis_signs", "hypoglycemia", "hyperglycemia",
    "loss_of_consciousness", "seizure",
}


def _serialize(a: RiskAssessment, db: Session = None) -> dict:
    top_factors = []
    active_symptoms = []
    red_flags = []
    if db:
        factors = db.query(RiskFactor).filter(RiskFactor.assessment_id == a.id).all()
        top_factors = [
            {"factor_name": f.factor_name, "contribution": f.contribution, "direction": f.direction}
            for f in factors
        ]
        if a.session_id:
            from app.db.models import SymptomEntry
            from app.symptoms.medical_nlp import DISPLAY_OVERRIDES
            entries = db.query(SymptomEntry).filter(SymptomEntry.session_id == a.session_id).all()
            active_symptoms = []
            for e in entries:
                base_display = DISPLAY_OVERRIDES.get(
                    e.concept,
                    e.concept.replace('_', ' ').title()
                )
                if e.concept in _CONDITION_NAMES:
                    display_name = f"Reported Concern: {base_display}"
                else:
                    display_name = base_display
                active_symptoms.append({"name": display_name, "severity": e.severity})
            if a.care_level in ["EMERGENCY_DISPATCH", "PRIORITY_REVIEW"]:
                red_flags.append(a.care_level)

    vitals_map = {}
    if db:
        from app.db.models import DeviceReading
        for m in ["heart_rate", "spo2", "respiratory_rate", "temperature"]:
            # Check readings recorded within +/- 2 minutes of the assessment
            r = (
                db.query(DeviceReading)
                .filter(DeviceReading.patient_id == a.patient_id, DeviceReading.metric == m)
                .order_by(DeviceReading.recorded_at.desc())
                .first()
            )
            if r:
                vitals_map[m] = float(r.value)

    # Format ISO timestamp with UTC 'Z' so clients parse it precisely in their local timezone
    created_at_iso = (
        (a.created_at.isoformat() + "Z")
        if a.created_at and not a.created_at.isoformat().endswith("Z")
        else a.created_at
    )

    return {
        "id": a.id, "patient_id": a.patient_id, "session_id": a.session_id,
        "risk_score": a.risk_score, "confidence_score": a.confidence_score,
        "care_level": a.care_level, "suggested_action": a.suggested_action,
        "top_factors": top_factors,
        "active_symptoms": active_symptoms,
        "negated_symptoms": [],
        "red_flags": red_flags,
        "missing_evidence": json.loads(a.missing_evidence or "[]"),
        "vitals": vitals_map,
        "created_at": created_at_iso,
    }


@router.post("")
def create_assessment(payload: CreateAssessmentRequest, user: User = Depends(require_role(Role.PATIENT)),
                       db: Session = Depends(get_db)):
    patient = get_patient_by_user(db, user)
    assessment = run_assessment(db, patient.id, payload.session_id)
    return ok(_serialize(assessment, db))


@router.get("/{assessment_id}")
def get_assessment(assessment_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    a = db.query(RiskAssessment).filter(RiskAssessment.id == assessment_id).first()
    if not a:
        raise app_error("NOT_FOUND", "Assessment not found.")
    patient = get_patient_or_404(db, a.patient_id)
    assert_can_view_patient(user, patient)
    return ok(_serialize(a, db))


@router.get("/{assessment_id}/pdf")
def download_assessment_pdf(
    assessment_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Downloads an exact PDF copy of the historical health assessment evaluation,
    formatted as the 5-tier evaluation view with the patient's bio-data header.
    """
    a = db.query(RiskAssessment).filter(RiskAssessment.id == assessment_id).first()
    if not a:
        raise app_error("NOT_FOUND", "Assessment not found.")
    patient = get_patient_or_404(db, a.patient_id)
    assert_can_view_patient(user, patient)

    serialized = _serialize(a, db)

    # Fetch AI insight if available
    insight = None
    try:
        from app.ai.service import ai_service
        from app.ai.schemas import PatientInsightRequest
        factors = serialized.get("top_factors") or []
        concepts = [s.get("name", "") for s in (serialized.get("active_symptoms") or [])]
        req = PatientInsightRequest(
            risk_score=float(a.risk_score),
            confidence_score=float(getattr(a, "confidence_score", 90.0)),
            care_level=a.care_level or "URGENT",
            top_factors=[f.get("factor_name", "") for f in factors],
            concepts=concepts,
            language="en"
        )
        insight_res = ai_service.generate_patient_insights(req)
        insight = insight_res.model_dump()
        insight["suggested_specialty"] = insight_res.specialist.specialty
    except Exception:
        pass

    from app.assessments.pdf_report import generate_assessment_evaluation_pdf
    pdf_bytes = generate_assessment_evaluation_pdf(patient, a, serialized, insight)

    date_str = a.created_at.strftime('%Y%m%d') if a.created_at else 'record'
    filename = f"FAME_GENIX_Health_Assessment_{patient.full_name.replace(' ', '_')}_{date_str}_{a.id[:6]}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/{assessment_id}/explanation")
def get_explanation(assessment_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    a = db.query(RiskAssessment).filter(RiskAssessment.id == assessment_id).first()
    if not a:
        raise app_error("NOT_FOUND", "Assessment not found.")
    patient = get_patient_or_404(db, a.patient_id)
    assert_can_view_patient(user, patient)
    factors = db.query(RiskFactor).filter(RiskFactor.assessment_id == assessment_id).all()
    return ok({
        "assessment_id": a.id,
        "risk_score": a.risk_score, "confidence_score": a.confidence_score, "care_level": a.care_level,
        "factors": [{"factor_name": f.factor_name, "contribution": f.contribution, "direction": f.direction}
                    for f in factors],
    })


@router.get("/patient/{patient_id}")
def get_history(patient_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    patient = get_patient_or_404(db, patient_id)
    assert_can_view_patient(user, patient)
    rows = (
        db.query(RiskAssessment)
        .filter(RiskAssessment.patient_id == patient_id)
        .order_by(RiskAssessment.created_at.desc())
        .all()
    )
    return ok([_serialize(r, db) for r in rows])


@router.delete("/{assessment_id}")
def delete_assessment(assessment_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    a = db.query(RiskAssessment).filter(RiskAssessment.id == assessment_id).first()
    if not a:
        raise app_error("NOT_FOUND", "Assessment not found.")
    patient = get_patient_or_404(db, a.patient_id)
    assert_can_view_patient(user, patient)

    # Clean up dependent risk factors
    db.query(RiskFactor).filter(RiskFactor.assessment_id == assessment_id).delete(synchronize_session=False)

    # Detach FK references in other tables safely
    from app.db.models import DoctorReview, EmergencyCase, DoctorConsultationRequest
    db.query(DoctorReview).filter(DoctorReview.assessment_id == assessment_id).update({"assessment_id": None}, synchronize_session=False)
    db.query(EmergencyCase).filter(EmergencyCase.trigger_assessment_id == assessment_id).update({"trigger_assessment_id": None}, synchronize_session=False)
    db.query(DoctorConsultationRequest).filter(DoctorConsultationRequest.assessment_id == assessment_id).update({"assessment_id": None}, synchronize_session=False)

    db.delete(a)
    db.commit()
    return ok({"deleted": True, "id": assessment_id})


@router.post("/batch-delete")
def batch_delete_assessments(payload: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ids = payload.get("ids", [])
    if not ids or not isinstance(ids, list):
        raise app_error("VALIDATION_ERROR", "No assessment IDs provided.")

    assessments = db.query(RiskAssessment).filter(RiskAssessment.id.in_(ids)).all()
    if not assessments:
        return ok({"deleted_count": 0, "deleted_ids": []})

    deleted_ids = []
    from app.db.models import DoctorReview, EmergencyCase, DoctorConsultationRequest

    for a in assessments:
        try:
            patient = get_patient_or_404(db, a.patient_id)
            assert_can_view_patient(user, patient)
        except Exception:
            continue

        db.query(RiskFactor).filter(RiskFactor.assessment_id == a.id).delete(synchronize_session=False)
        db.query(DoctorReview).filter(DoctorReview.assessment_id == a.id).update({"assessment_id": None}, synchronize_session=False)
        db.query(EmergencyCase).filter(EmergencyCase.trigger_assessment_id == a.id).update({"trigger_assessment_id": None}, synchronize_session=False)
        db.query(DoctorConsultationRequest).filter(DoctorConsultationRequest.assessment_id == a.id).update({"assessment_id": None}, synchronize_session=False)

        db.delete(a)
        deleted_ids.append(a.id)

    db.commit()
    return ok({"deleted_count": len(deleted_ids), "deleted_ids": deleted_ids})


@router.get("/model/metrics")
@router.get("/metrics")
def get_model_metrics(user: User = Depends(get_current_user)):
    from app.risk.ml_model import get_metrics
    return ok(get_metrics())



@router.get("/safety/rules")
def get_safety_rules(user: User = Depends(get_current_user)):
    from app.risk.safety.rules import RULES, RULESET_VERSION
    return ok({"ruleset_version": RULESET_VERSION, "rules": RULES})
