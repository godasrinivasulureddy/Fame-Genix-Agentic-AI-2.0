import json

from sqlalchemy.orm import Session

from app.core.events import RISK_ASSESSMENT_CREATED, DRIFT_DETECTED, event_bus
from app.db.models import (DeviceReading, DriftEvent, HealthScore,
                            RiskAssessment, RiskFactor, SymptomEntry,
                            SymptomSession, FollowupAnswer, FollowupQuestion)
from app.risk.anomaly import compute_anomaly_score
from app.risk.baseline import update_baseline
from app.risk.drift import compute_drift
from app.risk.fusion import fuse_risk
from app.risk.ml_model import predict_risk
from app.symptoms.vocabulary import extract_concepts, is_negated
from app.symptoms.medical_nlp import (
    extract_medical_concepts,
    build_safety_flags,
    ContextType,
)

TRACKED_METRICS = ["heart_rate", "spo2", "respiratory_rate", "temperature", "voc_index"]
SEVERITY_MAP = {"mild": 0, "moderate": 1, "severe": 2}


def _latest_value(db: Session, patient_id: str, metric: str) -> float | None:
    r = (
        db.query(DeviceReading)
        .filter(DeviceReading.patient_id == patient_id, DeviceReading.metric == metric)
        .order_by(DeviceReading.recorded_at.desc())
        .first()
    )
    return r.value if r else None


def _spo2_drop_rate(db: Session, patient_id: str) -> float:
    readings = (
        db.query(DeviceReading)
        .filter(DeviceReading.patient_id == patient_id, DeviceReading.metric == "spo2")
        .order_by(DeviceReading.recorded_at.desc())
        .limit(2)
        .all()
    )
    if len(readings) < 2:
        return 0.0
    latest, previous = readings[0].value, readings[1].value
    return max(0.0, previous - latest)


