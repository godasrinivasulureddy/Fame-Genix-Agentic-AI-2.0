import uuid
from datetime import datetime

from sqlalchemy import (Boolean, Column, DateTime, Float, ForeignKey, Integer,
                         String, Text, UniqueConstraint)

from app.db.base import Base


def gen_id() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.utcnow()


# ---------------------------------------------------------------------------
# Constant "enums" stored as plain strings (portable across SQLite/Postgres).
# ---------------------------------------------------------------------------
class Role:
    PATIENT = "PATIENT"
    DOCTOR = "DOCTOR"
    EMERGENCY_OPERATOR = "EMERGENCY_OPERATOR"
    AMBULANCE_TEAM = "AMBULANCE_TEAM"
    SYSTEM_ADMIN = "SYSTEM_ADMIN"
    ALL = [PATIENT, DOCTOR, EMERGENCY_OPERATOR, AMBULANCE_TEAM, SYSTEM_ADMIN]


class DeviceType:
    FAME_MASK = "FAME_MASK"
    SMART_RING = "SMART_RING"
    SMART_WATCH = "SMART_WATCH"
    FAME_HELMET = "FAME_HELMET"
    FAME_VISION = "FAME_VISION"
    GENERIC_DEVICE = "GENERIC_DEVICE"


class DeviceStatus:
    NOT_CONNECTED = "NOT_CONNECTED"
    CONNECTED = "CONNECTED"
    SIMULATED = "SIMULATED"
    ERROR = "ERROR"


class SourceType:
    SIMULATOR = "SIMULATOR"
    MANUAL = "MANUAL"
    DEVICE = "DEVICE"
    REPORT = "REPORT"
    CLINICIAN = "CLINICIAN"


class Quality:
    SIMULATED = "SIMULATED"
    UNVERIFIED = "UNVERIFIED"
    VERIFIED = "VERIFIED"
    LOW_QUALITY = "LOW_QUALITY"
    INVALID = "INVALID"


class CareLevel:
    STABLE = "STABLE"
    MONITOR = "MONITOR"
    ROUTINE_REVIEW = "ROUTINE_REVIEW"
    PRIORITY_REVIEW = "PRIORITY_REVIEW"
    URGENT = "URGENT"
    POSSIBLE_EMERGENCY = "POSSIBLE_EMERGENCY"
    ORDER = [STABLE, MONITOR, ROUTINE_REVIEW, PRIORITY_REVIEW, URGENT, POSSIBLE_EMERGENCY]


class EmergencyStatus:
    DETECTED = "DETECTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    VERIFIED = "VERIFIED"
    DISPATCH_REQUESTED = "DISPATCH_REQUESTED"
    DISPATCHED = "DISPATCHED"
    EN_ROUTE = "EN_ROUTE"
    ON_SCENE = "ON_SCENE"
    PATIENT_REACHED = "PATIENT_REACHED"
    TRANSPORTING = "TRANSPORTING"
    HOSPITAL_REACHED = "HOSPITAL_REACHED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


EMERGENCY_TRANSITIONS = {
    EmergencyStatus.DETECTED: [EmergencyStatus.UNDER_REVIEW, EmergencyStatus.CANCELLED],
    EmergencyStatus.UNDER_REVIEW: [EmergencyStatus.VERIFIED, EmergencyStatus.CANCELLED],
    EmergencyStatus.VERIFIED: [EmergencyStatus.DISPATCH_REQUESTED, EmergencyStatus.CANCELLED],
    EmergencyStatus.DISPATCH_REQUESTED: [EmergencyStatus.DISPATCHED, EmergencyStatus.CANCELLED],
    EmergencyStatus.DISPATCHED: [EmergencyStatus.EN_ROUTE, EmergencyStatus.CANCELLED],
    EmergencyStatus.EN_ROUTE: [EmergencyStatus.ON_SCENE, EmergencyStatus.CANCELLED],
    EmergencyStatus.ON_SCENE: [EmergencyStatus.TRANSPORTING, EmergencyStatus.CANCELLED],
    EmergencyStatus.PATIENT_REACHED: [EmergencyStatus.TRANSPORTING, EmergencyStatus.CANCELLED],
    EmergencyStatus.TRANSPORTING: [EmergencyStatus.HOSPITAL_REACHED, EmergencyStatus.CANCELLED],
    EmergencyStatus.HOSPITAL_REACHED: [EmergencyStatus.COMPLETED],
    EmergencyStatus.COMPLETED: [],
    EmergencyStatus.CANCELLED: [],
}


