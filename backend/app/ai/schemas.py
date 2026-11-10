from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field


class AIStatusData(BaseModel):
    enabled: bool
    provider: str = "Gemini"
    configured: bool
    reachable: bool
    model: str


class SymptomExtractRequest(BaseModel):
    text: Optional[str] = Field(None, description="Raw natural text describing symptoms")
    raw_text: Optional[str] = Field(None, description="Raw natural text describing symptoms alias")
    language: str = Field("auto", description="Preferred language or 'auto'")

    def get_text(self) -> str:
        return self.raw_text or self.text or ""


class ExtractedSymptomItem(BaseModel):
    name: Optional[str] = None
    canonical_name: Optional[str] = None
    severity: Optional[Union[str, int]] = None
    duration_hours: Optional[int] = None
    duration: Optional[str] = None
    body_site: Optional[str] = None

    def __init__(self, **data):
        if "name" not in data and "canonical_name" in data:
            data["name"] = data["canonical_name"]
        elif "canonical_name" not in data and "name" in data:
            data["canonical_name"] = data["name"]
        super().__init__(**data)


class MissingInformationItem(BaseModel):
    question: Optional[str] = None
    field: Optional[str] = None
    reason: Optional[str] = ""


class SymptomExtractResponse(BaseModel):
    original_text: Optional[str] = None
    raw_text: Optional[str] = None
    detected_language: Optional[str] = "English"
    language_detected: Optional[str] = "English"
    symptoms: List[ExtractedSymptomItem] = []
    red_flag_phrases: List[str] = []
    missing_information: List[Union[MissingInformationItem, str, dict]] = []
    clarifying_questions: List[str] = []
    confidence_score: float = 0.85
    suggested_specialty: Optional[str] = None
    source: str = "AI_GEMINI"


class AssessmentExplainRequest(BaseModel):
    risk_score: float = Field(..., ge=0, le=100)
    confidence_score: float = Field(default=85.0, ge=0, le=100)
    care_level: Optional[str] = None
    acuity_tier: Optional[str] = None
    top_factors: List[str] = []
    concepts: List[str] = []
    triggered_rules: List[str] = []
    vitals: Dict[str, Any] = {}
    missing_evidence: List[str] = []
    language: str = Field("English", description="Target output language (English, Telugu, Hindi)")
    patient_profile: Optional[str] = None
    health_notes: Optional[List[str]] = None

    def get_tier(self) -> str:
        return self.care_level or self.acuity_tier or "STABLE"


class AssessmentExplainResponse(BaseModel):
    explanation: str
    language: str = "English"
    suggested_specialty: str = "General Medicine"
    safety_level: str = "NORMAL"
    requires_professional_review: bool = False
    immediate_actions: List[str] = []
    care_guidance: Optional[str] = None
    limitations: List[str] = []
    source: str = "AI_GEMINI"


class AIChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    history: Optional[List[Dict[str, Any]]] = None
    care_level: Optional[str] = "STABLE"
    risk_score: Optional[float] = 0.0
    top_factors: Optional[List[str]] = []
    language: Optional[str] = "English"
    patient_profile: Optional[str] = None
    health_notes: Optional[List[str]] = None
    attachments: Optional[List[Dict[str, Any]]] = None


class CreateConversationRequest(BaseModel):
    title: Optional[str] = "New Conversation"


class UpdateConversationRequest(BaseModel):
    title: Optional[str] = None
    is_pinned: Optional[bool] = None


class ChatMessageSchema(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    attachments: Optional[List[Dict[str, Any]]] = None
    created_at: str


class ChatConversationSchema(BaseModel):
    id: str
    user_id: str
    title: str
    is_pinned: bool
    created_at: str
    updated_at: str
    messages_count: Optional[int] = 0
    last_message: Optional[str] = None


class AIChatResponse(BaseModel):
    message: str
    language: str = "English"
    suggested_specialty: Optional[str] = "General Medicine"
    safety_level: str = "NORMAL"
    requires_professional_review: bool = False


class SelfCareItem(BaseModel):
    title: str
    description: str


class FoodItem(BaseModel):
    title: str
    reason: str


class FoodGuidance(BaseModel):
    recommended: List[FoodItem] = []
    limit: List[FoodItem] = []


class SpecialistGuidance(BaseModel):
    specialty: str = "General Physician / Internal Medicine"
    reason: str = "General health monitoring and baseline evaluation."


class PatientInsightRequest(BaseModel):
    risk_score: float = Field(..., ge=0, le=100)
    confidence_score: float = Field(..., ge=0, le=100)
    care_level: str
    top_factors: List[str] = []
    symptom_text: Optional[str] = None
    concepts: List[str] = []
    followup_answers: Optional[List[str]] = None
    language: str = Field("en", description="en, te, or hi")
    patient_profile: Optional[str] = None
    health_notes: Optional[List[str]] = None
    lab_summary: Optional[str] = None


class PatientInsightResponse(BaseModel):
    explanation: str
    possible_patterns: List[str] = []
    specialist: SpecialistGuidance
    self_care: List[SelfCareItem] = []
    food_guidance: FoodGuidance
    source: str = "AI_GEMINI"
