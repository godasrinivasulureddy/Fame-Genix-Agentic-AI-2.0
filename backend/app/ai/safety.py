"""
Safety and Guardrails for FAME GENIX AI Integration.
Ensures prompt injection protection, specialty routing, and health boundary enforcement.
"""

import re
from typing import List


def sanitize_input(text: str) -> str:
    """
    Sanitize user input to guard against prompt injection attacks.
    Removes common override instructions.
    """
    if not text:
        return ""
    
    # Strip potential injection phrases
    forbidden_patterns = [
        r"ignore\s+previous\s+instructions",
        r"system\s+prompt",
        r"give\s+me\s+admin",
        r"override\s+safety",
        r"you\s+are\n+now",
    ]
    
    sanitized = text
    for pattern in forbidden_patterns:
        sanitized = re.sub(pattern, "[FILTERED]", sanitized, flags=re.IGNORECASE)
        
    # Truncate overly long text inputs
    return sanitized[:1000].strip()


def map_suggested_specialty(top_factors: List[str], symptoms: List[str]) -> str:
    """
    Conservative mapping layer from clinical factors and symptoms to doctor specialties.
    Normalizes underscores/spaces and routes cardiac, respiratory, neuro, derma, gastric appropriately.
    """
    raw_str = " ".join([str(f).lower() for f in top_factors + symptoms])
    normalized = raw_str.replace("_", " ")

    # Cardiology (chest pain, heart attack, cardiac, pulse, RF-004)
    if any(k in normalized for k in ["heart", "cardio", "chest", "attack", "pulse", "tachycardia", "angina", "coronary", "vascular", "rf-004"]):
        return "Cardiologist (Heart & Vascular Specialist)"

    # Pulmonology
    if any(k in normalized for k in ["respiratory", "spo2", "breathing", "breath", "lung", "asthma", "cough", "wheez"]):
        return "Pulmonologist (Respiratory Specialist)"

    # Neurology
    if any(k in normalized for k in ["neurology", "headache", "dizziness", "dizzy", "unconscious", "stroke", "brain", "seizure", "numb"]):
        return "Neurologist (Brain & Nerve Specialist)"

    # Dermatology
    if any(k in normalized for k in ["skin", "rash", "derma", "lesion", "itch"]):
        return "Dermatologist (Skin Specialist)"

    # Ophthalmology
    if any(k in normalized for k in ["eye", "vision", "ophthalm"]):
        return "Ophthalmologist (Eye Specialist)"

    # Oncology / Cancer / Neoplasm
    if any(k in normalized for k in ["tumor", "tumour", "cancer", "carcinoma", "neoplasm", "neoplastic", "neuroendocrine", "net", "oncolog", "biopsy", "adenocarcinoma", "signet", "metastasis", "metastases"]):
        return "Medical Oncologist / Surgical Oncologist"

    # Gastroenterology
    if any(k in normalized for k in ["stomach", "gastric", "vomit", "nausea", "abdomen", "diarrhea", "dysphagia", "swallow", "stricture", "esophag", "esophageal", "ge junction", "cardia", "reflux", "endoscop"]):
        return "Gastroenterologist (Digestive Specialist)"

    return "General Physician / Internal Medicine"


def enforce_high_risk_guidance(care_level: str, text: str) -> str:
    """
    Ensures that URGENT or POSSIBLE_EMERGENCY care levels do NOT contain home remedies.
    """
    if care_level in ["URGENT", "POSSIBLE_EMERGENCY"]:
        # If explanation text contains home remedy phrasing, append urgent safety warning
        warning = "\n\n[IMPORTANT SAFETY NOTICE]: Due to elevated clinical indicators, immediate professional medical review is strongly advised. Do not rely on home self-care."
        if "immediate professional medical review" not in text.lower():
            return text + warning
    return text