class TriggerType:
    RULE = "RULE"
    CLINICIAN = "CLINICIAN"
    DEMO_SIMULATION = "DEMO_SIMULATION"


class ConsentPurpose:
    SHARE_WITH_DOCTOR = "SHARE_WITH_DOCTOR"
    EMERGENCY_DATA_SHARING = "EMERGENCY_DATA_SHARING"
    EMERGENCY_LOCATION_SHARING = "EMERGENCY_LOCATION_SHARING"
    DEVICE_DATA_COLLECTION = "DEVICE_DATA_COLLECTION"


# ---------------------------------------------------------------------------
# Identity
# ---------------------------------------------------------------------------
class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=gen_id)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)
    created_at = Column(DateTime, default=utcnow)


# ---------------------------------------------------------------------------
# Clinical
# ---------------------------------------------------------------------------
class Patient(Base):
    __tablename__ = "patients"
    id = Column(String, primary_key=True, default=gen_id)
    public_id = Column(String, unique=True, index=True, nullable=True)
    user_id = Column(String, ForeignKey("users.id"), unique=True, nullable=False)
    full_name = Column(String, nullable=False)
    date_of_birth = Column(String, nullable=True)
    sex = Column(String, nullable=True)
    age = Column(Integer, nullable=True)
    height_cm = Column(Float, nullable=True)
    weight_kg = Column(Float, nullable=True)
    profile_picture_url = Column(Text, nullable=True)
    known_conditions = Column(Text, nullable=True)  # comma-separated / JSON string
    family_history = Column(Text, nullable=True)
    allergies = Column(Text, nullable=True)  # JSON or comma-separated list
    emergency_contact_name = Column(String, nullable=True)
    emergency_contact_phone = Column(String, nullable=True)
    secondary_contact_name = Column(String, nullable=True)
    secondary_contact_phone = Column(String, nullable=True)
    emergency_contact_relationship = Column(String, nullable=True)
    secondary_contact_relationship = Column(String, nullable=True)
    blood_group = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow)


class PatientHealthNote(Base):
    __tablename__ = "patient_health_notes"
    id = Column(String, primary_key=True, default=gen_id)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    note_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utcnow, index=True)


class Doctor(Base):
    __tablename__ = "doctors"
    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), unique=True, nullable=False)
    full_name = Column(String, nullable=False)
    specialty = Column(String, nullable=True)


class Consent(Base):
    __tablename__ = "consents"
    id = Column(String, primary_key=True, default=gen_id)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False)
    purpose = Column(String, nullable=False)
    granted = Column(Boolean, default=False)
    version = Column(Integer, default=1)
    granted_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    __table_args__ = (UniqueConstraint("patient_id", "purpose", name="uq_consent_patient_purpose"),)


# ---------------------------------------------------------------------------
# Devices
# ---------------------------------------------------------------------------
class Device(Base):
    __tablename__ = "devices"
    id = Column(String, primary_key=True, default=gen_id)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False)
    type = Column(String, nullable=False)
    status = Column(String, default=DeviceStatus.NOT_CONNECTED)
    last_seen = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)


class DeviceReading(Base):
    __tablename__ = "device_readings"
    id = Column(String, primary_key=True, default=gen_id)
    device_id = Column(String, ForeignKey("devices.id"), nullable=False)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    metric = Column(String, nullable=False, index=True)
    value = Column(Float, nullable=False)
    unit = Column(String, nullable=False)
    source_type = Column(String, nullable=False)
    quality = Column(String, nullable=False)
    recorded_at = Column(DateTime, default=utcnow, index=True)


# ---------------------------------------------------------------------------
# Symptoms / assessments
# ---------------------------------------------------------------------------
class SymptomSession(Base):
    __tablename__ = "symptom_sessions"
    id = Column(String, primary_key=True, default=gen_id)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False)
    raw_text = Column(Text, nullable=False)
    language = Column(String, default="en")
    status = Column(String, default="OPEN")  # OPEN | FINALIZED
    created_at = Column(DateTime, default=utcnow)


class SymptomEntry(Base):
    __tablename__ = "symptom_entries"
    id = Column(String, primary_key=True, default=gen_id)
    session_id = Column(String, ForeignKey("symptom_sessions.id"), nullable=False)
    concept = Column(String, nullable=False)
    severity = Column(String, nullable=True)  # mild|moderate|severe
    duration_hours = Column(Float, nullable=True)


