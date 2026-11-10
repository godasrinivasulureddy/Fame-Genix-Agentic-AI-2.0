from typing import List, Optional
from pydantic import BaseModel, Field


class VisualFindingItem(BaseModel):
    finding: str
    severity: Optional[str] = "mild"
    location: Optional[str] = "localized"


class ImageAnalysisResponse(BaseModel):
    is_health_related: bool = True
    is_medical_document: bool = False
    image_quality: str = "ADEQUATE"  # GOOD | ADEQUATE | POOR | UNUSABLE
    body_area: str = "general_physical"
    visual_findings: List[VisualFindingItem] = []
    identified_conditions: List[str] = []
    suggested_specialist: Optional[str] = "General Physician / Internal Medicine"
    next_steps: List[str] = []
    red_flag_visual_signals: List[str] = []
    possible_visual_categories: List[str] = []
    limitations: List[str] = [
        "Visual appearance alone cannot determine the underlying cause."
    ]
    recommended_next_input: List[str] = []
    explanation: str = ""
    language: str = "English"
    suggested_specialty: str = "General Medicine"
    source: str = "AI_GEMINI_VISION"
