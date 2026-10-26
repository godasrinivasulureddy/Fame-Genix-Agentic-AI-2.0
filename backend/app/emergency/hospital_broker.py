"""
FAME-GENIX Autonomous Regional Hospital & Resource Broker
Tracks metropolitan emergency departments, ICU bed capacity, Cath Lab readiness,
and calculates real-time patient routing to prevent emergency saturation and diverts.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class HospitalFacility(BaseModel):
    id: str
    name: str
    distance_km: float
    estimated_eta_min: int
    trauma_level: int = 1  # Level 1 Trauma Center, Level 2, etc.
    total_icu_beds: int
    available_icu_beds: int
    ventilators_available: int
    cath_lab_operational: bool
    stroke_team_ready: bool
    status: str = "NORMAL"  # NORMAL | WARNING | SATURATED | DIVERT


# Standard Regional Hospital Grid (Simulated Real-World Metropolitan Nodes)
METROPOLITAN_HOSPITAL_NETWORK: List[HospitalFacility] = [
    HospitalFacility(
        id="HOSP-APOLLO-MAIN",
        name="Apollo Super Specialty Emergency & Trauma Institute",
        distance_km=3.8,
        estimated_eta_min=9,
        trauma_level=1,
        total_icu_beds=32,
        available_icu_beds=5,
        ventilators_available=4,
        cath_lab_operational=True,
        stroke_team_ready=True,
        status="NORMAL"
    ),
    HospitalFacility(
        id="HOSP-CITY-CARE",
        name="City General Hospital Trauma Bay",
        distance_km=1.9,
        estimated_eta_min=5,
        trauma_level=2,
        total_icu_beds=18,
        available_icu_beds=0,
        ventilators_available=1,
        cath_lab_operational=False,
        stroke_team_ready=True,
        status="SATURATED"
    ),
    HospitalFacility(
        id="HOSP-AIIMS-METRO",
        name="AIIMS Apex Emergency Resuscitation Center",
        distance_km=6.4,
        estimated_eta_min=14,
        trauma_level=1,
        total_icu_beds=48,
        available_icu_beds=12,
        ventilators_available=8,
        cath_lab_operational=True,
        stroke_team_ready=True,
        status="NORMAL"
    ),
]


class HospitalAllocationBroker:
    """Evaluates hospital readiness vs transport time to select optimal emergency destination."""

    @staticmethod
    def get_network_status() -> List[Dict[str, Any]]:
        return [h.model_dump() for h in METROPOLITAN_HOSPITAL_NETWORK]

    @staticmethod
    def recommend_destination(
        clinical_urgency: str,
        suspected_condition: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Calculates optimal facility based on clinical needs (Cath Lab, Stroke, ICU)
        rather than blindly selecting the closest saturated hospital.
        """
        requires_cath_lab = "cardiac" in (suspected_condition or "").lower() or "chest" in (suspected_condition or "").lower() or "stemi" in (suspected_condition or "").lower()
        requires_stroke = "stroke" in (suspected_condition or "").lower() or "paralysis" in (suspected_condition or "").lower() or "neuro" in (suspected_condition or "").lower()

        candidate_hospitals = []
        for h in METROPOLITAN_HOSPITAL_NETWORK:
            if h.status == "DIVERT":
                continue
            # If cardiac emergency, must have cath lab
            if requires_cath_lab and not h.cath_lab_operational:
                continue
            # If acute stroke, must have active stroke team
            if requires_stroke and not h.stroke_team_ready:
                continue
            # If critical emergency, prefer non-zero ICU
            score = 100 - (h.estimated_eta_min * 3) + (h.available_icu_beds * 5)
            if h.available_icu_beds == 0:
                score -= 40
            candidate_hospitals.append((score, h))

        if not candidate_hospitals:
            # Fallback to nearest hospital
            best = min(METROPOLITAN_HOSPITAL_NETWORK, key=lambda x: x.estimated_eta_min)
            rationale = f"All specialized units constrained. Routing to closest facility: {best.name}."
        else:
            candidate_hospitals.sort(key=lambda x: x[0], reverse=True)
            best = candidate_hospitals[0][1]
            rationale = (
                f"Selected {best.name} (ETA: {best.estimated_eta_min} min, ICU beds available: {best.available_icu_beds}). "
                f"Avoided closer saturated facilities lacking immediate ICU or Cath Lab capability."
            )

        return {
            "recommended_hospital": best.model_dump(),
            "routing_rationale": rationale,
            "requires_cath_lab": requires_cath_lab,
            "requires_stroke_protocol": requires_stroke,
            "alternative_facilities": [h.model_dump() for h in METROPOLITAN_HOSPITAL_NETWORK if h.id != best.id]
        }


hospital_broker = HospitalAllocationBroker()
