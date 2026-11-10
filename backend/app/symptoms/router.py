from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.core.exceptions import app_error
from app.core.response import ok
from app.db.models import (FollowupAnswer, FollowupQuestion, Role,
                            SymptomEntry, SymptomSession, User)
from app.db.session import get_db
from app.patients.service import get_patient_by_user
from app.symptoms.schemas import AnswerRequest, CreateSessionRequest
from app.symptoms.vocabulary import extract_concepts, generate_followups

from app.ai.service import ai_service
from app.ai.schemas import SymptomExtractRequest

router = APIRouter(prefix="/api/v1/symptoms", tags=["symptoms"])


@router.post("/sessions")
def create_session(payload: CreateSessionRequest, user: User = Depends(require_role(Role.PATIENT)),
                   db: Session = Depends(get_db)):
    patient = get_patient_by_user(db, user)
    session = SymptomSession(patient_id=patient.id, raw_text=payload.raw_text, language=payload.language)
    db.add(session)
    db.flush()

    # Dynamic Gemini AI Symptom Concept & Question Extraction (synchronous call)
    ai_res = ai_service.extract_symptoms(SymptomExtractRequest(text=payload.raw_text, language=payload.language))
    
    ai_concepts = [
        (s.canonical_name or s.name)
        for s in (ai_res.symptoms or [])
        if (s.canonical_name or s.name) and (s.canonical_name or s.name) != "unknown"
    ]
    fallback_concepts = extract_concepts(payload.raw_text)
    
    concepts = list(dict.fromkeys(ai_concepts + fallback_concepts))
    if not concepts:
        concepts = ["physical_symptom_observation"]

    raw_lower = payload.raw_text.lower()
    is_high_risk = any(kw in raw_lower for kw in ["heart attack", "chest pain", "cardiac", "cant breathe", "can't breathe", "shortness of breath", "bleeding", "unconscious", "fainting", "severe"])
    is_mild = any(kw in raw_lower for kw in ["mild", "slight", "minor", "screen work", "headache after", "tired", "routine"])
    
    if is_high_risk:
        initial_severity = "severe"
    elif is_mild:
        initial_severity = "mild"
    else:
        initial_severity = "moderate"

    for c in concepts:
        db.add(SymptomEntry(session_id=session.id, concept=c, severity=initial_severity))

    # Dynamic Gemini AI Follow-up Questions
    questions = []
    if ai_res.missing_information and len(ai_res.missing_information) > 0:
        for q_item in ai_res.missing_information:
            q_text = None
            q_reason = "Clinical triage evaluation"
            if hasattr(q_item, "question") and getattr(q_item, "question"):
                q_text = getattr(q_item, "question")
                q_reason = getattr(q_item, "reason", q_reason) or q_reason
            elif hasattr(q_item, "field") and getattr(q_item, "field"):
                q_text = f"Could you provide more details regarding {getattr(q_item, 'field')}?"
                q_reason = getattr(q_item, "reason", q_reason) or q_reason
            elif isinstance(q_item, str) and q_item.strip():
                q_text = q_item.strip()
            elif isinstance(q_item, dict):
                q_text = q_item.get("question") or (f"Could you clarify {q_item.get('field')}?" if q_item.get("field") else None)
                q_reason = q_item.get("reason", q_reason) or q_reason

            if q_text:
                questions.append((q_text, q_reason))

    # Also check clarifying_questions
    if hasattr(ai_res, "clarifying_questions") and ai_res.clarifying_questions:
        for cq in ai_res.clarifying_questions:
            if cq and isinstance(cq, str) and not any(cq == existing[0] for existing in questions):
                questions.append((cq, "Clinical risk triage clarification"))

    if not questions:
        questions = generate_followups(concepts)

    question_rows = []
    for q, reason in questions:
        if not q:
            continue
        fq = FollowupQuestion(session_id=session.id, question=q, reason=reason)
        db.add(fq)
        db.flush()
        question_rows.append({"id": fq.id, "question": q, "reason": reason})

    db.commit()
    return ok({
        "id": session.id, "patient_id": patient.id, "status": session.status,
        "concepts": concepts, "followup_questions": question_rows,
    })


@router.get("/sessions/{session_id}")
def get_session(session_id: str, user: User = Depends(require_role(Role.PATIENT)), db: Session = Depends(get_db)):
    session = db.query(SymptomSession).filter(SymptomSession.id == session_id).first()
    if not session:
        raise app_error("NOT_FOUND", "Symptom session not found.")
    entries = db.query(SymptomEntry).filter(SymptomEntry.session_id == session_id).all()
    questions = db.query(FollowupQuestion).filter(FollowupQuestion.session_id == session_id).all()
    answers = {a.question_id: a.answer for a in
               db.query(FollowupAnswer).join(FollowupQuestion).filter(FollowupQuestion.session_id == session_id)}
    return ok({
        "id": session.id, "status": session.status, "raw_text": session.raw_text,
        "concepts": [e.concept for e in entries],
        "followup_questions": [
            {"id": q.id, "question": q.question, "reason": q.reason, "answer": answers.get(q.id)}
            for q in questions
        ],
    })


@router.post("/sessions/{session_id}/answers")
def answer_followup(session_id: str, payload: AnswerRequest, user: User = Depends(require_role(Role.PATIENT)),
                     db: Session = Depends(get_db)):
    question = db.query(FollowupQuestion).filter(FollowupQuestion.id == payload.question_id,
                                                  FollowupQuestion.session_id == session_id).first()
    if not question:
        raise app_error("NOT_FOUND", "Follow-up question not found.")
    answer = FollowupAnswer(question_id=question.id, answer=payload.answer)
    db.add(answer)
    db.commit()
    return ok({"question_id": question.id, "answer": payload.answer})


@router.post("/sessions/{session_id}/finalize")
def finalize_session(session_id: str, user: User = Depends(require_role(Role.PATIENT)), db: Session = Depends(get_db)):
    session = db.query(SymptomSession).filter(SymptomSession.id == session_id).first()
    if not session:
        raise app_error("NOT_FOUND", "Symptom session not found.")
    session.status = "FINALIZED"
    db.commit()
    return ok({"id": session.id, "status": session.status})
