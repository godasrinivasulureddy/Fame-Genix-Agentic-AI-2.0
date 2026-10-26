"""
FAME-GENIX Medical NLP Regression Tests
tests/test_medical_nlp.py

Covers:
  - Synonyms and spelling variants
  - Negation handling
  - Family history isolation
  - Historical conditions
  - Trauma + neurological red flags
  - Cardiac symptoms
  - Respiratory symptoms
  - Bleeding
  - Unknown / unmapped terms
  - Integration with build_safety_flags()
  - Full assessment pipeline (risk consistency)
"""
import pytest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.models import Base
from app.db.models import SymptomSession, SymptomEntry
from app.assessments.service import run_assessment
from app.assessments.router import _serialize
from app.symptoms.medical_nlp import (
    extract_medical_concepts,
    build_safety_flags,
    ContextType,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def run_case(db, text: str, concepts: list[str] | None = None):
    """Helper: create a session + entries, run full assessment, return serialized result."""
    sess = SymptomSession(patient_id="nlp_test", raw_text=text)
    db.add(sess)
    db.commit()
    for c in (concepts or []):
        db.add(SymptomEntry(session_id=sess.id, concept=c, severity="mild"))
    db.commit()
    a = run_assessment(db, "nlp_test", sess.id)
    return _serialize(a, db)


# ---------------------------------------------------------------------------
# 1. Medical NLP unit tests — extract_medical_concepts()
# ---------------------------------------------------------------------------

class TestNegation:
    def test_i_do_not_have_kidney_failure(self):
        r = extract_medical_concepts("I do not have kidney failure.")
        assert r.flag_active("kidney_failure") is False
        assert any(c.context == ContextType.NEGATED for c in r.negated)

    def test_no_history_of_seizure(self):
        r = extract_medical_concepts("No history of seizure or fits.")
        assert r.flag_active("seizure") is False

    def test_did_not_injure_spine(self):
        r = extract_medical_concepts("I did not injure my spine. I only have mild muscle pain.")
        assert r.flag_active("spinal_injury") is False
        assert r.flag_active("muscle_pain") is True

    def test_dont_have_chest_pain(self):
        r = extract_medical_concepts("I don't have chest pain.")
        assert r.flag_active("chest_pain") is False

    def test_no_breathing_difficulty(self):
        r = extract_medical_concepts("No shortness of breath or breathing difficulty.")
        assert r.flag_active("breathing_difficulty") is False


class TestFamilyHistory:
    def test_father_has_kidney_failure(self):
        r = extract_medical_concepts("My father has kidney failure.")
        assert r.flag_active("kidney_failure") is False
        assert any(c.context == ContextType.FAMILY_HISTORY for c in r.family_history)

    def test_mother_has_heart_failure(self):
        r = extract_medical_concepts("My mother has heart failure but I feel fine.")
        assert r.flag_active("heart_failure") is False

    def test_sibling_has_seizures(self):
        r = extract_medical_concepts("My brother has seizures.")
        assert r.flag_active("seizure") is False


class TestHistorical:
    def test_spinal_injury_years_ago(self):
        r = extract_medical_concepts("I had a spinal cord injury three years ago but I feel fine today.")
        assert r.flag_active("spinal_injury") is False
        assert any(c.context == ContextType.HISTORICAL for c in r.historical)

    def test_kidney_failure_past_history(self):
        r = extract_medical_concepts("Past history of kidney failure, currently stable.")
        assert r.flag_active("kidney_failure") is False

    def test_recovered_from_stroke(self):
        r = extract_medical_concepts("I recovered from a stroke two years ago.")
        assert r.flag_active("stroke_symptoms") is False


class TestActiveRedFlags:
    def test_cannot_move_legs(self):
        r = extract_medical_concepts("I fell and now I cannot move my legs and they feel numb.")
        flags = build_safety_flags(r)
        assert flags["neuro_trauma_reported"] is True

    def test_accident_with_neck_pain(self):
        r = extract_medical_concepts("I had an accident and now I have severe neck and back pain.")
        flags = build_safety_flags(r)
        assert flags["neuro_trauma_reported"] is True

    def test_loss_of_consciousness(self):
        r = extract_medical_concepts("The patient is unconscious and unresponsive.")
        flags = build_safety_flags(r)
        assert flags["dizziness_or_unconscious"] is True

    def test_choking(self):
        r = extract_medical_concepts("I am choking on food and cannot breathe.")
        flags = build_safety_flags(r)
        assert flags["breathing_difficulty_reported"] is True

    def test_anaphylaxis(self):
        r = extract_medical_concepts("My tongue is swelling and I'm having a severe allergic reaction.")
        flags = build_safety_flags(r)
        assert flags["anaphylaxis_reported"] is True

    def test_vomiting_blood(self):
        r = extract_medical_concepts("I am vomiting blood.")
        flags = build_safety_flags(r)
        assert flags["vomiting_blood_reported"] is True

    def test_chest_pain(self):
        r = extract_medical_concepts("I have chest pain and pressure in my chest.")
        flags = build_safety_flags(r)
        assert flags["chest_pain_severe"] is True

    def test_severe_breathing_difficulty(self):
        r = extract_medical_concepts("I can't breathe properly, severe shortness of breath.")
        flags = build_safety_flags(r)
        assert flags["breathing_difficulty_reported"] is True


class TestSynonymsAndVariants:
    def test_breathlessness_synonym(self):
        r = extract_medical_concepts("I am breathless and feel like I'm suffocating.")
        assert r.flag_active("breathing_difficulty") is True

    def test_fainting_synonym(self):
        r = extract_medical_concepts("I started fainting and felt giddy.")
        assert r.flag_active("dizziness") is True

    def test_haematuria_synonym(self):
        r = extract_medical_concepts("I noticed haematuria this morning.")
        assert r.flag_active("blood_in_urine") is True

    def test_myalgia_synonym(self):
        r = extract_medical_concepts("I have myalgia all over my body.")
        assert r.flag_active("muscle_pain") is True

    def test_renal_failure_synonym(self):
        r = extract_medical_concepts("I have renal failure.")
        flags = build_safety_flags(r)
        assert flags["serious_disease_reported"] is True

    def test_migraine_as_headache(self):
        r = extract_medical_concepts("I have a migraine.")
        assert r.flag_active("headache") is True
        # Should NOT flag as red-flag
        assert not any(c.normalized_name == "severe_headache" for c in r.active_red_flags)


class TestContextualSeparation:
    def test_simple_backpain_not_spinal_injury(self):
        r = extract_medical_concepts("My lower back hurts after sitting for a long time.")
        assert r.flag_active("spinal_injury") is False

    def test_headache_not_head_trauma(self):
        r = extract_medical_concepts("I have a headache.")
        assert r.flag_active("head_trauma") is False
        assert r.flag_active("acute_bleeding") is False

    def test_bleeding_minor_not_uncontrolled(self):
        r = extract_medical_concepts("I have a small cut and it is bleeding a little.")
        flags = build_safety_flags(r)
        assert flags["severe_bleeding_reported"] is False


class TestPossibleConcern:
    def test_think_i_might_have_kidney_failure(self):
        r = extract_medical_concepts("I think I might have kidney failure.")
        assert r.flag_possibly("kidney_failure") is True
        assert r.flag_active("kidney_failure") is False

    def test_possibly_a_seizure(self):
        r = extract_medical_concepts("Perhaps I had a seizure, not sure.")
        assert r.flag_possibly("seizure") is True
        assert r.flag_active("seizure") is False


# ---------------------------------------------------------------------------
# 2. Integration tests — full assessment pipeline risk consistency
# ---------------------------------------------------------------------------

class TestRiskConsistency:
    def test_A_healthy_patient(self, db):
        r = run_case(db, "I feel healthy. No pain, fever, dizziness, weakness or breathing difficulty.")
        assert r["risk_score"] < 30, "Healthy patient should have low risk"
        assert r["care_level"] in ("STABLE", "MONITOR")

    def test_B_simple_backpain(self, db):
        r = run_case(db, "My lower back hurts after sitting for a long time.", ["back_pain"])
        assert r["risk_score"] < 50, "Simple back pain should not trigger high risk"
        assert r["care_level"] not in ("POSSIBLE_EMERGENCY", "EMERGENCY_DISPATCH")

    def test_C_headache_no_trauma(self, db):
        r = run_case(db, "I have a headache.", ["headache"])
        assert r["risk_score"] < 50, "Headache alone should not be high risk"
        assert r["care_level"] not in ("POSSIBLE_EMERGENCY", "EMERGENCY_DISPATCH")

    def test_D_trauma_with_neck_pain(self, db):
        r = run_case(db, "I had an accident and now I have severe neck and back pain.", ["back_pain", "neck_pain"])
        assert r["risk_score"] >= 40, "Trauma with neck pain should elevate risk"
        assert r["care_level"] not in ("STABLE",), "Should not be STABLE"

    def test_E_neuro_red_flag_cannot_move(self, db):
        r = run_case(db, "I fell and now I cannot move my legs and they feel numb.", ["paralysis", "numbness"])
        assert r["risk_score"] >= 60, "Neurological deficit after fall must produce high risk"
        assert r["care_level"] in ("URGENT", "POSSIBLE_EMERGENCY", "EMERGENCY_DISPATCH"), \
            f"Unexpected care level: {r['care_level']}"

    def test_F_historical_spinal_injury(self, db):
        r = run_case(db, "I had a spinal cord injury three years ago but I feel fine today.", ["spinal_cord_injury"])
        # Historical condition — should NOT produce POSSIBLE_EMERGENCY
        assert r["care_level"] not in ("POSSIBLE_EMERGENCY", "EMERGENCY_DISPATCH"), \
            "Historical condition should not trigger emergency dispatch"

    def test_G_negated_spine(self, db):
        r = run_case(db, "I did not injure my spine. I only have mild muscle pain.", ["muscle_pain"])
        assert r["risk_score"] < 50
        assert r["care_level"] not in ("POSSIBLE_EMERGENCY", "EMERGENCY_DISPATCH")

    def test_H_spinal_cord_injury_label(self, db):
        """Exact screenshot regression: 'spinal_cord_injury' alone should no longer give 0.01/STABLE."""
        r = run_case(db, "spinal_cord_injury", ["spinal_cord_injury"])
        # Must not be essentially zero risk
        assert r["risk_score"] > 5, f"spinal_cord_injury concept must not yield near-zero risk, got {r['risk_score']}"
        # Must not be simply STABLE
        assert r["care_level"] != "STABLE", f"spinal_cord_injury must not yield STABLE, got {r['care_level']}"
        # Display name must be human-readable
        names = [s["name"] for s in r["active_symptoms"]]
        assert not any("spinal_cord_injury" == n for n in names), \
            "Raw internal ID must not appear in active_symptoms display"

    def test_I_kidney_failure_label_and_risk(self, db):
        r = run_case(db, "I have kidney failure.", ["kidney_failure"])
        assert r["risk_score"] >= 30, "Self-reported serious condition must not yield near-zero risk"
        names = [s["name"] for s in r["active_symptoms"]]
        assert any("Kidney Failure" in n for n in names), "Display must include human-readable label"

    def test_J_anaphylaxis_is_emergency(self, db):
        r = run_case(db, "My tongue is swelling, severe allergic reaction, I cannot breathe.", ["anaphylaxis"])
        assert r["risk_score"] >= 60
        assert r["care_level"] in ("POSSIBLE_EMERGENCY", "EMERGENCY_DISPATCH", "URGENT")

    def test_K_vomiting_blood_emergency(self, db):
        r = run_case(db, "I am vomiting blood.", ["vomiting_blood"])
        assert r["risk_score"] >= 60
        assert r["care_level"] in ("POSSIBLE_EMERGENCY", "EMERGENCY_DISPATCH", "URGENT")

    def test_L_family_history_kidney_failure(self, db):
        r = run_case(db, "My father has kidney failure but I am feeling fine.", [])
        assert r["care_level"] not in ("POSSIBLE_EMERGENCY", "EMERGENCY_DISPATCH"), \
            "Family history of condition must not trigger patient emergency"
