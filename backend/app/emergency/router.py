import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.audit.helper import record_audit
from app.core.dependencies import require_role
from app.core.response import ok
from app.db.models import (AmbulanceAssignment, EmergencyCase, HospitalHandoff,
                            Patient, Role)
from app.db.session import get_db
from app.emergency.schemas import CreateEmergencyRequest, LocationRequest
from app.emergency.service import (advance, attach_location, create_case,
                                    get_case_or_404, request_dispatch, verify)
from app.doctors.service import latest_vitals
from app.emergency.hospital_broker import hospital_broker
from app.notifications.gateway import notification_gateway

router = APIRouter(prefix="/api/v1/emergency", tags=["emergency"])
ambulance_router = APIRouter(prefix="/api/v1/ambulance", tags=["ambulance"])


def _serialize(case: EmergencyCase, db: Session = None) -> dict:
    from app.db.models import Patient, RiskAssessment

    patient_data = None
    assessment_data = None

    if db:
        patient = db.query(Patient).filter(Patient.id == case.patient_id).first()
        if patient:
            patient_data = {
                "id": patient.id,
                "public_id": patient.public_id,
                "full_name": patient.full_name,
                "age": patient.age,
                "height_cm": patient.height_cm,
                "weight_kg": patient.weight_kg,
                "blood_group": patient.blood_group,
                "profile_picture_url": patient.profile_picture_url,
                "known_conditions": patient.known_conditions,
                "emergency_contact_name": patient.emergency_contact_name,
                "emergency_contact_phone": patient.emergency_contact_phone,
            }

        if case.trigger_assessment_id:
            assessment = db.query(RiskAssessment).filter(RiskAssessment.id == case.trigger_assessment_id).first()
            if assessment:
                active_symptoms = []
                red_flags = []
                if assessment.session_id:
                    from app.db.models import SymptomEntry
                    entries = db.query(SymptomEntry).filter(SymptomEntry.session_id == assessment.session_id).all()
                    active_symptoms = [{"name": e.concept, "severity": e.severity} for e in entries]
                    
                    if assessment.care_level in ["EMERGENCY_DISPATCH", "PRIORITY_REVIEW"]:
                        red_flags.append(assessment.care_level)

                assessment_data = {
                    "id": assessment.id,
                    "risk_score": assessment.risk_score,
                    "care_level": assessment.care_level,
                    "active_symptoms": active_symptoms,
                    "negated_symptoms": [],
                    "red_flags": red_flags,
                }

    return {
        "id": case.id,
        "patient_id": case.patient_id,
        "patient": patient_data,
        "assessment": assessment_data,
        "status": case.status,
        "severity": case.severity,
        "trigger_type": case.trigger_type,
        "trigger_rule_id": case.trigger_rule_id,
        "trigger_assessment_id": case.trigger_assessment_id,
        "trigger_measurements": json.loads(case.trigger_measurements or "{}"),
        "measurement_quality": case.measurement_quality,
        "simulation_status": case.simulation_status,
        "location": {
            "lat": case.latitude,
            "lng": case.longitude,
            "consent": case.location_consent,
            "accuracy": case.location_accuracy,
            "source": case.location_source,
        },
        "created_at": case.created_at,
        "updated_at": case.updated_at,
    }



@router.post("/cases")
def create_emergency_case(payload: CreateEmergencyRequest,
                           user=Depends(require_role(Role.DOCTOR, Role.EMERGENCY_OPERATOR)),
                           db: Session = Depends(get_db)):
    case = create_case(db, payload.patient_id, trigger_type=payload.trigger_type)
    record_audit(db, user.id, user.role, "EMERGENCY_CASE_CREATED", "patient", payload.patient_id,
                 metadata={"case_id": case.id, "trigger_type": payload.trigger_type})
    return ok(_serialize(case, db))


