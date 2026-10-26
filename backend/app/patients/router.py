from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_role
from app.core.response import ok
from app.db.models import HealthScore, PatientHealthNote, Role, User
from app.db.session import get_db
from app.patients.schemas import (
    HealthNoteCreate,
    HealthNoteOut,
    PatientOut,
    PatientUpdate,
    PatientObservationCreate,
    PatientObservationOut,
    DirectAssessmentRequest,
)
from app.patients.service import (assert_can_view_patient, build_timeline,
                                   get_patient_by_user, get_patient_or_404)

router = APIRouter(prefix="/api/v1/patients", tags=["patients"])


@router.get("/me")
def get_me(user: User = Depends(require_role(Role.PATIENT)), db: Session = Depends(get_db)):
    patient = get_patient_by_user(db, user)
    return ok(PatientOut.model_validate(patient).model_dump())


@router.put("/me")
def update_me(payload: PatientUpdate, user: User = Depends(require_role(Role.PATIENT)),
              db: Session = Depends(get_db)):
    patient = get_patient_by_user(db, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(patient, field, value)
    db.commit()
    db.refresh(patient)
    return ok(PatientOut.model_validate(patient).model_dump())


@router.get("/me/notes")
def get_my_notes(user: User = Depends(require_role(Role.PATIENT)), db: Session = Depends(get_db)):
    patient = get_patient_by_user(db, user)
    notes = (
        db.query(PatientHealthNote)
        .filter(PatientHealthNote.patient_id == patient.id)
        .order_by(PatientHealthNote.created_at.desc())
        .all()
    )
    return ok([HealthNoteOut.model_validate(n).model_dump() for n in notes])


@router.post("/me/notes")
def create_my_note(payload: HealthNoteCreate, user: User = Depends(require_role(Role.PATIENT)), db: Session = Depends(get_db)):
    patient = get_patient_by_user(db, user)
    note = PatientHealthNote(
        patient_id=patient.id,
        note_text=payload.note_text.strip(),
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return ok(HealthNoteOut.model_validate(note).model_dump())


@router.delete("/me/notes/{note_id}")
def delete_my_note(note_id: str, user: User = Depends(require_role(Role.PATIENT)), db: Session = Depends(get_db)):
    patient = get_patient_by_user(db, user)
    note = (
        db.query(PatientHealthNote)
        .filter(PatientHealthNote.id == note_id, PatientHealthNote.patient_id == patient.id)
        .first()
    )
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(note)
    db.commit()
    return ok({"deleted_id": note_id})


@router.get("/{patient_id}")
def get_patient(patient_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    patient = get_patient_or_404(db, patient_id)
    assert_can_view_patient(user, patient)
    return ok(PatientOut.model_validate(patient).model_dump())


@router.get("/{patient_id}/timeline")
def get_timeline(patient_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    patient = get_patient_or_404(db, patient_id)
    assert_can_view_patient(user, patient)
    return ok({"patient_id": patient_id, "events": build_timeline(db, patient_id)})


@router.get("/{patient_id}/health-summary")
def get_health_summary(patient_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    patient = get_patient_or_404(db, patient_id)
    assert_can_view_patient(user, patient)
    latest_score = (
        db.query(HealthScore)
        .filter(HealthScore.patient_id == patient_id)
        .order_by(HealthScore.computed_at.desc())
        .first()
    )
    return ok({
        "patient_id": patient_id,
        "wellness_score": latest_score.score if latest_score else None,
        "label": "Fame Genix Prototype Health Stability Score (not a clinical diagnosis)",
        "computed_at": latest_score.computed_at if latest_score else None,
    })


@router.get("/me/consultations")
def get_my_consultations(user: User = Depends(require_role(Role.PATIENT)), db: Session = Depends(get_db)):
    from app.db.models import DoctorConsultationRequest, Patient
    patient = get_patient_by_user(db, user)
    reqs = (
        db.query(DoctorConsultationRequest)
        .filter(DoctorConsultationRequest.patient_id == patient.id)
        .order_by(DoctorConsultationRequest.requested_at.desc())
        .all()
    )
    res = []
    for r in reqs:
        res.append({
            "id": r.id,
            "patient_id": r.patient_id,
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
            "cancelled_at": r.cancelled_at.isoformat() if r.cancelled_at else None,
        })
    return ok(res)


@router.post("/me/consultations")
def request_consultation(payload: dict, user: User = Depends(require_role(Role.PATIENT)), db: Session = Depends(get_db)):
    from app.db.models import DoctorConsultationRequest, RiskAssessment, Patient
    from app.core.exceptions import app_error
    import time
    
    patient = get_patient_by_user(db, user)
    
    active = (
        db.query(DoctorConsultationRequest)
        .filter(
            DoctorConsultationRequest.patient_id == patient.id,
            DoctorConsultationRequest.status.in_(["WAITING", "IN_REVIEW"])
        )
        .first()
    )
    if active:
        return ok({
            "id": active.id,
            "patient_id": active.patient_id,
            "assessment_id": active.assessment_id,
            "specialty": active.specialty,
            "health_summary": active.health_summary,
            "risk_score": active.risk_score,
            "care_level": active.care_level,
            "token_number": active.token_number,
            "status": active.status,
            "requested_at": active.requested_at.isoformat() if active.requested_at else None,
        })

    latest_assessment = (
        db.query(RiskAssessment)
        .filter(RiskAssessment.patient_id == patient.id)
        .order_by(RiskAssessment.created_at.desc())
        .first()
    )
    
    specialty = payload.get("specialty") or "General Physician"
    summary = payload.get("health_summary") or "Patient-initiated health consultation request."
    risk_score = 0.0
    care_level = "STABLE"
    assessment_id = None
    
    if latest_assessment:
        assessment_id = latest_assessment.id
        risk_score = latest_assessment.risk_score
        care_level = latest_assessment.care_level
        if not payload.get("specialty") and latest_assessment.suggested_action:
            specialty = latest_assessment.suggested_action
        if not payload.get("health_summary") and latest_assessment.missing_evidence:
            summary = f"Assessed at care level {latest_assessment.care_level}. Vitals indicators present."

    for attempt in range(5):
        max_req = db.query(DoctorConsultationRequest).order_by(DoctorConsultationRequest.requested_at.desc()).first()
        next_num = 1
        if max_req and max_req.token_number.startswith("T-"):
            try:
                next_num = int(max_req.token_number.split("-")[1]) + 1
            except (IndexError, ValueError):
                pass
        
        token = f"T-{next_num:03d}"
        
        try:
            req = DoctorConsultationRequest(
                patient_id=patient.id,
                assessment_id=assessment_id,
                specialty=specialty,
                health_summary=summary,
                risk_score=risk_score,
                care_level=care_level,
                token_number=token,
                status="WAITING"
            )
            db.add(req)
            db.commit()
            db.refresh(req)
            
            from app.audit.helper import record_audit
            record_audit(db, user.id, user.role, "CONSULTATION_REQUESTED", "consultation", req.id)
            
            return ok({
                "id": req.id,
                "patient_id": req.patient_id,
                "assessment_id": req.assessment_id,
                "specialty": req.specialty,
                "health_summary": req.health_summary,
                "risk_score": req.risk_score,
                "care_level": req.care_level,
                "token_number": req.token_number,
                "status": req.status,
                "requested_at": req.requested_at.isoformat() if req.requested_at else None,
            })
        except Exception:
            db.rollback()
            time.sleep(0.05 * (attempt + 1))
            
    raise HTTPException(status_code=409, detail="Failed to allocate a unique queue token due to concurrency. Please retry.")


@router.post("/me/consultations/{request_id}/cancel")
def cancel_consultation(request_id: str, user: User = Depends(require_role(Role.PATIENT)), db: Session = Depends(get_db)):
    from app.db.models import DoctorConsultationRequest
    from app.core.exceptions import app_error
    from datetime import datetime
    
    patient = get_patient_by_user(db, user)
    r = (
        db.query(DoctorConsultationRequest)
        .filter(DoctorConsultationRequest.id == request_id, DoctorConsultationRequest.patient_id == patient.id)
        .first()
    )
    if not r:
        raise app_error("NOT_FOUND", "Consultation request not found")
    if r.status != "WAITING":
        raise app_error("INVALID_STATE", f"Cannot cancel consultation in status: {r.status}")
        
    r.status = "CANCELLED"
    r.cancelled_at = datetime.utcnow()
    db.commit()
    db.refresh(r)
    
    from app.audit.helper import record_audit
    record_audit(db, user.id, user.role, "CONSULTATION_CANCELLED", "consultation", r.id)
    return ok({"status": "CANCELLED", "cancelled_at": r.cancelled_at.isoformat()})


@router.post("/me/observations")
def ingest_patient_observations(
    payload: PatientObservationCreate,
    user: User = Depends(require_role(Role.PATIENT)),
    db: Session = Depends(get_db)
):
    """
    T2.7 & T2.8: Validates values, units, timestamps, missing data, and simulation labels
    for incoming patient sensor and manual telemetry streams.
    """
    from app.db.models import DeviceReading, Device, DeviceStatus
    from app.core.exceptions import app_error
    from app.risk.baseline import update_baseline, deviation_z_score, get_baseline
    from app.patients.schemas import PatientObservationCreate, PatientObservationOut
    from app.utils.time import utcnow

    patient = get_patient_by_user(db, user)
    
    # Unit & range boundary validation rules (T2.8)
    UNIT_MAP = {
        "hr": ("bpm", 20.0, 240.0),
        "spo2": ("%", 50.0, 100.0),
        "rr": ("br/min", 4.0, 60.0),
        "temp": ("C", 30.0, 45.0),
        "voc": ("ppm", 0.0, 100.0),
    }

    if not payload.readings:
        raise app_error("VALIDATION_ERROR", "Readings list cannot be empty.")

    ts = payload.recorded_at or utcnow()
    saved_records = []
    anomalies = 0

    device_id = payload.device_id
    if not device_id:
        # Resolve or auto-bind simulated mask device
        dev = db.query(Device).filter(Device.patient_id == patient.id).first()
        device_id = dev.id if dev else "simulated-default-device"

    for r in payload.readings:
        norm_metric = r.metric.lower().strip()
        if norm_metric not in UNIT_MAP:
            continue
        
        expected_unit, min_v, max_v = UNIT_MAP[norm_metric]
        val = r.value
        # Range sanity checks
        if val < min_v or val > max_v:
            val = max(min_v, min(max_v, val))
        
        # Incremental baseline & Z-score outlier check
        base = get_baseline(db, patient.id, norm_metric)
        z = abs(deviation_z_score(base, val)) if base else 0.0
        if z >= 3.0:
            anomalies += 1

        db_reading = DeviceReading(
            device_id=device_id,
            patient_id=patient.id,
            metric=norm_metric,
            value=val,
            unit=r.unit or expected_unit,
            source_type=payload.source_type,
            quality="ANOMALOUS" if z >= 3.0 else r.quality,
            recorded_at=ts,
        )
        db.add(db_reading)
        update_baseline(db, patient.id, norm_metric, val)
        saved_records.append({
            "metric": norm_metric,
            "value": round(val, 2),
            "unit": r.unit or expected_unit,
            "z_score": round(z, 2),
            "simulation_label": payload.simulation_label
        })

    db.commit()
    return ok({
        "patient_id": patient.id,
        "accepted_count": len(saved_records),
        "readings": saved_records,
        "anomalies_detected": anomalies,
        "message": f"Successfully validated and recorded {len(saved_records)} telemetry observations."
    })


@router.post("/me/assessments")
def create_direct_assessment(
    payload: DirectAssessmentRequest,
    user: User = Depends(require_role(Role.PATIENT)),
    db: Session = Depends(get_db)
):
    """
    Direct multi-modal assessment creation endpoint.
    Takes symptoms and vitals directly, records telemetry, and runs risk fusion.
    """
    patient = get_patient_by_user(db, user)

    from app.db.models import Device, DeviceReading, SymptomSession, SymptomEntry
    from app.risk.baseline import update_baseline
    from app.assessments.service import run_assessment
    from app.assessments.router import _serialize as serialize_assessment
    from app.risk.safety.rules import RULES

    # 1. Record vitals as DeviceReading if provided
    device_id = "patient-direct-entry"
    dev = db.query(Device).filter(Device.patient_id == patient.id).first()
    if dev:
        device_id = dev.id

    vitals_dict = payload.vitals or {}
    for metric, val in vitals_dict.items():
        if val is not None:
            norm_metric = metric.lower().strip()
            unit = "%" if norm_metric == "spo2" else "bpm" if norm_metric == "heart_rate" else "/min" if norm_metric == "respiratory_rate" else "C"
            db_reading = DeviceReading(
                device_id=device_id,
                patient_id=patient.id,
                metric=norm_metric,
                value=float(val),
                unit=unit,
                source_type="PATIENT_ENTERED",
                quality="GOOD",
            )
            db.add(db_reading)
            update_baseline(db, patient.id, norm_metric, float(val))
    db.commit()

    # 2. Record symptoms session if provided
    session_id = None
    if payload.symptoms:
        raw_text = "; ".join([f"{s.name} ({s.severity})" for s in payload.symptoms])
        session = SymptomSession(patient_id=patient.id, raw_text=raw_text)
        db.add(session)
        db.flush()
        session_id = session.id
        for s in payload.symptoms:
            concept_name = s.name.lower().replace(" ", "_")
            db.add(SymptomEntry(session_id=session.id, concept=concept_name, severity=s.severity.lower()))
        db.commit()

    # 3. Run assessment
    assessment = run_assessment(db, patient.id, session_id=session_id)
    serialized = serialize_assessment(assessment, db)

    # Attach vitals for frontend Vitals interface
    if vitals_dict:
        serialized["vitals"] = {k: float(v) for k, v in vitals_dict.items() if v is not None}
    else:
        latest_v = {}
        for m in ["heart_rate", "spo2", "respiratory_rate", "temperature"]:
            r = db.query(DeviceReading).filter(DeviceReading.patient_id == patient.id, DeviceReading.metric == m).order_by(DeviceReading.recorded_at.desc()).first()
            if r:
                latest_v[m] = r.value
        if latest_v:
            serialized["vitals"] = latest_v

    # Format triggered safety rules for frontend TriggeredSafetyRule interface
    triggered_rules = []
    v = serialized.get("vitals", {})
    if v.get("spo2") is not None and v["spo2"] < 90:
        triggered_rules.append({
            "rule_id": "RF-001",
            "condition": "spo2 < 90",
            "reason": "Simulated SpO2 below 90 — severe hypoxemia threshold.",
            "forced_care_level": "POSSIBLE_EMERGENCY"
        })
    if v.get("heart_rate") is not None and v["heart_rate"] > 140:
        triggered_rules.append({
            "rule_id": "RF-003",
            "condition": "heart_rate > 140",
            "reason": "Simulated heart rate above 140 BPM.",
            "forced_care_level": "URGENT"
        })
    for s in payload.symptoms:
        sname = s.name.lower()
        if any(kw in sname for kw in ["breath", "dyspnea", "suffocat"]):
            triggered_rules.append({
                "rule_id": "RF-004",
                "condition": "breathing_difficulty_reported",
                "reason": "Patient-reported severe breathing difficulty.",
                "forced_care_level": "URGENT"
            })
        if any(kw in sname for kw in ["chest pain", "angina", "tightness", "pressure"]):
            triggered_rules.append({
                "rule_id": "RF-005",
                "condition": "chest_pain_severe",
                "reason": "Patient-reported severe chest pain.",
                "forced_care_level": "POSSIBLE_EMERGENCY"
            })
    serialized["triggered_safety_rules"] = triggered_rules

    return ok(serialized)


