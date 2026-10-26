from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.response import ok
from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.db.models import User
from app.audit.helper import record_audit
from app.ai.service import ai_service
from app.ai.schemas import (
    SymptomExtractRequest,
    AssessmentExplainRequest,
    AIChatRequest,
    PatientInsightRequest,
)

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])


@router.get("/status")
def get_ai_status():
    status_data = ai_service.status()
    return ok(status_data.model_dump())


@router.post("/symptoms/extract")
async def extract_symptoms(payload: SymptomExtractRequest, db: Session = Depends(get_db)):
    result = await ai_service.extract_symptoms(payload)
    record_audit(db, None, "PATIENT", "AI_EXTRACT_SYMPTOMS", "symptom_extract", "text_input")
    return ok(result.model_dump())


@router.post("/assessment/explain")
async def explain_assessment(payload: AssessmentExplainRequest, db: Session = Depends(get_db)):
    result = await ai_service.explain_assessment(payload)
    record_audit(db, None, "PATIENT", "AI_EXPLAIN_ASSESSMENT", "risk_assessment", str(payload.risk_score))
    return ok(result.model_dump())


@router.post("/patient-insight")
async def generate_patient_insight(
    payload: PatientInsightRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.db.models import RiskAssessment, RiskFactor, Patient, SymptomSession, SymptomEntry
    from app.patients.service import assert_can_view_patient
    from app.core.exceptions import app_error

    if payload.assessment_id:
        a = db.query(RiskAssessment).filter(RiskAssessment.id == payload.assessment_id).first()
        if not a:
            raise app_error("NOT_FOUND", "Assessment not found.")
        patient = db.query(Patient).filter(Patient.id == a.patient_id).first()
        if not patient:
            raise app_error("PATIENT_NOT_FOUND", "Patient not found for assessment.")
        assert_can_view_patient(user, patient)

        payload.risk_score = a.risk_score
        payload.confidence_score = a.confidence_score
        payload.care_level = a.care_level
        factors = db.query(RiskFactor).filter(RiskFactor.assessment_id == a.id).all()
        if factors:
            payload.top_factors = [f.factor_name for f in factors]
        if a.session_id:
            entries = db.query(SymptomEntry).filter(SymptomEntry.session_id == a.session_id).all()
            if entries:
                payload.concepts = [e.concept for e in entries]
        payload.patient_profile = f"{patient.full_name}, Age: {patient.age or 'N/A'}, Conditions: {patient.known_conditions or 'None'}"

    result = await ai_service.generate_patient_insight(payload)
    record_audit(db, user.id, user.role, "AI_PATIENT_INSIGHT", "patient_insight", str(payload.risk_score))
    res_dict = result.model_dump()
    if hasattr(result, "specialist") and hasattr(result.specialist, "specialty"):
        res_dict["suggested_specialty"] = result.specialist.specialty
    return ok(res_dict)


@router.post("/chat")
async def chat_with_ai(
    payload: AIChatRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.db.models import User, Patient, RiskAssessment, RiskFactor, PatientHealthNote
    
    # Authenticate and query patient
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if patient:
        # Fetch the latest authoritative assessment for this patient
        latest = db.query(RiskAssessment).filter(RiskAssessment.patient_id == patient.id).order_by(RiskAssessment.created_at.desc()).first()
        if latest:
            payload.risk_score = latest.risk_score
            payload.care_level = latest.care_level
            
            # Fetch risk factors
            factors = db.query(RiskFactor).filter(RiskFactor.assessment_id == latest.id).all()
            payload.top_factors = [f.factor_name for f in factors]
            
            # Populate patient profile and health notes in the prompt context automatically
            recent_notes = db.query(PatientHealthNote).filter(PatientHealthNote.patient_id == patient.id).order_by(PatientHealthNote.created_at.desc()).limit(5).all()
            
            payload.patient_profile = f"{patient.full_name}, Age: {patient.age or 'N/A'}, Known: {patient.known_conditions or 'None'}"
            payload.health_notes = [n.note_text for n in recent_notes]

    result = await ai_service.chat(payload)
    record_audit(db, user.id, "PATIENT", "AI_CHAT", "chat_session", "message")
    return ok(result.model_dump())


@router.get("/conversations")
def get_conversations(db: Session = Depends(get_db)):
    from app.db.models import ChatConversation
    convs = db.query(ChatConversation).order_by(ChatConversation.is_pinned.desc(), ChatConversation.updated_at.desc()).all()
    res = [
        {
            "id": c.id,
            "user_id": c.user_id,
            "title": c.title,
            "is_pinned": c.is_pinned,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat(),
        }
        for c in convs
    ]
    return ok(res)


@router.post("/conversations")
def create_conversation(payload: dict = None, db: Session = Depends(get_db)):
    from app.db.models import ChatConversation
    title = (payload or {}).get("title", "New Conversation")
    conv = ChatConversation(user_id="demo_user_1", title=title)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return ok({
        "id": conv.id,
        "user_id": conv.user_id,
        "title": conv.title,
        "is_pinned": conv.is_pinned,
        "created_at": conv.created_at.isoformat(),
        "updated_at": conv.updated_at.isoformat(),
    })


@router.put("/conversations/{conv_id}")
def update_conversation(conv_id: str, payload: dict, db: Session = Depends(get_db)):
    from app.db.models import ChatConversation
    conv = db.query(ChatConversation).filter(ChatConversation.id == conv_id).first()
    if conv:
        if "title" in payload:
            conv.title = payload["title"]
        if "is_pinned" in payload:
            conv.is_pinned = payload["is_pinned"]
        db.commit()
    return ok({"status": "updated"})


@router.delete("/conversations/{conv_id}")
def delete_conversation(conv_id: str, db: Session = Depends(get_db)):
    from app.db.models import ChatConversation, ChatMessageModel
    db.query(ChatMessageModel).filter(ChatMessageModel.conversation_id == conv_id).delete()
    db.query(ChatConversation).filter(ChatConversation.id == conv_id).delete()
    db.commit()
    return ok({"status": "deleted"})
