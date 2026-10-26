import json

from fastapi import APIRouter, Depends
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

    return {
        "id": a.id, "patient_id": a.patient_id, "session_id": a.session_id,
        "risk_score": a.risk_score, "confidence_score": a.confidence_score,
        "care_level": a.care_level, "suggested_action": a.suggested_action,
        "top_factors": top_factors,
        "active_symptoms": active_symptoms,
        "negated_symptoms": [],
        "red_flags": red_flags,
        "missing_evidence": json.loads(a.missing_evidence or "[]"), "created_at": a.created_at,
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


@router.get("/model/metrics")
@router.get("/metrics")
def get_model_metrics(user: User = Depends(get_current_user)):
    from app.risk.ml_model import get_metrics
    return ok(get_metrics())


@router.get("/safety/rules")
def get_safety_rules():
    from app.risk.safety.rules import RULES, RULESET_VERSION
    return ok({"ruleset_version": RULESET_VERSION, "rules": RULES})