class FollowupQuestion(Base):
    __tablename__ = "followup_questions"
    id = Column(String, primary_key=True, default=gen_id)
    session_id = Column(String, ForeignKey("symptom_sessions.id"), nullable=False)
    question = Column(String, nullable=False)
    reason = Column(String, nullable=False)
    asked_at = Column(DateTime, default=utcnow)


class FollowupAnswer(Base):
    __tablename__ = "followup_answers"
    id = Column(String, primary_key=True, default=gen_id)
    question_id = Column(String, ForeignKey("followup_questions.id"), nullable=False)
    answer = Column(String, nullable=False)
    answered_at = Column(DateTime, default=utcnow)


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"
    id = Column(String, primary_key=True, default=gen_id)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    session_id = Column(String, ForeignKey("symptom_sessions.id"), nullable=True)
    risk_score = Column(Float, nullable=False)
    confidence_score = Column(Float, nullable=False)
    care_level = Column(String, nullable=False)
    suggested_action = Column(Text, nullable=True)
    missing_evidence = Column(Text, nullable=True)  # JSON string list
    created_at = Column(DateTime, default=utcnow, index=True)


class RiskFactor(Base):
    __tablename__ = "risk_factors"
    id = Column(String, primary_key=True, default=gen_id)
    assessment_id = Column(String, ForeignKey("risk_assessments.id"), nullable=False)
    factor_name = Column(String, nullable=False)
    contribution = Column(Float, nullable=False)
    direction = Column(String, nullable=False)  # increases_risk | decreases_risk


class HealthScore(Base):
    __tablename__ = "health_scores"
    id = Column(String, primary_key=True, default=gen_id)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    score = Column(Float, nullable=False)
    computed_at = Column(DateTime, default=utcnow)


# ---------------------------------------------------------------------------
# Baseline / drift
# ---------------------------------------------------------------------------
class PatientBaseline(Base):
    __tablename__ = "patient_baselines"
    id = Column(String, primary_key=True, default=gen_id)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False)
    metric = Column(String, nullable=False)
    mean = Column(Float, nullable=False)
    stddev = Column(Float, nullable=False)
    observation_count = Column(Integer, default=0)
    confidence = Column(Float, default=0.0)
    updated_at = Column(DateTime, default=utcnow)
    # FIX: composite uniqueness, NOT patient_id alone (a patient has many metrics)
    __table_args__ = (UniqueConstraint("patient_id", "metric", name="uq_baseline_patient_metric"),)


class DriftEvent(Base):
    __tablename__ = "drift_events"
    id = Column(String, primary_key=True, default=gen_id)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    drift_score = Column(Float, nullable=False)
    direction = Column(String, nullable=False)  # stable|worsening|improving
    severity = Column(String, nullable=False)  # none|low|moderate|high
    contributing_metrics = Column(Text, nullable=True)  # JSON string list
    detected_at = Column(DateTime, default=utcnow)


# ---------------------------------------------------------------------------
# Doctor workflow
# ---------------------------------------------------------------------------
class DoctorReview(Base):
    __tablename__ = "doctor_reviews"
    id = Column(String, primary_key=True, default=gen_id)
    doctor_id = Column(String, ForeignKey("doctors.id"), nullable=False)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False)
    assessment_id = Column(String, ForeignKey("risk_assessments.id"), nullable=True)
    note = Column(Text, nullable=True)
    decision = Column(String, nullable=False)  # MONITOR|FOLLOW_UP|URGENT_REVIEW|EMERGENCY_ESCALATION|RESOLVED
    created_at = Column(DateTime, default=utcnow)


# ---------------------------------------------------------------------------
# Emergency / ambulance / hospital
# ---------------------------------------------------------------------------
class EmergencyCase(Base):
    __tablename__ = "emergency_cases"
    id = Column(String, primary_key=True, default=gen_id)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    status = Column(String, default=EmergencyStatus.DETECTED)
    severity = Column(String, nullable=False)

    # Provenance (required correction: full trigger context)
    trigger_type = Column(String, nullable=False)  # RULE | CLINICIAN | DEMO_SIMULATION
    trigger_rule_id = Column(String, nullable=True)
    trigger_assessment_id = Column(String, ForeignKey("risk_assessments.id"), nullable=True)
    trigger_measurements = Column(Text, nullable=True)  # JSON string snapshot
    measurement_quality = Column(String, nullable=True)
    trigger_timestamp = Column(DateTime, default=utcnow)
    simulation_status = Column(String, default="SIMULATED")

    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location_accuracy = Column(Float, nullable=True)
    location_source = Column(String, nullable=True)
    location_consent = Column(Boolean, default=False)

    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow)