def run_assessment(db: Session, patient_id: str, session_id: str | None = None) -> RiskAssessment:
    # --- symptom features (default to 0 if no session provided) ---
    symptom_count, max_severity, duration_hours, red_flag_count = 0, 0, 0.0, 0

    session = None
    if session_id:
        session = db.query(SymptomSession).filter(SymptomSession.id == session_id).first()
    if not session:
        session = (
            db.query(SymptomSession)
            .filter(SymptomSession.patient_id == patient_id)
            .order_by(SymptomSession.created_at.desc())
            .first()
        )

    # Initialise safety flags (will be populated by NLP layer when session exists)
    safety_flags: dict = {
        "breathing_difficulty_reported": False,
        "chest_pain_severe": False,
        "dizziness_or_unconscious": False,
        "severe_bleeding_reported": False,
        "serious_disease_reported": False,
        "neuro_trauma_reported": False,
        "anaphylaxis_reported": False,
        "vomiting_blood_reported": False,
    }

    nlp_result = None
    concepts: list[str] = []

    if session:
        entries = db.query(SymptomEntry).filter(SymptomEntry.session_id == session.id).all()
        concepts = [e.concept for e in entries]
        symptom_count = max(1, len(concepts))

        raw_text = session.raw_text or ""

        # ── MEDICAL NLP LAYER ──────────────────────────────────────────────
        # Runs against the patient's free-text. Detects negation, family
        # history, historical conditions and active red-flag concepts.
        # It NEVER sets risk_score or care_level.
        nlp_result = extract_medical_concepts(raw_text)
        safety_flags = build_safety_flags(nlp_result)

        # ── Severity from NLP ──────────────────────────────────────────────
        # Active red-flag concepts automatically drive max_severity up.
        if nlp_result.active_red_flags:
            max_severity = max(max_severity, 2)
        # Self-reported conditions (without red flags) drive moderate severity.
        if nlp_result.self_reported_conditions and max_severity < 1:
            max_severity = 1

        # ── Severity from persisted SymptomEntry records ───────────────────
        for e in entries:
            max_severity = max(max_severity, SEVERITY_MAP.get(e.severity or "mild", 0))
            duration_hours = max(duration_hours, e.duration_hours or 0.0)

        # ── Follow-up answer enrichment ────────────────────────────────────
        answers = (
            db.query(FollowupAnswer)
            .join(FollowupQuestion)
            .filter(FollowupQuestion.session_id == session.id)
            .all()
        )
        ans_text = " ".join([a.answer.lower() for a in answers if a.answer])
        if any(kw in ans_text for kw in ["yes", "severe", "arm", "jaw", "radiating", "sweating", "pain"]):
            max_severity = 2
            if safety_flags.get("chest_pain_severe"):
                pass  # already flagged

        # ── Red-flag count ─────────────────────────────────────────────────
        red_flag_count = sum([
            safety_flags["breathing_difficulty_reported"],
            safety_flags["chest_pain_severe"],
            safety_flags["dizziness_or_unconscious"],
            safety_flags["severe_bleeding_reported"],
            safety_flags["neuro_trauma_reported"],
            safety_flags["anaphylaxis_reported"],
            safety_flags["vomiting_blood_reported"],
        ])
        if safety_flags["chest_pain_severe"] or safety_flags["breathing_difficulty_reported"]:
            red_flag_count = max(1, red_flag_count)

    ml_risk = predict_risk(symptom_count, max_severity, duration_hours, red_flag_count)

    # --- device-derived signals ---
    modalities_present = 1 if session else 0
    metrics_with_data = [m for m in TRACKED_METRICS if _latest_value(db, patient_id, m) is not None]
    if metrics_with_data:
        modalities_present += 1

    anomaly = compute_anomaly_score(db, patient_id, metrics_with_data)
    drift = compute_drift(db, patient_id, metrics_with_data)

    if drift["severity"] != "none":
        drift_event = DriftEvent(
            patient_id=patient_id, drift_score=drift["drift_score"], direction=drift["direction"],
            severity=drift["severity"], contributing_metrics=json.dumps(drift["contributing_metrics"]),
        )
        db.add(drift_event)
        db.commit()
        event_bus.publish(DRIFT_DETECTED, {"patient_id": patient_id, "drift": drift})

    # ── Safety context for deterministic rule engine ───────────────────────
    safety_context = {
        "spo2": _latest_value(db, patient_id, "spo2"),
        "spo2_drop_rate": _spo2_drop_rate(db, patient_id),
        "heart_rate": _latest_value(db, patient_id, "heart_rate"),
        **safety_flags,
    }

    fused = fuse_risk(
        ml_risk=ml_risk,
        anomaly_score=anomaly["anomaly_score"],
        drift_score=drift["drift_score"],
        safety_context=safety_context,
        modalities_present=modalities_present,
        is_symptom_session=bool(session),
    )

    if session:
        is_lab_ocr = "Medical Report Analysis" in (session.raw_text or "") or "Abnormal" in (session.raw_text or "")
        active_concepts = concepts if concepts else extract_concepts(session.raw_text or "")
        for c in active_concepts:
            factor_label = f"lab_ocr_finding:{c}" if is_lab_ocr else f"clinical_concept:{c}"
            if not any(f["factor_name"] == factor_label for f in fused["top_factors"]):
                fused["top_factors"].append({
                    "factor_name": factor_label,
                    "contribution": round(min(85.0, max(25.0, fused["risk_score"])), 2),
                    "direction": "increases_risk"
                })

        if 'answers' in locals() and answers:
            for ans_item in answers:
                if ans_item.answer and ans_item.answer.strip():
                    q_text = ans_item.question.question if hasattr(ans_item, 'question') and ans_item.question else "Follow-up Question"
                    ans_label = f"followup_answer:{q_text[:35]} -> {ans_item.answer.strip()}"
                    if not any(f["factor_name"] == ans_label for f in fused["top_factors"]):
                        fused["top_factors"].append({
                            "factor_name": ans_label,
                            "contribution": round(min(90.0, max(30.0, fused["risk_score"] + 10.0)), 2),
                            "direction": "increases_risk"
                        })

    assessment = RiskAssessment(
        patient_id=patient_id,
        session_id=session.id if session else None,
        risk_score=fused["risk_score"],
        confidence_score=fused["confidence_score"],
        care_level=fused["care_level"],
        suggested_action=fused["suggested_action"],
        missing_evidence=json.dumps(fused["missing_evidence"]),
    )
    db.add(assessment)
    db.flush()

    for factor in fused["top_factors"]:
        db.add(RiskFactor(assessment_id=assessment.id, factor_name=factor["factor_name"],
                           contribution=factor["contribution"], direction=factor["direction"]))

    health_score_value = max(0.0, 100.0 - fused["risk_score"])
    db.add(HealthScore(patient_id=patient_id, score=round(health_score_value, 2)))

    db.commit()
    db.refresh(assessment)
    assessment._triggered_safety_rules = fused["triggered_safety_rules"]

    event_bus.publish(RISK_ASSESSMENT_CREATED, {
        "patient_id": patient_id, "assessment_id": assessment.id,
        "risk_score": assessment.risk_score, "confidence_score": assessment.confidence_score,
        "care_level": assessment.care_level, "triggered_safety_rules": fused["triggered_safety_rules"],
        "safety_context": safety_context,
    })

    return assessment