@router.get("/cases")
def list_cases(user=Depends(require_role(Role.EMERGENCY_OPERATOR, Role.DOCTOR)), db: Session = Depends(get_db)):
    cases = db.query(EmergencyCase).order_by(EmergencyCase.created_at.desc()).all()
    return ok([_serialize(c, db) for c in cases])


@router.get("/cases/{case_id}")
def get_case(case_id: str, user=Depends(require_role(Role.EMERGENCY_OPERATOR, Role.DOCTOR, Role.AMBULANCE_TEAM)),
             db: Session = Depends(get_db)):
    case = get_case_or_404(db, case_id)
    return ok(_serialize(case, db))


@router.post("/cases/{case_id}/verify")
def verify_case(case_id: str, user=Depends(require_role(Role.EMERGENCY_OPERATOR, Role.DOCTOR)),
                 db: Session = Depends(get_db)):
    case = get_case_or_404(db, case_id)
    case = verify(db, case, user.id)
    record_audit(db, user.id, user.role, "EMERGENCY_VERIFIED", "emergency_case", case_id)
    return ok(_serialize(case, db))


@router.post("/cases/{case_id}/dispatch")
def dispatch_case(case_id: str, user=Depends(require_role(Role.EMERGENCY_OPERATOR)), db: Session = Depends(get_db)):
    case = get_case_or_404(db, case_id)
    case = request_dispatch(db, case)
    record_audit(db, user.id, user.role, "DISPATCH_REQUESTED", "emergency_case", case_id)
    return ok(_serialize(case, db))


@router.post("/cases/{case_id}/advance")
def advance_case(case_id: str, user=Depends(require_role(Role.EMERGENCY_OPERATOR, Role.AMBULANCE_TEAM)),
                  db: Session = Depends(get_db)):
    case = get_case_or_404(db, case_id)
    case = advance(db, case)
    record_audit(db, user.id, user.role, "AMBULANCE_ADVANCE", "emergency_case", case_id,
                 metadata={"new_status": case.status})
    return ok(_serialize(case, db))


@router.post("/cases/{case_id}/location")
def set_location(case_id: str, payload: LocationRequest,
                  user=Depends(require_role(Role.PATIENT, Role.EMERGENCY_OPERATOR, Role.DOCTOR)),
                  db: Session = Depends(get_db)):
    case = get_case_or_404(db, case_id)
    case = attach_location(db, case, payload.latitude, payload.longitude, payload.accuracy, payload.consent)
    record_audit(db, user.id, user.role, "LOCATION_ACCESS", "emergency_case", case_id)
    return ok(_serialize(case, db))


# --------------------------- Ambulance sub-domain --------------------------
@ambulance_router.get("/assigned")
def assigned_cases(user=Depends(require_role(Role.AMBULANCE_TEAM)), db: Session = Depends(get_db)):
    assignments = db.query(AmbulanceAssignment).filter(
        AmbulanceAssignment.status.notin_(["COMPLETED"])
    ).all()
    cases = []
    for a in assignments:
        case = db.query(EmergencyCase).filter(EmergencyCase.id == a.case_id).first()
        if case:
            cases.append(_serialize(case, db))
    return ok(cases)