class EmergencyCaseEvent(Base):
    __tablename__ = "emergency_case_events"
    id = Column(String, primary_key=True, default=gen_id)
    case_id = Column(String, ForeignKey("emergency_cases.id"), nullable=False)
    event_type = Column(String, nullable=False)
    payload = Column(Text, nullable=True)  # JSON string
    created_at = Column(DateTime, default=utcnow)


class AmbulanceAssignment(Base):
    __tablename__ = "ambulance_assignments"
    id = Column(String, primary_key=True, default=gen_id)
    case_id = Column(String, ForeignKey("emergency_cases.id"), nullable=False)
    ambulance_code = Column(String, default="SIM-AMB-01")
    status = Column(String, default="REQUESTED")
    assigned_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow)


class HospitalHandoff(Base):
    __tablename__ = "hospital_handoffs"
    id = Column(String, primary_key=True, default=gen_id)
    case_id = Column(String, ForeignKey("emergency_cases.id"), nullable=False)
    hospital_name = Column(String, default="Fame Genix Trauma Emergency Dept")
    status = Column(String, default="NOTIFIED")
    eta_minutes = Column(Integer, nullable=True)
    summary = Column(Text, nullable=True)
    notified_at = Column(DateTime, default=utcnow)


# ---------------------------------------------------------------------------
# Platform
# ---------------------------------------------------------------------------
class Notification(Base):
    __tablename__ = "notifications"
    id = Column(String, primary_key=True, default=gen_id)
    recipient_user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String, nullable=False)
    payload = Column(Text, nullable=True)  # JSON string
    channel = Column(String, default="IN_APP")
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(String, primary_key=True, default=gen_id)
    actor_id = Column(String, nullable=True)
    actor_role = Column(String, nullable=True)
    action = Column(String, nullable=False)
    target_type = Column(String, nullable=True)
    target_id = Column(String, nullable=True)
    result = Column(String, default="SUCCESS")
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, index=True)


class SimulatorSession(Base):
    """Tracks the active demo simulator scenario/step per patient."""
    __tablename__ = "simulator_sessions"
    id = Column(String, primary_key=True, default=gen_id)
    patient_id = Column(String, ForeignKey("patients.id"), unique=True, nullable=False)
    device_id = Column(String, ForeignKey("devices.id"), nullable=False)
    scenario = Column(String, nullable=False)
    current_step = Column(Integer, default=0)
    status = Column(String, default="RUNNING")  # RUNNING | STOPPED
    updated_at = Column(DateTime, default=utcnow)


# ---------------------------------------------------------------------------
# Persistent Conversational AI Chat Models
# ---------------------------------------------------------------------------
class ChatConversation(Base):
    __tablename__ = "chat_conversations"
    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False, default="New Conversation")
    is_pinned = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow, index=True)
    updated_at = Column(DateTime, default=utcnow)


class ChatMessageModel(Base):
    __tablename__ = "chat_messages"
    id = Column(String, primary_key=True, default=gen_id)
    conversation_id = Column(String, ForeignKey("chat_conversations.id"), nullable=False, index=True)
    role = Column(String, nullable=False)  # "user" | "assistant"
    content = Column(Text, nullable=False)
    attachments_json = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, index=True)


class DoctorConsultationRequest(Base):
    __tablename__ = "doctor_consultation_requests"
    id = Column(String, primary_key=True, default=gen_id)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    assessment_id = Column(String, ForeignKey("risk_assessments.id"), nullable=True)
    doctor_id = Column(String, ForeignKey("doctors.id"), nullable=True)
    specialty = Column(String, nullable=False)
    health_summary = Column(Text, nullable=True)
    risk_score = Column(Float, nullable=False)
    care_level = Column(String, nullable=False)
    token_number = Column(String, nullable=False, unique=True)
    status = Column(String, default="WAITING")  # WAITING | IN_REVIEW | COMPLETED | CANCELLED
    requested_at = Column(DateTime, default=utcnow, index=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)


