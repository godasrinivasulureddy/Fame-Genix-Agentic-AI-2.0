"""
FAME-GENIX Medical NLP Layer — app/symptoms/medical_nlp.py

Architecture:
  User text
    → normalize_medical_text()          # lowercase, unicode clean
    → classify_medical_context()        # negation / temporal / family context
    → extract_medical_concepts()        # phrase matching against FAME_VOCABULARY
    → MedicalNLPResult                  # structured evidence

This module NEVER sets risk_score, care_level, or emergency status.
It only normalises and categorises what the patient wrote.
The authoritative deterministic safety engine (fusion.py / rules.py) consumes
the structured result and makes all clinical decisions.

Backends (in priority order):
  1. medSpaCy — if installed, used for negation detection (negex) and
     contextual attribute handling.
  2. Pure-Python fallback — regex / window-based negation, fully self-contained,
     no external dependency required.

The FAME_VOCABULARY is intentionally curated and limited to conditions this
prototype explicitly supports.  Any term outside the vocabulary is mapped to
ContextType.UNMAPPED so Gemini can handle it cautiously.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import NamedTuple

# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class ContextType(str, Enum):
    ACTIVE_SYMPTOM        = "active_symptom"         # patient currently experiencing
    SELF_REPORTED_CONDITION = "self_reported_condition" # "I have X"
    POSSIBLE_CONCERN      = "possible_concern"        # "I think I might have X"
    NEGATED               = "negated"                 # "I don't have X"
    HISTORICAL            = "historical"              # "I had X years ago"
    FAMILY_HISTORY        = "family_history"          # "my father has X"
    UNMAPPED              = "unmapped"                # outside FAME vocabulary


class ClinicalCategory(str, Enum):
    NEUROLOGICAL  = "neurological"
    CARDIAC       = "cardiac"
    RESPIRATORY   = "respiratory"
    TRAUMA        = "trauma"
    RENAL         = "renal"
    METABOLIC     = "metabolic"
    INFECTION     = "infection"
    GASTROINTESTINAL = "gastrointestinal"
    ALLERGY       = "allergy"
    MUSCULOSKELETAL = "musculoskeletal"
    GENERAL       = "general"


# ---------------------------------------------------------------------------
# FAME-GENIX curated vocabulary
# ---------------------------------------------------------------------------

class VocabEntry(NamedTuple):
    normalized_name: str          # internal concept key (snake_case)
    display_name: str             # human-readable label
    category: ClinicalCategory
    # If True, the concept carries a potential red-flag when ACTIVE.
    # Does NOT mean it is automatically an emergency — context decides.
    is_red_flag_candidate: bool
    synonyms: list[str]           # all surface forms to match (lowercase)


FAME_VOCABULARY: list[VocabEntry] = [

    # ── Neurological ────────────────────────────────────────────────────────
    VocabEntry("loss_of_consciousness", "Loss of Consciousness",
               ClinicalCategory.NEUROLOGICAL, True,
               ["unconscious", "loss of consciousness", "passed out", "fainted",
                "fainting", "blacked out", "unresponsive"]),
    VocabEntry("seizure", "Seizure",
               ClinicalCategory.NEUROLOGICAL, True,
               ["seizure", "epileptic", "convulsion", "fits", "epilepsy"]),
    VocabEntry("confusion", "Confusion / Altered Mental State",
               ClinicalCategory.NEUROLOGICAL, True,
               ["confused", "confusion", "disoriented", "altered consciousness",
                "altered mental", "not making sense"]),
    VocabEntry("paralysis", "Paralysis / Inability to Move",
               ClinicalCategory.NEUROLOGICAL, True,
               ["paralysis", "paralysed", "paralyzed", "cannot move",
                "can't move", "unable to move", "immobile limb"]),
    VocabEntry("numbness", "Numbness / Tingling",
               ClinicalCategory.NEUROLOGICAL, True,
               ["numbness", "numb", "tingling", "pins and needles"]),
    VocabEntry("weakness", "Muscle Weakness",
               ClinicalCategory.NEUROLOGICAL, True,
               ["weakness", "weak", "limb weakness", "muscle weakness",
                "leg weakness", "arm weakness", "hand weakness"]),
    VocabEntry("severe_headache", "Severe Headache",
               ClinicalCategory.NEUROLOGICAL, True,
               ["severe headache", "worst headache", "thunderclap headache",
                "sudden headache", "excruciating headache"]),
    VocabEntry("headache", "Headache",
               ClinicalCategory.NEUROLOGICAL, False,
               ["headache", "head pain", "migraine", "head ache"]),
    VocabEntry("dizziness", "Dizziness / Lightheadedness",
               ClinicalCategory.NEUROLOGICAL, True,
               ["dizzy", "dizziness", "lightheaded", "light headed",
                "giddy", "vertigo"]),
    VocabEntry("stroke_symptoms", "Stroke Symptoms",
               ClinicalCategory.NEUROLOGICAL, True,
               ["stroke", "face drooping", "facial droop", "slurred speech",
                "arm drift", "sudden confusion", "sudden weakness"]),
    VocabEntry("head_trauma", "Head Trauma",
               ClinicalCategory.NEUROLOGICAL, True,
               ["head trauma", "head injury", "hit head", "hit my head",
                "head impact", "concussion"]),
    VocabEntry("spinal_injury", "Possible Spinal Injury",
               ClinicalCategory.NEUROLOGICAL, True,
               ["spinal cord injury", "spinal injury", "spine injury",
                "spinal_cord_injury", "spinal trauma", "suspected spinal",
                "injured my spine", "spine trauma"]),

    # ── Cardiac ─────────────────────────────────────────────────────────────
    VocabEntry("chest_pain", "Chest Pain / Pressure",
               ClinicalCategory.CARDIAC, True,
               ["chest pain", "chest pressure", "chest tightness",
                "chest discomfort", "tight chest", "pressure in chest"]),
    VocabEntry("heart_attack_symptoms", "Suspected Heart Attack",
               ClinicalCategory.CARDIAC, True,
               ["heart attack", "myocardial infarction", "mi "]),
    VocabEntry("heart_failure", "Reported Heart Failure",
               ClinicalCategory.CARDIAC, True,
               ["heart failure", "cardiac failure", "congestive heart"]),
    VocabEntry("palpitations", "Palpitations",
               ClinicalCategory.CARDIAC, False,
               ["palpitations", "heart racing", "racing heart",
                "irregular heartbeat", "heart flutter", "skipping beats",
                "fast heartbeat"]),

    # ── Respiratory ─────────────────────────────────────────────────────────
    VocabEntry("breathing_difficulty", "Breathing Difficulty",
               ClinicalCategory.RESPIRATORY, True,
               ["breathless", "breathing difficulty", "shortness of breath",
                "cant breathe", "can't breathe", "cannot breathe", "difficulty breathing",
                "gasping", "suffocating", "breathlessness"]),
    VocabEntry("choking", "Choking",
               ClinicalCategory.RESPIRATORY, True,
               ["choking", "choked", "airway obstruction", "food stuck in throat"]),
    VocabEntry("cough", "Cough",
               ClinicalCategory.RESPIRATORY, False,
               ["cough", "coughing", "productive cough", "dry cough"]),

    # ── Trauma ──────────────────────────────────────────────────────────────
    VocabEntry("major_trauma", "Major Trauma",
               ClinicalCategory.TRAUMA, True,
               ["major trauma", "serious accident", "vehicle accident",
                "car accident", "motorcycle accident", "fall from height",
                "road accident"]),
    VocabEntry("neck_trauma", "Neck / Cervical Trauma",
               ClinicalCategory.TRAUMA, True,
               ["neck trauma", "neck injury", "cervical trauma",
                "cervical injury", "neck pain after accident",
                "whiplash"]),
    VocabEntry("acute_bleeding", "Acute / Uncontrolled Bleeding",
               ClinicalCategory.TRAUMA, True,
               ["uncontrolled bleeding", "severe bleeding", "heavy bleeding",
                "bleeding out", "hemorrhage", "haemorrhage",
                "blood loss", "bleeding profusely"]),
    VocabEntry("bleeding", "Bleeding",
               ClinicalCategory.TRAUMA, False,
               ["bleeding", "bleed", "cut", "wound"]),
    VocabEntry("burn", "Severe Burns",
               ClinicalCategory.TRAUMA, True,
               ["severe burn", "severe burns", "third degree burn",
                "third-degree burn", "extensive burns"]),

    # ── Renal ────────────────────────────────────────────────────────────────
    VocabEntry("kidney_failure", "Reported Kidney Failure",
               ClinicalCategory.RENAL, True,
               ["kidney failure", "renal failure", "kidney_failure",
                "renal_failure", "end stage renal", "ckd stage 5"]),
    VocabEntry("blood_in_urine", "Blood in Urine",
               ClinicalCategory.RENAL, True,
               ["blood in urine", "haematuria", "hematuria",
                "red urine", "pink urine", "urine colour changes"]),
    VocabEntry("no_urination", "Reduced / No Urination",
               ClinicalCategory.RENAL, True,
               ["no urination", "not urinating", "cant urinate",
                "can't urinate", "unable to urinate", "reduced urine",
                "oliguria", "anuria"]),

    # ── Metabolic ────────────────────────────────────────────────────────────
    VocabEntry("hypoglycemia", "Severe Hypoglycaemia",
               ClinicalCategory.METABOLIC, True,
               ["hypoglycemia", "hypoglycaemia", "very low blood sugar",
                "blood sugar dropped", "sugar crash", "severe low sugar"]),
    VocabEntry("hyperglycemia", "Severe Hyperglycaemia",
               ClinicalCategory.METABOLIC, True,
               ["hyperglycemia", "hyperglycaemia", "very high blood sugar",
                "diabetic emergency", "blood sugar very high"]),

    # ── Infection ────────────────────────────────────────────────────────────
    VocabEntry("fever", "Fever",
               ClinicalCategory.INFECTION, False,
               ["fever", "temperature", "hot", "chills", "feverish",
                "high temperature", "high temp", "pyrexia"]),
    VocabEntry("sepsis_signs", "Sepsis Warning Signs",
               ClinicalCategory.INFECTION, True,
               ["sepsis", "blood poisoning", "septic shock",
                "high fever with confusion", "high fever and low blood pressure"]),

    # ── Gastrointestinal ─────────────────────────────────────────────────────
    VocabEntry("vomiting_blood", "Vomiting Blood",
               ClinicalCategory.GASTROINTESTINAL, True,
               ["vomiting blood", "throwing up blood", "hematemesis",
                "blood in vomit"]),
    VocabEntry("vomiting", "Vomiting / Nausea",
               ClinicalCategory.GASTROINTESTINAL, False,
               ["vomit", "vomiting", "throwing up", "nausea", "nauseous"]),
    VocabEntry("severe_abdominal_pain", "Severe Abdominal Pain",
               ClinicalCategory.GASTROINTESTINAL, True,
               ["severe abdominal pain", "severe stomach pain",
                "severe belly pain", "abdomen pain severe",
                "acute abdomen"]),
    VocabEntry("abdominal_pain", "Abdominal Pain",
               ClinicalCategory.GASTROINTESTINAL, False,
               ["abdominal pain", "stomach pain", "belly pain",
                "stomach ache", "tummy pain"]),

    # ── Allergy ──────────────────────────────────────────────────────────────
    VocabEntry("anaphylaxis", "Anaphylaxis / Severe Allergic Reaction",
               ClinicalCategory.ALLERGY, True,
               ["anaphylaxis", "anaphylactic", "severe allergic reaction",
                "throat swelling", "tongue swelling", "facial swelling",
                "eye swelling", "face swelling", "face is swelling", "allergy attack"]),
    VocabEntry("allergic_reaction", "Allergic Reaction",
               ClinicalCategory.ALLERGY, False,
               ["allergic reaction", "allergy", "rash", "hives", "itching",
                "skin rash", "skin spots"]),

    # ── Musculoskeletal ──────────────────────────────────────────────────────
    VocabEntry("back_pain", "Back Pain",
               ClinicalCategory.MUSCULOSKELETAL, False,
               ["back pain", "lower back", "backache", "lumbar pain",
                "lumbar", "spine pain", "spinal pain",
                "back ache", "back hurts", "back is hurting"]),
    VocabEntry("neck_pain", "Neck Pain",
               ClinicalCategory.MUSCULOSKELETAL, False,
               ["neck pain", "neck stiffness", "neck ache", "stiff neck",
                "neck hurts"]),
    VocabEntry("joint_pain", "Joint Pain",
               ClinicalCategory.MUSCULOSKELETAL, False,
               ["joint pain", "joint stiffness", "knee pain",
                "elbow pain", "arthritis"]),
    VocabEntry("muscle_pain", "Muscle Pain",
               ClinicalCategory.MUSCULOSKELETAL, False,
               ["muscle pain", "body ache", "muscle soreness",
                "myalgia", "muscle ache", "muscles ache"]),

    # ── General ──────────────────────────────────────────────────────────────
    VocabEntry("fatigue", "Fatigue / Weakness",
               ClinicalCategory.GENERAL, False,
               ["fatigue", "tired", "exhausted", "exhaustion",
                "weakness", "lethargic"]),
]


# ---------------------------------------------------------------------------
# Context classification patterns
# ---------------------------------------------------------------------------

# Family-context window keywords — if found near a medical term, classify as FAMILY_HISTORY
FAMILY_TERMS = re.compile(
    r"\b(father|mother|dad|mom|brother|sister|uncle|aunt|grandparent|grandfather"
    r"|grandmother|parent|sibling|family member|relative|cousin)\b",
    re.IGNORECASE,
)

# Historical-context cues — match "I had X three years ago", "past history of X"
HISTORICAL_TERMS = re.compile(
    r"\b(\d+\s+years? ago|\d+\s+months? ago|\d+\s+weeks? ago|years? ago|months? ago|"
    r"weeks? ago|ago|in the past|previously|history of|"
    r"used to have|had it before|recovered from|old|prior|past|former|childhood|"
    r"three years|two years|several years|many years)\b",
    re.IGNORECASE,
)

# Possibility / uncertainty cues
POSSIBLE_TERMS = re.compile(
    r"\b(i think|i believe|maybe|perhaps|possibly|might have|could have|"
    r"possibly have|suspect i have|concerned i|worried i might)\b",
    re.IGNORECASE,
)

# Negation window — look back up to 6 tokens before the medical term
NEGATION_TERMS = re.compile(
    r"\b(no|not|never|without|don't have|do not have|doesn't have|does not have|"
    r"denies|deny|denied|negative for|no history of|i don't|i do not|"
    r"haven't had|have not had|nor|absence of|ruled out|rule out)\b",
    re.IGNORECASE,
)

# Context window size in characters for prefix scanning
_WINDOW = 80


# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------

@dataclass
class ExtractedConcept:
    normalized_name: str
    display_name: str
    category: ClinicalCategory
    context: ContextType
    is_red_flag_candidate: bool
    matched_phrase: str             # the exact surface form that matched
    original_span: tuple[int, int]  # character offsets in original text


@dataclass
class MedicalNLPResult:
    raw_text: str
    active_red_flags: list[ExtractedConcept] = field(default_factory=list)
    active_symptoms: list[ExtractedConcept] = field(default_factory=list)
    self_reported_conditions: list[ExtractedConcept] = field(default_factory=list)
    possible_concerns: list[ExtractedConcept] = field(default_factory=list)
    negated: list[ExtractedConcept] = field(default_factory=list)
    historical: list[ExtractedConcept] = field(default_factory=list)
    family_history: list[ExtractedConcept] = field(default_factory=list)
    unmapped_fragments: list[str] = field(default_factory=list)

    def has_any_active(self) -> bool:
        return bool(self.active_red_flags or self.active_symptoms or
                    self.self_reported_conditions)

    # Convenience helpers consumed by safety_context builder
    def flag_active(self, normalized_name: str) -> bool:
        """Returns True if concept is active (non-negated, non-historical)."""
        for c in (self.active_red_flags + self.active_symptoms +
                  self.self_reported_conditions):
            if c.normalized_name == normalized_name:
                return True
        return False

    def flag_possibly(self, normalized_name: str) -> bool:
        return any(c.normalized_name == normalized_name for c in self.possible_concerns)


# ---------------------------------------------------------------------------
# Core extraction engine
# ---------------------------------------------------------------------------

def _classify_context(text: str, start: int, end: int) -> ContextType:
    """
    Determine whether a found span is active, negated, historical, family, or possible
    by scanning a window of text *before* the match (and a short suffix for family cues).
    The prefix is limited to the current sentence — we do not let negation or historical
    cues bleed across a full-stop sentence boundary.
    """
    # Restrict prefix to the current sentence (stop at the last period/exclamation/question)
    raw_prefix = text[max(0, start - _WINDOW): start]
    # Find last sentence-ending punctuation in the prefix window
    last_sent_end = max(
        raw_prefix.rfind('.'),
        raw_prefix.rfind('!'),
        raw_prefix.rfind('?'),
    )
    if last_sent_end >= 0:
        # Only use the fragment AFTER the last sentence boundary
        raw_prefix = raw_prefix[last_sent_end + 1:]
    prefix = raw_prefix.lower()
    suffix = text[end: end + 40].lower()
    surrounding = prefix + " " + suffix

    # Family history check — highest priority, overrides everything
    if FAMILY_TERMS.search(surrounding):
        return ContextType.FAMILY_HISTORY

    # Historical check
    if HISTORICAL_TERMS.search(surrounding):
        return ContextType.HISTORICAL

    # Negation check
    if NEGATION_TERMS.search(prefix):
        return ContextType.NEGATED

    # Possibility / uncertainty
    if POSSIBLE_TERMS.search(prefix):
        return ContextType.POSSIBLE_CONCERN

    return ContextType.ACTIVE_SYMPTOM


def _is_self_reported_condition(entry: VocabEntry, context: ContextType) -> ContextType:
    """
    Refine ACTIVE_SYMPTOM → SELF_REPORTED_CONDITION for terms that are diagnoses
    rather than experiential symptoms (e.g. "kidney failure", "heart failure").
    Only applies when context is already ACTIVE.
    """
    if context != ContextType.ACTIVE_SYMPTOM:
        return context
    # These normalized names represent reported diagnoses, not direct experiences
    CONDITION_NAMES = {
        "kidney_failure", "heart_failure", "stroke_symptoms", "heart_attack_symptoms",
        "spinal_injury", "sepsis_signs", "hypoglycemia", "hyperglycemia",
    }
    if entry.normalized_name in CONDITION_NAMES:
        return ContextType.SELF_REPORTED_CONDITION
    return context


def _try_medspacy(text: str) -> "dict | None":
    """
    Attempt medSpaCy-based extraction.  Returns a dict of
    {span_text: ContextType} if medSpaCy is available, else None.
    """
    try:
        import medspacy  # noqa: F401
        import spacy
        nlp = spacy.blank("en")
        nlp.add_pipe("medspacy_context")
        doc = nlp(text)
        result = {}
        for ent in doc.ents:
            if ent._.is_negated:
                result[ent.text.lower()] = ContextType.NEGATED
            elif ent._.is_historical:
                result[ent.text.lower()] = ContextType.HISTORICAL
            elif ent._.is_family:
                result[ent.text.lower()] = ContextType.FAMILY_HISTORY
            elif ent._.is_hypothetical:
                result[ent.text.lower()] = ContextType.POSSIBLE_CONCERN
            else:
                result[ent.text.lower()] = ContextType.ACTIVE_SYMPTOM
        return result
    except Exception:
        return None


def extract_medical_concepts(text: str) -> MedicalNLPResult:
    """
    Main entry point.  Returns a MedicalNLPResult with all concepts classified.

    Does NOT set risk scores or care levels.
    """
    result = MedicalNLPResult(raw_text=text)
    text_lower = text.lower()

    # Optional: medSpaCy context overrides (for known entity spans)
    _medspacy_context: "dict | None" = _try_medspacy(text)

    matched_spans: list[tuple[int, int]] = []   # to avoid double-counting

    for entry in FAME_VOCABULARY:
        for phrase in entry.synonyms:
            # Use word-boundary-aware search
            pattern = re.compile(
                r"(?<![a-z])" + re.escape(phrase) + r"(?![a-z])",
                re.IGNORECASE,
            )
            for m in pattern.finditer(text_lower):
                start, end = m.start(), m.end()

                # Skip if this span is already claimed by a longer match
                if any(s <= start and end <= e for s, e in matched_spans):
                    continue

                # Determine context
                context = _classify_context(text, start, end)

                # Override with medSpaCy if available and it matched this phrase
                if _medspacy_context and phrase in _medspacy_context:
                    context = _medspacy_context[phrase]

                # Refine active-symptom → self-reported condition where appropriate
                context = _is_self_reported_condition(entry, context)

                concept = ExtractedConcept(
                    normalized_name=entry.normalized_name,
                    display_name=entry.display_name,
                    category=entry.category,
                    context=context,
                    is_red_flag_candidate=entry.is_red_flag_candidate,
                    matched_phrase=m.group(),
                    original_span=(start, end),
                )

                matched_spans.append((start, end))

                if context == ContextType.NEGATED:
                    result.negated.append(concept)
                elif context == ContextType.HISTORICAL:
                    result.historical.append(concept)
                elif context == ContextType.FAMILY_HISTORY:
                    result.family_history.append(concept)
                elif context == ContextType.POSSIBLE_CONCERN:
                    result.possible_concerns.append(concept)
                elif context == ContextType.SELF_REPORTED_CONDITION:
                    result.self_reported_conditions.append(concept)
                elif context == ContextType.ACTIVE_SYMPTOM:
                    if entry.is_red_flag_candidate:
                        result.active_red_flags.append(concept)
                    else:
                        result.active_symptoms.append(concept)
                break  # first synonym match wins for this entry

    return result


# ---------------------------------------------------------------------------
# Safety-context builder (consumed by assessments/service.py)
# ---------------------------------------------------------------------------

def build_safety_flags(nlp_result: MedicalNLPResult) -> dict:
    """
    Convert a MedicalNLPResult into the boolean flags expected by
    app/risk/safety/rules.py evaluate_safety_rules().

    All flag decisions are deterministic and vocabulary-driven.
    This function NEVER calls an LLM.
    """
    f = nlp_result.flag_active  # shorthand

    neuro_trauma = (
        f("paralysis") or f("numbness") or f("weakness") or
        f("loss_of_consciousness") or f("confusion") or
        f("head_trauma") or f("neck_trauma")
    )

    # Trauma context: if major trauma co-occurs with spinal/neck/head concept,
    # escalate even if spinal_injury itself is not explicitly stated.
    major_trauma_with_spine = (
        f("major_trauma") and (f("spinal_injury") or f("neck_trauma") or f("head_trauma"))
    )
    neuro_trauma = neuro_trauma or major_trauma_with_spine

    # Co-occurrence: "accident" anywhere in text + spine/neck/head location in same text
    text_lower = nlp_result.raw_text.lower()
    _has_accident = any(kw in text_lower for kw in ["accident", "trauma", "crash", "fell", "fall"])
    _has_location = any(kw in text_lower for kw in ["neck", "head", "spine", "spinal", "back of"])
    if _has_accident and _has_location:
        neuro_trauma = True

    # Also screen free text for critical oncologic or severe organic alert keywords
    _has_oncology_or_organ_threat = any(
        kw in text_lower for kw in [
            "tumor", "tumour", "carcinoma", "neoplasm", "neoplastic", "cancer",
            "metastasis", "metastases", "dysphagia", "stricture", "malignan",
            "neuroendocrine"
        ]
    )

    serious_disease = (
        f("kidney_failure") or f("heart_failure") or
        f("seizure") or f("sepsis_signs") or
        f("hypoglycemia") or f("hyperglycemia") or
        f("stroke_symptoms") or f("spinal_injury") or
        nlp_result.flag_possibly("kidney_failure") or
        nlp_result.flag_possibly("heart_failure") or
        _has_oncology_or_organ_threat
    )

    return {
        "breathing_difficulty_reported": f("breathing_difficulty") or f("choking"),
        "chest_pain_severe":             f("chest_pain") or f("heart_attack_symptoms"),
        "dizziness_or_unconscious":      f("dizziness") or f("loss_of_consciousness"),
        "severe_bleeding_reported":      f("acute_bleeding"),
        "serious_disease_reported":      serious_disease,
        "neuro_trauma_reported":         neuro_trauma,
        "anaphylaxis_reported":          f("anaphylaxis"),
        "vomiting_blood_reported":       f("vomiting_blood"),
    }


# ---------------------------------------------------------------------------
# Display name helper (for frontend serialization)
# ---------------------------------------------------------------------------

DISPLAY_OVERRIDES: dict[str, str] = {
    entry.normalized_name: entry.display_name
    for entry in FAME_VOCABULARY
}


def concept_display_name(normalized_name: str, context: ContextType) -> str:
    """Human-readable label for a concept, prefixed by context qualifier."""
    base = DISPLAY_OVERRIDES.get(normalized_name, normalized_name.replace("_", " ").title())
    if context == ContextType.SELF_REPORTED_CONDITION:
        return f"Reported Concern: {base}"
    if context == ContextType.POSSIBLE_CONCERN:
        return f"Possible Concern: {base}"
    if context == ContextType.HISTORICAL:
        return f"Past History: {base}"
    if context == ContextType.FAMILY_HISTORY:
        return f"Family History: {base}"
    return base