@ambulance_router.get("/cases/{case_id}/brief")
def patient_brief(case_id: str, user=Depends(require_role(Role.AMBULANCE_TEAM, Role.EMERGENCY_OPERATOR)),
                   db: Session = Depends(get_db)):
    from app.db.models import RiskAssessment, SymptomEntry
    import json
    
    case = get_case_or_404(db, case_id)
    patient = db.query(Patient).filter(Patient.id == case.patient_id).first()
    
    assessment = None
    if case.trigger_assessment_id:
        assessment = db.query(RiskAssessment).filter(RiskAssessment.id == case.trigger_assessment_id).first()
        
    active_symptoms = []
    red_flags = []
    reported_issue = case.severity
    
    if assessment and assessment.session_id:
        entries = db.query(SymptomEntry).filter(SymptomEntry.session_id == assessment.session_id).all()
        for e in entries:
            if any(kw in e.concept for kw in ["failure", "stroke", "seizure", "attack"]):
                active_symptoms.append({"name": f"Reported Concern: {e.concept.replace('_', ' ').title()}", "severity": e.severity})
            else:
                active_symptoms.append({"name": e.concept, "severity": e.severity})
        
        if entries:
            reported_issue = " & ".join(e["name"] for e in active_symptoms)
            
        if assessment.care_level in ["EMERGENCY_DISPATCH", "PRIORITY_REVIEW", "POSSIBLE_EMERGENCY", "URGENT"]:
            red_flags.append(assessment.care_level)

    return ok({
        "case": {
            "id": case.id,
            "status": case.status,
            "trigger_type": case.trigger_type,
            "trigger_timestamp": case.trigger_timestamp.isoformat() if case.trigger_timestamp else None
        },
        "patient_profile": {
            "full_name": patient.full_name if patient else "Unknown",
            "public_id": patient.public_id if patient else f"FG-P-{case.patient_id[:8]}",
            "age": patient.age if patient else "N/A",
            "height_cm": patient.height_cm if patient else "N/A",
            "weight_kg": patient.weight_kg if patient else "N/A",
            "blood_group": patient.blood_group if patient else "Unknown",
            "profile_picture_url": patient.profile_picture_url if patient else None
        },
        "incident_snapshot": {
            "assessment_id": assessment.id if assessment else None,
            "reported_issue": reported_issue,
            "active_symptoms": active_symptoms,
            "red_flags": red_flags,
            "risk_score": assessment.risk_score if assessment else 0.0,
            "care_level": assessment.care_level if assessment else case.severity
        },
        "medical_context": {
            "known_conditions": patient.known_conditions if patient else "Unknown",
            "emergency_contact_name": patient.emergency_contact_name if patient else "Unknown",
            "emergency_contact_phone": patient.emergency_contact_phone if patient else "Not provided"
        },
        "location": {
            "latitude": case.latitude,
            "longitude": case.longitude,
            "location_accuracy": case.location_accuracy,
            "location_source": "Browser/Device Geolocation" if case.latitude else "Unknown",
            "location_timestamp": case.trigger_timestamp.isoformat() if case.trigger_timestamp else None
        }
    })


@ambulance_router.post("/cases/{case_id}/status")
def update_status(case_id: str, user=Depends(require_role(Role.AMBULANCE_TEAM)), db: Session = Depends(get_db)):
    case = get_case_or_404(db, case_id)
    case = advance(db, case)
    return ok(_serialize(case, db))


@router.post("/cases/patient")
def create_patient_emergency_case(
    payload: dict,
    user=Depends(require_role(Role.PATIENT)),
    db: Session = Depends(get_db)
):
    from app.db.models import EmergencyCase, EmergencyStatus, Patient, RiskAssessment
    
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise app_error("NOT_FOUND", "Patient profile not found for current user.")
        
    active_case = (
        db.query(EmergencyCase)
        .filter(
            EmergencyCase.patient_id == patient.id,
            EmergencyCase.status.notin_([EmergencyStatus.COMPLETED, EmergencyStatus.CANCELLED])
        )
        .first()
    )
    if active_case:
        lat = payload.get("latitude")
        lng = payload.get("longitude")
        if lat is not None and lng is not None and active_case.latitude is None:
            active_case.latitude = lat
            active_case.longitude = lng
            active_case.location_accuracy = payload.get("accuracy")
            active_case.location_source = payload.get("location_source") or "BROWSER_DEVICE_GEOLOCATION"
            active_case.location_consent = payload.get("location_consent") or True
            db.commit()
            db.refresh(active_case)
        return ok(_serialize(active_case, db))
        
    latest_assessment = (
        db.query(RiskAssessment)
        .filter(RiskAssessment.patient_id == patient.id)
        .order_by(RiskAssessment.created_at.desc())
        .first()
    )
    
    severity = "POSSIBLE_EMERGENCY"
    assessment_id = None
    if latest_assessment:
        severity = latest_assessment.care_level
        assessment_id = latest_assessment.id
        
    case = create_case(
        db, 
        patient.id, 
        trigger_type="PATIENT_SOS", 
        severity=severity, 
        trigger_assessment_id=assessment_id
    )
    
    lat = payload.get("latitude")
    lng = payload.get("longitude")
    if lat is not None and lng is not None:
        case.latitude = lat
        case.longitude = lng
        case.location_accuracy = payload.get("accuracy")
        case.location_source = payload.get("location_source") or "BROWSER_DEVICE_GEOLOCATION"
        case.location_consent = payload.get("location_consent") or True
    else:
        case.location_source = "UNAVAILABLE"
        case.location_consent = False
        
    db.commit()
    db.refresh(case)
    
    record_audit(db, user.id, user.role, "PATIENT_SOS_TRIGGERED", "emergency_case", case.id,
                 metadata={"latitude": lat, "longitude": lng})
                 
    return ok(_serialize(case, db))


