from typing import List, Optional
from pydantic import BaseModel, Field


class LabTestItem(BaseModel):
    name: str
    normalized_name: str
    value: Optional[float] = None
    raw_value: Optional[str] = ""
    unit: Optional[str] = ""
    reference_min: Optional[float] = None
    reference_max: Optional[float] = None
    raw_reference_range: Optional[str] = ""
    status: str = "UNKNOWN"  # LOW | NORMAL | HIGH | CRITICAL_REPORTED | UNKNOWN


class ReportAnalysisResponse(BaseModel):
    is_medical_report: bool = True
    report_type: str = "UNKNOWN"  # CBC | GLUCOSE | LIPID_PROFILE | LIVER_FUNCTION | KIDNEY_FUNCTION | THYROID | GENERAL_LAB | UNKNOWN
    document_quality: str = "ADEQUATE"  # GOOD | ADEQUATE | POOR | UNUSABLE
    extraction_confidence: str = "HIGH"  # HIGH | MEDIUM | LOW
    pages_processed: int = 1
    report_date: Optional[str] = None
    laboratory_name: Optional[str] = None
    patient_age: Optional[int] = None
    sex: Optional[str] = None
    tests: List[LabTestItem] = []
    abnormal_test_count: int = 0
    reported_critical_flag: bool = False
    identified_conditions: List[str] = []
    suggested_specialist: Optional[str] = "General Physician / Internal Medicine"
    next_steps: List[str] = []
    limitations: List[str] = [
        "Extracted lab values are for reference only and must be reviewed by a qualified healthcare professional."
    ]
    explanation: str = ""
    language: str = "English"
    suggested_specialty: str = "General Medicine"
    source: str = "AI_GEMINI_OCR"
