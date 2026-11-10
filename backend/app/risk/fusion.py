"""
Risk Fusion Engine.

Deliberately keeps risk_score, confidence_score, and care_level as three
separate outputs (never merged into one number) per architecture decision.
Safety rules can force care_level up regardless of the numeric risk_score.
"""
from app.db.models import CareLevel
from app.risk.safety.rules import evaluate_safety_rules

SAFETY_SEVERITY_TO_CARE_LEVEL = {
    "URGENT": CareLevel.URGENT,
    "POSSIBLE_EMERGENCY": CareLevel.POSSIBLE_EMERGENCY,
    "ROUTINE_REVIEW": CareLevel.ROUTINE_REVIEW,
}


def fuse_risk(
    ml_risk: float,
    anomaly_score: float,
    drift_score: float,
    safety_context: dict,
    modalities_present: int,
    total_expected_modalities: int = 4,
    data_quality_avg: float = 0.6,
    is_symptom_session: bool = False,
) -> dict:
    triggered_rules = evaluate_safety_rules(safety_context)

    # --- risk_score: weighted blend or input-driven ---
    if is_symptom_session:
        # Driven by calibrated symptom ML risk, modulated by specific rule severity
        risk_score = min(100.0, ml_risk)

        # Distinguish acute emergencies from non-acute medical conditions
        emergency_rules = [r for r in triggered_rules if r.get("severity") == "POSSIBLE_EMERGENCY"]
        urgent_rules = [r for r in triggered_rules if r.get("severity") == "URGENT"]
        routine_rules = [r for r in triggered_rules if r.get("severity") == "ROUTINE_REVIEW"]

        if emergency_rules:
            risk_score = max(risk_score, 85.0)
        elif urgent_rules:
            risk_score = max(risk_score, 70.0)
        elif routine_rules:
            # Recognized medical condition without acute red flags (e.g. chronic tumor, diabetes)
            risk_score = max(risk_score, 45.0)
    else:
        risk_score = min(100.0, (0.4 * ml_risk) + (0.3 * anomaly_score) + (0.3 * drift_score))
        if any(r.get("severity") == "POSSIBLE_EMERGENCY" for r in triggered_rules):
            risk_score = max(risk_score, 85.0)
        elif any(r.get("severity") == "URGENT" for r in triggered_rules):
            risk_score = max(risk_score, 70.0)
        elif triggered_rules:
            risk_score = max(risk_score, 45.0)

    # --- confidence_score: modality coverage + data quality, penalized by conflict ---
    modality_coverage = min(1.0, modalities_present / total_expected_modalities)
    conflict_penalty = 0.15 if (ml_risk < 30 and (anomaly_score > 60 or drift_score > 60)) else 0.0
    confidence_score = max(5.0, min(100.0, (modality_coverage * 60 + data_quality_avg * 40) * 100 / 100
                                     - conflict_penalty * 100))

    # --- care_level ---
    care_level = _base_care_level(risk_score)
    for rule in triggered_rules:
        forced = SAFETY_SEVERITY_TO_CARE_LEVEL.get(rule["severity"])
        if forced and CareLevel.ORDER.index(forced) > CareLevel.ORDER.index(care_level):
            care_level = forced

    # deterioration escalation: high drift bumps care_level only when the patient has elevated baseline risk or acute rules
    if drift_score >= 50 and risk_score >= 25.0 and CareLevel.ORDER.index(care_level) < CareLevel.ORDER.index(CareLevel.PRIORITY_REVIEW):
        care_level = CareLevel.PRIORITY_REVIEW

    missing_evidence = []
    if modalities_present < total_expected_modalities:
        missing_evidence.append(f"Only {modalities_present}/{total_expected_modalities} data modalities available.")
    if data_quality_avg < 0.5:
        missing_evidence.append("Available readings are of low/simulated quality.")

    top_factors = [
        {"factor_name": "symptom_model_risk", "contribution": round(ml_risk, 2), "direction": "increases_risk"},
        {"factor_name": "anomaly_deviation", "contribution": round(anomaly_score, 2), "direction": "increases_risk"},
        {"factor_name": "health_drift", "contribution": round(drift_score, 2), "direction": "increases_risk"},
    ]
    for rule in triggered_rules:
        top_factors.append({"factor_name": f"safety_rule:{rule['rule_id']}", "contribution": 100.0,
                             "direction": "increases_risk"})

    suggested_action = _suggest_action(care_level)

    return {
        "risk_score": round(risk_score, 2),
        "confidence_score": round(confidence_score, 2),
        "care_level": care_level,
        "top_factors": top_factors,
        "missing_evidence": missing_evidence,
        "suggested_action": suggested_action,
        "triggered_safety_rules": triggered_rules,
    }


def _base_care_level(risk_score: float) -> str:
    if risk_score < 15:
        return CareLevel.STABLE
    if risk_score < 30:
        return CareLevel.MONITOR
    if risk_score < 50:
        return CareLevel.ROUTINE_REVIEW
    if risk_score < 70:
        return CareLevel.PRIORITY_REVIEW
    if risk_score < 85:
        return CareLevel.URGENT
    return CareLevel.POSSIBLE_EMERGENCY


def _suggest_action(care_level: str) -> str:
    return {
        CareLevel.STABLE: "Continue routine self-monitoring.",
        CareLevel.MONITOR: "Monitor for changes; log symptoms if they persist.",
        CareLevel.ROUTINE_REVIEW: "Non-urgent professional review recommended.",
        CareLevel.PRIORITY_REVIEW: "Elevated doctor queue priority assigned.",
        CareLevel.URGENT: "Immediate professional review workflow initiated.",
        CareLevel.POSSIBLE_EMERGENCY: "Emergency workflow triggered; awaiting verification.",
    }[care_level]
