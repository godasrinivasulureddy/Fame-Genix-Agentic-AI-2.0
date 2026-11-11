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

# In-memory LRU-like cache for patient insights keyed by assessment_id
# Avoids redundant external AI generation on Health History view/modal/PDF downloads
_INSIGHT_CACHE: dict[str, dict] = {}


@router.get("/status")
def get_ai_status():
    status_data = ai_service.status()
    return ok(status_data.model_dump())


@router.post("/symptoms/extract")
def extract_symptoms(payload: SymptomExtractRequest, db: Session = Depends(get_db)):
    result = ai_service.extract_symptoms(payload)
    record_audit(db, None, "PATIENT", "AI_EXTRACT_SYMPTOMS", "symptom_extract", "text_input")
    return ok(result.model_dump())


@router.post("/assessment/explain")
def explain_assessment(payload: AssessmentExplainRequest, db: Session = Depends(get_db)):
    result = ai_service.explain_assessment(payload)
    record_audit(db, None, "PATIENT", "AI_EXPLAIN_ASSESSMENT", "risk_assessment", str(payload.risk_score))
    return ok(result.model_dump())


@router.post("/patient-insight")
async def generate_patient_insight(
    payload: dict,
    db: Session = Depends(get_db)
):
    from app.db.models import RiskAssessment, RiskFactor, Patient
    # Support both { assessment_id: str } from frontend and full PatientInsightRequest
    assessment_id = payload.get("assessment_id")
    if assessment_id:
        # Check cache first for instant retrieval
        if assessment_id in _INSIGHT_CACHE:
            return ok(_INSIGHT_CACHE[assessment_id])

        a = db.query(RiskAssessment).filter(RiskAssessment.id == assessment_id).first()
        if not a:
            raise app_error("NOT_FOUND", "Assessment not found.")
        factors = db.query(RiskFactor).filter(RiskFactor.assessment_id == a.id).all()
        top_factors = [f.factor_name for f in factors]
        
        # Hydrate symptoms concepts if available from session
        symptom_concepts = []
        if a.session_id:
            from app.db.models import SymptomEntry
            entries = db.query(SymptomEntry).filter(SymptomEntry.session_id == a.session_id).all()
            symptom_concepts = [e.concept for e in entries if e.concept]

        req = PatientInsightRequest(
            risk_score=float(a.risk_score),
            confidence_score=float(getattr(a, "confidence_score", 90.0)),
            care_level=a.care_level or "URGENT",
            top_factors=top_factors,
            concepts=symptom_concepts,
            language="en"
        )
        import inspect
        if inspect.iscoroutinefunction(ai_service.generate_patient_insight):
            result = await ai_service.generate_patient_insight(req)
        else:
            result = ai_service.generate_patient_insight(req)
        record_audit(db, None, "PATIENT", "AI_PATIENT_INSIGHT", "patient_insight", str(a.risk_score))
        res_data = result.model_dump()
        res_data["suggested_specialty"] = result.specialist.specialty
        
        # Cache result so viewing or downloading this assessment never hits AI again
        _INSIGHT_CACHE[assessment_id] = res_data
        return ok(res_data)

    req = PatientInsightRequest(**payload)
    import inspect
    if inspect.iscoroutinefunction(ai_service.generate_patient_insight):
        result = await ai_service.generate_patient_insight(req)
    else:
        result = ai_service.generate_patient_insight(req)
    record_audit(db, None, "PATIENT", "AI_PATIENT_INSIGHT", "patient_insight", str(req.risk_score))
    res_data = result.model_dump()
    res_data["suggested_specialty"] = result.specialist.specialty
    return ok(res_data)


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

    import inspect
    if inspect.iscoroutinefunction(ai_service.chat_companion):
        result = await ai_service.chat_companion(payload)
    else:
        result = ai_service.chat_companion(payload)
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

@router.post("/multi-agent/consensus")
def generate_multi_agent_clinical_consensus(
    payload: dict,
    user: User = Depends(get_current_user)
):
    from app.agents.specialized_society import multi_agent_society
    symptom_text = payload.get("symptom_text", "")
    vitals = payload.get("vitals", {})
    conditions = payload.get("conditions")
    allergies = payload.get("allergies")
    lab_values = payload.get("lab_values", {})

    consensus = multi_agent_society.analyze_complex_case(
        symptom_text=symptom_text,
        vitals=vitals,
        patient_conditions=conditions,
        allergies=allergies,
        lab_values=lab_values
    )
    return ok(consensus.model_dump())