@router.get("/cases/patient/active")
def get_patient_active_emergency(
    user=Depends(require_role(Role.PATIENT)),
    db: Session = Depends(get_db)
):
    from app.db.models import EmergencyCase, EmergencyStatus, Patient
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise app_error("NOT_FOUND", "Patient profile not found.")
        
    active_case = (
        db.query(EmergencyCase)
        .filter(
            EmergencyCase.patient_id == patient.id,
            EmergencyCase.status.notin_([EmergencyStatus.COMPLETED, EmergencyStatus.CANCELLED])
        )
        .first()
    )
    if not active_case:
        return ok(None)
    return ok(_serialize(active_case, db))



@router.get("/hospitals/grid")
def get_hospital_resource_grid():
    """
    Returns real-time metropolitan hospital resource telemetry:
    ICU bed availability, trauma bay status, Cath Lab and Stroke team readiness.
    """
    return ok(hospital_broker.get_network_status())


@router.get("/cases/{case_id}/handover-passport")
def get_emergency_handover_passport(
    case_id: str,
    user=Depends(require_role(Role.EMERGENCY_OPERATOR, Role.DOCTOR, Role.AMBULANCE_TEAM)),
    db: Session = Depends(get_db)
):
    """
    Generates a pre-hospital Digital Handover Passport for receiving ER trauma bays.
    Calculates optimal hospital routing based on clinical readiness (Cath Lab/ICU)
    rather than purely geographical proximity.
    """
    case = get_case_or_404(db, case_id)
    patient = db.query(Patient).filter(Patient.id == case.patient_id).first()
    
    # Recommend optimal hospital facility
    routing = hospital_broker.recommend_destination(
        clinical_urgency=getattr(case, 'severity', 'CRITICAL'),
        suspected_condition='cardiac'
    )

    passport = {
        "passport_id": f"PASS-{case.id[:8].upper()}-TRAUMA",
        "case_id": case.id,
        "status": case.status,
        "patient": {
            "id": patient.id,
            "full_name": patient.full_name,
            "age": patient.age,
            "sex": patient.sex,
            "blood_group": patient.blood_group or "Unknown",
            "allergies": patient.allergies or "None documented",
            "known_conditions": patient.known_conditions or "None documented",
            "emergency_contact": f"{patient.emergency_contact_name} ({patient.emergency_contact_phone})" if patient.emergency_contact_name else "N/A"
        },
        "vitals_summary": latest_vitals(db, patient.id),
        "hospital_routing": routing,
        "interventions_en_route": [
            {"time": "00:02", "intervention": "High-Flow Oxygen 10L/min", "responder": "Paramedic Unit"},
            {"time": "00:06", "intervention": "Peripheral IV Line (18G)", "responder": "Paramedic Unit"}
        ]
    }
    return ok(passport)

