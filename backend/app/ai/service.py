"""
Central Provider Abstraction for Gemini AI Integration in FAME GENIX.
Handles API key resolution, JSON schema parsing, safety guardrails, and deterministic fallbacks.
"""

import os
import json
import logging
from typing import Dict, Any, List

from app.core.config import settings
from app.symptoms.vocabulary import extract_concepts
from app.ai.prompts import (
    SYMPTOM_EXTRACTION_PROMPT,
    ASSESSMENT_EXPLANATION_PROMPT,
    CHAT_PROMPT,
    PATIENT_INSIGHT_PROMPT,
)
from app.ai.schemas import (
    AIStatusData,
    SymptomExtractRequest,
    SymptomExtractResponse,
    ExtractedSymptomItem,
    MissingInformationItem,
    AssessmentExplainRequest,
    AssessmentExplainResponse,
    AIChatRequest,
    AIChatResponse,
    PatientInsightRequest,
    PatientInsightResponse,
    SpecialistGuidance,
    SelfCareItem,
    FoodItem,
    FoodGuidance,
)
from app.ai.safety import (
    sanitize_input,
    map_suggested_specialty,
    enforce_high_risk_guidance,
)
from app.ai.exceptions import AIConfigError, AIProviderError

logger = logging.getLogger(__name__)


class AIService:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model_name = settings.GEMINI_MODEL
        self.enabled = settings.AI_ENABLED
        self._client = None
        
        # Nebius Token Factory & NVIDIA Models (T2.11 & T2.12)
        self.nebius_key = settings.NEBIUS_API_KEY
        self.nebius_base_url = settings.NEBIUS_BASE_URL
        self.nvidia_reasoning_model = settings.NVIDIA_MODEL_REASONING
        self.nvidia_fast_model = settings.NVIDIA_MODEL_FAST
        self._nebius_client = None

        if self.nebius_key and self.nebius_key.strip():
            try:
                from openai import OpenAI
                self._nebius_client = OpenAI(
                    base_url=self.nebius_base_url,
                    api_key=self.nebius_key,
                    timeout=float(settings.AI_TIMEOUT_SECONDS)
                )
                logger.info("[AIService] Nebius Token Factory OpenAI-compatible client initialized successfully.")
            except Exception as e:
                logger.warning(f"[AIService] Failed to initialize Nebius Token Factory client: {e}")
                self._nebius_client = None
        
        gemini_configured = bool(self.api_key and self.api_key.strip() and self.api_key != "your_gemini_api_key_here")
        openrouter_configured = bool(os.environ.get("OPENROUTER_API_KEY"))
        logger.info(f"Nebius Token Factory configured: {'YES' if self._nebius_client else 'NO'}")
        logger.info(f"Gemini key configured: {'YES' if gemini_configured else 'NO'}")
        logger.info(f"OpenRouter key configured: {'YES' if openrouter_configured else 'NO'}")

        if self.enabled and gemini_configured:
            try:
                from google import genai
                self._client = genai.Client(api_key=self.api_key)
            except Exception as exc:
                logger.warning(f"[AIService] Failed to initialize Gemini client: {exc}")
                self._client = None

    def _generate_with_failover(self, prompt: str) -> str:
        if not self.enabled:
            return ""

        # 1. Primary: Nebius Token Factory with NVIDIA Nemotron
        if self._nebius_client:
            for model_name in [self.nvidia_reasoning_model, self.nvidia_fast_model]:
                try:
                    response = self._nebius_client.chat.completions.create(
                        model=model_name,
                        messages=[{"role": "user", "content": prompt}],
                        temperature=0.2,
                        max_tokens=1500
                    )
                    content = response.choices[0].message.content or ""
                    if content:
                        logger.info(f"[AIService] AI provider: Nebius | Model: {model_name} | Status: success")
                        return content
                except Exception as e:
                    logger.warning(f"[AIService] AI provider: Nebius | Model: {model_name} | Attempt failed: {e}")

        # 2. Secondary: Google Gemini""
            
        models_to_try = [
            "gemini-2.5-flash",
            "gemini-3.6-flash",
            "gemini-3.5-flash",
            "gemini-3.1-flash-lite",
            "gemini-3.5-flash-lite"
        ]
        
        openrouter_key = os.environ.get("OPENROUTER_API_KEY")

        for model in models_to_try:
            try:
                # logger.info(f"[AIService] Attempting Gemini model: {model}")
                response = self._client.models.generate_content(
                    model=model,
                    contents=prompt,
                )
                logger.info(f"[AIService] AI provider: Gemini | AI model: {model} | Attempt: success")
                return response.text or ""
            except Exception as e:
                err_str = str(e)
                if "429" in err_str or "503" in err_str or "quota" in err_str.lower() or "RESOURCE_EXHAUSTED" in err_str or "UNAVAILABLE" in err_str or "not found" in err_str.lower() or "404" in err_str or "400" in err_str:
                    logger.warning(f"[AIService] AI provider: Gemini | AI model: {model} | Attempt: failure | Failover reason: RATE_LIMIT / SERVICE_UNAVAILABLE / MODEL_UNAVAILABLE")
                    continue
                else:
                    logger.warning(f"[AIService] AI provider: Gemini | AI model: {model} | Attempt: failure | Failover reason: {err_str}")
                    continue

        if openrouter_key:
            try:
                import requests
                headers = {
                    "Authorization": f"Bearer {openrouter_key}",
                    "HTTP-Referer": "http://localhost:8000",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": "google/gemini-2.5-flash",
                    "messages": [{"role": "user", "content": prompt}]
                }
                res = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload, timeout=10)
                if res.status_code == 200:
                    data = res.json()
                    logger.info("[AIService] AI provider: OpenRouter | AI model: google/gemini-2.5-flash | Attempt: success")
                    return data["choices"][0]["message"]["content"]
                else:
                    logger.warning(f"[AIService] AI provider: OpenRouter | Attempt: failure | Failover reason: HTTP {res.status_code}")
            except Exception as e:
                logger.warning(f"[AIService] AI provider: OpenRouter | Attempt: failure | Failover reason: {e}")
                
        return ""

    def status(self) -> AIStatusData:
        is_configured = bool(self.api_key and self.api_key.strip() and self.api_key != "your_gemini_api_key_here")
        is_reachable = bool(self._client is not None)
        return AIStatusData(
            enabled=self.enabled,
            provider="Gemini",
            configured=is_configured,
            reachable=is_reachable,
            model=self.model_name,
        )

    async def extract_symptoms(self, req: SymptomExtractRequest) -> SymptomExtractResponse:
        sanitized = sanitize_input(req.text)
        
        # Fallback if AI disabled or client unconfigured
        if not self._client or not self.enabled:
            return self._deterministic_symptom_fallback(sanitized)

        try:
            prompt = f"{SYMPTOM_EXTRACTION_PROMPT}\n\nUSER INPUT TEXT:\n{sanitized}"
            raw_text = self._generate_with_failover(prompt)
            if not raw_text:
                raise AIProviderError("All models failed")
            
            # Parse JSON from response
            json_str = raw_text.strip()
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0].strip()
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0].strip()

            parsed = json.loads(json_str)
            symptoms = [
                ExtractedSymptomItem(
                    name=s.get("name", "unknown"),
                    severity=s.get("severity"),
                    duration_hours=s.get("duration_hours"),
                )
                for s in parsed.get("symptoms", [])
            ]

            return SymptomExtractResponse(
                original_text=sanitized,
                detected_language=parsed.get("detected_language", "English"),
                symptoms=symptoms,
                red_flag_phrases=parsed.get("red_flag_phrases", []),
                missing_information=parsed.get("missing_information", []),
                source="AI_GEMINI",
            )
        except Exception as exc:
            logger.error(f"[AIService] Symptom extraction failed, using fallback: {exc}")
            return self._deterministic_symptom_fallback(sanitized)

    async def explain_assessment(self, req: AssessmentExplainRequest) -> AssessmentExplainResponse:
        specialty = map_suggested_specialty(req.top_factors, [])
        requires_review = req.care_level in ["PRIORITY_REVIEW", "URGENT", "POSSIBLE_EMERGENCY"]
        safety_level = "URGENT" if req.care_level in ["URGENT", "POSSIBLE_EMERGENCY"] else "NORMAL"

        if not self._client or not self.enabled:
            return self._deterministic_explanation_fallback(req, specialty, safety_level, requires_review)

        try:
            notes_str = "; ".join(req.health_notes) if req.health_notes else "No recent health notes recorded"
            profile_str = req.patient_profile or "General Baseline Profile"
            prompt = ASSESSMENT_EXPLANATION_PROMPT.format(
                risk_score=req.risk_score,
                confidence_score=req.confidence_score,
                care_level=req.care_level,
                top_factors=", ".join(req.top_factors) if req.top_factors else "None reported",
                language=req.language,
                patient_profile=profile_str,
                health_notes=notes_str,
            )
            explanation_text = self._generate_with_failover(prompt).strip()
            if not explanation_text:
                raise AIProviderError("All models failed")
            explanation_text = enforce_high_risk_guidance(req.care_level, explanation_text)

            return AssessmentExplainResponse(
                explanation=explanation_text,
                language=req.language,
                suggested_specialty=specialty,
                safety_level=safety_level,
                requires_professional_review=requires_review,
                source="AI_GEMINI",
            )
        except Exception as exc:
            logger.error(f"[AIService] Assessment explanation failed, using fallback: {exc}")
            return self._deterministic_explanation_fallback(req, specialty, safety_level, requires_review)

    async def chat(self, req: AIChatRequest) -> AIChatResponse:
        sanitized_msg = sanitize_input(req.message)
        specialty = map_suggested_specialty(req.top_factors or [], [])
        requires_review = req.care_level in ["PRIORITY_REVIEW", "URGENT", "POSSIBLE_EMERGENCY"]
        safety_level = "URGENT" if req.care_level in ["URGENT", "POSSIBLE_EMERGENCY"] else "NORMAL"

        # Format conversation history transcript for multi-turn context memory
        history_transcript = ""
        if req.history:
            history_transcript = "\n--- PREVIOUS CONVERSATION HISTORY ---\n"
            for h in req.history[-10:]:  # Last 10 turns for token efficiency
                sender = "PATIENT" if h.get("role") in ["user", "patient"] else "Fame Genix Health Care Assistant"
                history_transcript += f"{sender}: {h.get('text', '')}\n"
            history_transcript += "--- END HISTORY ---\n\n"

        if not self._client or not self.enabled:
            logger.warning("[AIService] Gemini client is not initialized or AI is disabled.")
            conversational_reply = "AI service is temporarily unavailable. Your health assessment tools are still available, but I cannot generate a personalized AI response right now."
            return AIChatResponse(
                message=conversational_reply,
                language=req.language or "English",
                suggested_specialty=specialty,
                safety_level=safety_level,
                requires_professional_review=requires_review,
            )

        try:
            logger.info(f"[AIService] Attempting actual generation with model {self.model_name}. Gemini configured: YES.")
            notes_str = "; ".join(req.health_notes) if req.health_notes else "No recent health notes"
            profile_str = req.patient_profile or "General Baseline Profile"
            prompt = CHAT_PROMPT.format(
                care_level=req.care_level,
                risk_score=req.risk_score,
                top_factors=", ".join(req.top_factors) if req.top_factors else "None",
                patient_profile=profile_str,
                health_notes=notes_str,
            ) + f"\n\n{history_transcript}CURRENT PATIENT USER QUESTION: {sanitized_msg}"

            reply = self._generate_with_failover(prompt).strip()
            if not reply:
                raise AIProviderError("All models failed")
            reply = enforce_high_risk_guidance(req.care_level or "STABLE", reply)
            logger.info("[AIService] Gemini actual response returned: YES. Fallback activated: NO.")

            return AIChatResponse(
                message=reply,
                language=req.language or "English",
                suggested_specialty=specialty,
                safety_level=safety_level,
                requires_professional_review=requires_review,
            )
        except Exception as exc:
            logger.error(f"[AIService] Actual generation attempted: YES. Actual Gemini response returned: NO. Failure category: {type(exc).__name__}. Fallback activated: YES. Error details: {exc}")
            conversational_reply = "AI service is temporarily unavailable. Your health assessment tools are still available, but I cannot generate a personalized AI response right now."
            return AIChatResponse(
                message=conversational_reply,
                language=req.language or "English",
                suggested_specialty=specialty,
                safety_level=safety_level,
                requires_professional_review=requires_review,
            )

    def _generate_conversational_ai_fallback(self, msg: str, history: List[Dict[str, Any]] = None) -> str:
        text_lower = str(msg).lower().strip()

        # Specific intent parsing matching ChatGPT & Google Gemini quality
        if any(kw in text_lower for kw in ["eye", "eyes", "eyesight", "vision", "sight"]) and any(kw in text_lower for kw in ["bulk", "bulking", "weight gain", "get body weight", "gain weight"]):
            return (
                "Here are specific clinical nutrition recommendations for **Eyesight Improvement & Healthy Body Bulking/Weight Gain**:\n\n"
                "👁️ **Foods for Eyesight & Visual Health**:\n"
                "• **Carrots, Sweet Potatoes & Pumpkin**: Rich in Beta-Carotene & Vitamin A for night vision and corneal protection.\n"
                "• **Spinach, Kale & Broccoli**: High in Lutein & Zeaxanthin to shield eyes from blue light and macular degeneration.\n"
                "• **Eggs & Citrus Fruits**: Deliver Vitamin C, Vitamin E & Zinc to protect retinal cells.\n"
                "• **Salmon & Walnuts**: Packed with Omega-3 fatty acids to relieve dry eye syndrome.\n\n"
                "💪 **Foods for Healthy Body Bulking & Caloric Surplus**:\n"
                "• **High-Calorie Dense Proteins**: Whole eggs, chicken breast, salmon, cottage cheese (paneer), and lean beef.\n"
                "• **Complex Carbs**: Oats, brown rice, sweet potatoes, bananas, and whole-wheat bread.\n"
                "• **Healthy Dense Fats**: Peanut butter, almonds, walnuts, avocados, and full-fat Greek yogurt.\n"
                "• **Bulking Shake Idea**: Blend 1 cup oats, 2 tbsp peanut butter, 1 banana, 1 scoop whey/protein, and 300ml whole milk (600+ kcal)."
            )

        if "10 lines" in text_lower or "ten lines" in text_lower:
            return (
                "Here are 10 key clinical facts about healthy food and daily nutrition:\n\n"
                "1. **Cellular Repair**: Healthy food provides essential amino acids required for tissue building and cellular repair.\n"
                "2. **Immunity Boost**: Green leafy vegetables deliver Vitamin C, Iron, and Folate to strengthen white blood cell defense.\n"
                "3. **Sustained Energy**: Whole grains like oats and brown rice digest slowly, providing steady glucose without spikes.\n"
                "4. **Cardiovascular Health**: Omega-3 fatty acids in nuts and seeds maintain clear arterial walls and reduce cholesterol.\n"
                "5. **Digestive Function**: Dietary fiber from fruits and legumes regulates intestinal peristalsis and prevents constipation.\n"
                "6. **Bone Density**: Calcium and Vitamin D from dairy or fortified plants preserve skeletal bone mineral density.\n"
                "7. **Metabolic Balance**: Minimizing refined sugars reduces insulin resistance and systemic inflammation.\n"
                "8. **Gut Microbiome**: Fermented foods like yogurt and kefir feed beneficial probiotic gut bacteria.\n"
                "9. **Hydration Support**: Water-dense foods like cucumbers and watermelon aid renal filtration and skin turgor.\n"
                "10. **Mental Clarity**: Balanced nutrition optimizes neurotransmitter synthesis, improving focus and sleep quality."
            )

        if any(kw in text_lower for kw in ["protein", "fiber", "fibre", "protein rich"]):
            return (
                "Here is a detailed breakdown of **Protein-Rich** and **Fiber-Rich** foods:\n\n"
                "🍗 **High Protein Foods (For Muscle Repair & Metabolism)**:\n"
                "• **Chicken Breast**: ~31g protein per 100g.\n"
                "• **Eggs**: ~6g high-bioavailability protein per large egg.\n"
                "• **Greek Yogurt / Cottage Cheese (Paneer)**: ~10–18g protein per 100g.\n"
                "• **Lentils, Chickpeas & Dal**: ~18g protein per cooked cup.\n"
                "• **Tofu & Tempeh**: ~15–20g plant protein per 100g.\n\n"
                "🌾 **High Fiber Foods (For Gut Microbiome & Digestion)**:\n"
                "• **Chia Seeds**: ~10g fiber per ounce (2 tbsp).\n"
                "• **Oats & Oatmeal**: ~10g dietary fiber per cup.\n"
                "• **Lentils & Black Beans**: ~15g fiber per cooked cup.\n"
                "• **Apples, Berries & Pears**: ~4–8g soluble fiber per serving.\n"
                "• **Almonds & Pumpkin Seeds**: ~3.5g fiber per 30g serving."
            )

        if any(kw in text_lower for kw in ["sleep", "sleeping", "insomnia", "bedtime", "sleep early"]):
            return (
                "Here are 5 proven medical health tips for early, restorative sleep:\n\n"
                "🌙 **1. Consistent Bedtime Schedule**: Go to bed and wake up at the exact same time every day—even on weekends—to synchronize your circadian rhythm.\n\n"
                "📱 **2. Digital Detox (1 Hour Before Bed)**: Turn off smartphones, TVs, and laptops at least 60 minutes before sleep. Blue light suppresses melatonin production, delaying your sleep onset.\n\n"
                "☕ **3. Cutoff Evening Caffeine & Heavy Meals**: Avoid caffeine after 2:00 PM. Keep dinner light and finish eating at least 2–3 hours before lying down.\n\n"
                "🌡️ **4. Optimize Your Sleep Sanctuary**: Keep your bedroom cool (around 18–20°C / 65–68°F), dark, and quiet.\n\n"
                "🧘 **5. Wind-Down Relaxation Routine**: Try 5 minutes of 4-7-8 deep breathing, a warm bath, or reading a physical book to signal to your nervous system that it is time to sleep."
            )

        if any(kw in text_lower for kw in ["healthy", "fine", "good", "great", "well", "fit", "no symptoms"]):
            return "That's wonderful to hear! I'm glad you're feeling healthy and well. 😊 I am keeping your baseline Health Stability Index at optimal levels in the background. If you ever experience any symptoms, have wellness questions, or want to upload routine lab reports in the future, I am always here for you. Stay healthy!"

        return f"Hello! I am Fame Genix Health Care Assistant. I received your message: \"{msg}\". How can I assist you further with your health evaluation, dietary advice, sleep tips, or medical reports today?"

    def _deterministic_symptom_fallback(self, text: str) -> SymptomExtractResponse:
        found_concepts = extract_concepts(text)
        symptoms = [ExtractedSymptomItem(name=c, severity=None, duration_hours=None) for c in found_concepts]
        
        red_flags = [c for c in found_concepts if c in ["chest_pain", "breathing_difficulty", "bleeding", "dizziness"]]
        
        missing = []
        c_set = set(found_concepts)
        raw_lower = text.lower()
        
        # Check for explicit trauma and explicit bleeding using regex word boundaries
        import re
        has_trauma = bool(re.search(r'\b(trauma|accident|hit my head|fall|fell|car crash|head injury)\b', raw_lower))
        has_bleeding = bool(re.search(r'\b(bleed|bleeding|blood|hemorrhage|laceration|wound)\b', raw_lower))
        
        if has_trauma or has_bleeding:
            if has_trauma:
                missing.extend([
                    MissingInformationItem(question="Did you lose consciousness, experience dizziness, or suffer memory loss during or after the impact?", reason="Neurological assessment"),
                    MissingInformationItem(question="Is there active neck pain, spinal tenderness, or numbness/tingling in your limbs?", reason="Spinal cord assessment"),
                    MissingInformationItem(question="Are you experiencing nausea, blurred vision, or vomiting following the injury?", reason="Concussion screening")
                ])
                if "head_trauma" not in c_set and bool(re.search(r'\b(hit my head|head injury|head trauma)\b', raw_lower)):
                    found_concepts.append("head_trauma")
                    red_flags.append("head_impact_trauma")
            if has_bleeding:
                if "acute_bleeding" not in c_set and bool(re.search(r'\b(heavy bleeding|uncontrolled bleeding|profuse bleeding|bleeding out|blood loss)\b', raw_lower)):
                    found_concepts.append("acute_bleeding")
                    red_flags.append("active_bleeding")
            symptoms = [ExtractedSymptomItem(name=c, severity="severe" if c in ["head_trauma", "acute_bleeding", "chest_pain", "breathing_difficulty", "dizziness"] else None, duration_hours=None) for c in found_concepts]
        elif "back_pain" in c_set or any(kw in raw_lower for kw in ["back", "spine", "lumbar", "backache"]):
            missing = [
                MissingInformationItem(question="How long have you experienced lower back or spinal discomfort (in hours, days, or weeks)?", reason="Chronicity assessment"),
                MissingInformationItem(question="Does the back pain radiate down into your legs or cause numbness/tingling?", reason="Nerve root involvement"),
                MissingInformationItem(question="Is the pain aggravated by bending, sitting, standing, or walking?", reason="Mechanical factor assessment")
            ]
        elif "chest_pain" in c_set or any(kw in raw_lower for kw in ["chest", "heart", "cardiac"]):
            missing = [
                MissingInformationItem(question="Is the chest pressure radiating to your arm, neck, or jaw?", reason="Cardiac ischemia screening"),
                MissingInformationItem(question="Are you experiencing sweating, shortness of breath, or nausea?", reason="Associated autonomic symptoms"),
                MissingInformationItem(question="How long ago did the chest discomfort begin?", reason="Onset timing")
            ]
        elif "breathing_difficulty" in c_set or any(kw in raw_lower for kw in ["breath", "wheez"]):
            missing = [
                MissingInformationItem(question="Is the breathlessness present at rest or during exertion?", reason="Severity assessment"),
                MissingInformationItem(question="Do you hear wheezing or feel chest tightness?", reason="Airway restriction screening")
            ]
        elif "headache" in c_set or "migraine" in raw_lower:
            missing = [
                MissingInformationItem(question="Is the headache severe, throbbing, or sudden-onset?", reason="Acuity screening"),
                MissingInformationItem(question="Do you have dizziness, nausea, or vision changes?", reason="Neurological screening")
            ]
        elif "fever" in c_set or "temp" in raw_lower:
            missing = [
                MissingInformationItem(question="How long have you had the fever (in hours or days)?", reason="Duration tracking"),
                MissingInformationItem(question="Is the fever mild, moderate, or severe?", reason="Severity tracking"),
                MissingInformationItem(question="Do you also have shivering, chills, or sweating?", reason="Associated systemic symptoms")
            ]
        else:
            missing = [
                MissingInformationItem(question="How long have you been experiencing these health symptoms?", reason="General chronicity"),
                MissingInformationItem(question="Are your symptoms worsening, staying constant, or improving?", reason="Trajectory assessment")
            ]

        return SymptomExtractResponse(
            original_text=text,
            detected_language="English",
            symptoms=symptoms,
            red_flag_phrases=red_flags,
            missing_information=missing,
            source="DETERMINISTIC_FALLBACK",
        )

    def _deterministic_explanation_fallback(
        self, req: AssessmentExplainRequest, specialty: str, safety_level: str, requires_review: bool
    ) -> AssessmentExplainResponse:
        factors = ", ".join(req.top_factors) if req.top_factors else "general vitals monitoring"
        
        bullets = [
            f"• [Triage Evaluation]: Calculated risk score is {req.risk_score}% with a care level of '{req.care_level}'.",
            f"• [Triggering Factors]: Clinical indicators identify {factors} as key risk drivers.",
        ]
        
        if req.care_level in ["URGENT", "POSSIBLE_EMERGENCY"]:
            bullets.append(f"• [Specialty Routing]: Immediate emergency evaluation is advised. Consult a {specialty} specialist once stable.")
            bullets.append("• [Safety Action]: Critical thresholds breached. Do not rely on self-monitoring or home treatments.")
        else:
            bullets.append(f"• [Specialty Routing]: Professional evaluation by a {specialty} specialist is suggested if symptoms persist.")
            bullets.append("• [Safety Action]: Continue self-monitoring and record baseline vitals twice daily.")
            
        bullets.append("• [Info Source]: Note that this summary is a deterministic fallback calculated from database parameters (Gemini unavailable).")
        
        explanation = "\n".join(bullets)

        return AssessmentExplainResponse(
            explanation=explanation,
            language=req.language,
            suggested_specialty=specialty,
            safety_level=safety_level,
            requires_professional_review=requires_review,
            source="DETERMINISTIC_FALLBACK",
        )

    async def generate_patient_insight(self, req: PatientInsightRequest) -> PatientInsightResponse:
        specialty_name = map_suggested_specialty(req.top_factors, req.concepts)

        if not self._client or not self.enabled:
            return self._deterministic_insight_fallback(req, specialty_name)

        try:
            notes_str = "; ".join(req.health_notes) if req.health_notes else "None"
            profile_str = req.patient_profile or "General Baseline Profile"
            answers_str = "; ".join(req.followup_answers) if req.followup_answers else "None"

            prompt = PATIENT_INSIGHT_PROMPT.format(
                risk_score=req.risk_score,
                confidence_score=req.confidence_score,
                care_level=req.care_level,
                top_factors=", ".join(req.top_factors) if req.top_factors else "symptom input",
                symptom_text=req.symptom_text or "General health assessment",
                concepts=", ".join(req.concepts) if req.concepts else "general",
                followup_answers=answers_str,
                patient_profile=profile_str,
                health_notes=notes_str,
                lab_summary=req.lab_summary or "None",
                language=req.language or "en",
            )

            raw_text = self._generate_with_failover(prompt).strip()
            if not raw_text:
                raise AIProviderError("All models failed")

            json_str = raw_text
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0].strip()
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0].strip()

            parsed = json.loads(json_str)

            is_urgent = req.care_level in ["URGENT", "POSSIBLE_EMERGENCY"]
            self_care_list = []
            if is_urgent:
                self_care_list = [
                    SelfCareItem(
                        title="Seek Immediate Medical Care",
                        description="Your assessment indicates urgent health indicators. Rest in a comfortable position and seek prompt clinical evaluation."
                    )
                ]
            else:
                self_care_list = [
                    SelfCareItem(title=item.get("title", "Rest"), description=item.get("description", "Rest adequately."))
                    for item in parsed.get("self_care", [])
                ]

            food_rec = []
            food_lim = []
            if not is_urgent:
                fg = parsed.get("food_guidance", {})
                food_rec = [FoodItem(title=item.get("title", "Hydrating Liquids"), reason=item.get("reason", "Maintains hydration.")) for item in fg.get("recommended", [])]
                food_lim = [FoodItem(title=item.get("title", "Heavy Meals"), reason=item.get("reason", "May strain digestion.")) for item in fg.get("limit", [])]
            else:
                food_rec = [FoodItem(title="Clear Hydrating Liquids", reason="Small sips of water only if conscious.")]
                food_lim = [FoodItem(title="Solid Foods & Caffeine", reason="Avoid heavy meals, solid food, or caffeine during emergency care.")]

            spec = parsed.get("specialist", {})
            spec_name = spec.get("specialty") or specialty_name
            spec_reason = spec.get("reason") or f"Recommended based on {', '.join(req.concepts) or 'symptoms'}."

            return PatientInsightResponse(
                explanation=enforce_high_risk_guidance(req.care_level, parsed.get("explanation", "")),
                possible_patterns=parsed.get("possible_patterns", ["Symptom pattern requiring clinical evaluation"]),
                specialist=SpecialistGuidance(specialty=spec_name, reason=spec_reason),
                self_care=self_care_list,
                food_guidance=FoodGuidance(recommended=food_rec, limit=food_lim),
                source="AI_GEMINI",
            )
        except Exception as exc:
            logger.error(f"[AIService] Patient Insight generation failed, using fallback: {exc}")
            return self._deterministic_insight_fallback(req, specialty_name)

    def _deterministic_insight_fallback(self, req: PatientInsightRequest, specialty: str) -> PatientInsightResponse:
        is_urgent = req.care_level in ["URGENT", "POSSIBLE_EMERGENCY"]
        reported = req.symptom_text or "No symptoms explicitly reported."
        active_concepts = ", ".join(req.concepts) if req.concepts else "None"
        explanation_text = f"**Clinical Overview**\n\n- **Reported Symptoms**: {reported}\n- **Active Findings**: {active_concepts}\n- **Risk Evaluation**: Score of {req.risk_score}/100 indicates {req.care_level}.\n- **Next Action**: {req.care_level} protocol applies."
        explanation = enforce_high_risk_guidance(
            req.care_level,
            explanation_text
        )

        patterns = []
        c_set = set(req.concepts)
        if "chest_pain" in c_set:
            patterns.append("Acute Cardiovascular / Ischemic Pattern")
        elif "breathing_difficulty" in c_set:
            patterns.append("Lower / Upper Respiratory Compromise Pattern")
        elif "fever" in c_set:
            patterns.append("Systemic Febrile / Inflammatory Response")
        elif "vomiting" in c_set:
            patterns.append("Gastrointestinal Mucosal Irritation")
        elif "headache" in c_set or "dizziness" in c_set:
            patterns.append("Neuro-Vascular / Cranial Pressure Pattern")
        else:
            patterns.append("General Physiological Symptom Pattern")

        if is_urgent:
            self_care = [
                SelfCareItem(
                    title="Seek Immediate Medical Care",
                    description="Your current assessment shows elevated risk indicators. Avoid physical exertion and seek prompt medical evaluation."
                )
            ]
            food_rec = [FoodItem(title="Pure Water (Small Sips)", reason="Maintains hydration during emergency evaluation.")]
            food_lim = [FoodItem(title="Heavy Foods & Caffeine", reason="Restricts gastrointestinal strain during acute care.")]
        elif "back_pain" in c_set:
            self_care = [
                SelfCareItem(title="Posture Awareness & Rest", description="Maintain proper lumbar support when sitting. Avoid heavy lifting or bending."),
                SelfCareItem(title="Gentle Stretches", description="Do not remain completely bedridden; perform very gentle, non-straining stretches to ease muscle tension.")
            ]
            food_rec = [
                FoodItem(title="Calcium & Vitamin D Rich Foods", reason="Dairy, leafy greens, and fortified milks support bone mineral density."),
                FoodItem(title="Anti-inflammatory Proteins", reason="Lean proteins like salmon (rich in omega-3s) help repair muscle tissue strain.")
            ]
            food_lim = [
                FoodItem(title="Refined Sugars & Pastries", reason="High sugar foods can increase blood glucose and systemic inflammation.")
            ]
        elif "breathing_difficulty" in c_set:
            self_care = [
                SelfCareItem(title="Airway Elevation", description="Keep your head elevated with extra pillows during sleep or rest to ease breathing."),
                SelfCareItem(title="Steam Inhalation", description="Perform warm steam inhalation for 5-10 minutes to clear congested bronchial tracts.")
            ]
            food_rec = [
                FoodItem(title="Warm Honey & Ginger Water", reason="Soothes the bronchial lining and helps clear respiratory tract mucus."),
                FoodItem(title="Vitamin C Citrus Fruits", reason="Boosts white blood cell response and supports overall immune defenses.")
            ]
            food_lim = [
                FoodItem(title="Refrigerated Beverages & Cold Dairy", reason="Cold temperature liquids can provoke acute bronchospasms in sensitive airways.")
            ]
        elif "fever" in c_set:
            self_care = [
                SelfCareItem(title="Lukewarm Damp Compress", description="Apply to the forehead or neck area to safely assist thermal regulation."),
                SelfCareItem(title="Regular Temperature Monitoring", description="Track and log body temperature readings every 4 hours.")
            ]
            food_rec = [
                FoodItem(title="Electrolyte Rehydration Drinks", reason="Restores trace mineral salts lost through sweat-induced dehydration."),
                FoodItem(title="Clear Vegetable Broth & Soups", reason="Provides gentle, easily digestible energy and replenishes fluids.")
            ]
            food_lim = [
                FoodItem(title="Spicy & Heavy Fatty Foods", reason="Increases metabolic digestive strain when the body needs rest.")
            ]
        elif "headache" in c_set or "dizziness" in c_set:
            self_care = [
                SelfCareItem(title="Quiet Dark Room Rest", description="Rest in a dim, silent environment to relax vascular cranial tension."),
                SelfCareItem(title="Cold Temples Compress", description="Apply cold compress to temples or neck to restrict dilated painful vessels.")
            ]
            food_rec = [
                FoodItem(title="Magnesium-rich Leafy Greens & Nuts", reason="Helps regulate neuromuscular signaling and vasodilation."),
                FoodItem(title="Clean Water Hydration", reason="Dehydration is a primary trigger for vascular tension headaches.")
            ]
            food_lim = [
                FoodItem(title="Excessive Caffeine & Soda", reason="Fluctuates cranial blood flow and can trigger rebound headaches.")
            ]
        elif "diabetes" in c_set:
            self_care = [
                SelfCareItem(title="Post-Meal Active Movement", description="Take a brisk 15-minute walk after meals to help lower glucose levels naturally."),
                SelfCareItem(title="Continuous Glucose Tracking", description="Measure fasting blood sugar levels regularly to assess metabolic stability.")
            ]
            food_rec = [
                FoodItem(title="High-Fiber Complex Oats & Quinoa", reason="Slow digestion prevents rapid blood glucose spikes after eating."),
                FoodItem(title="Lean Proteins & Seeds", reason="Pairing fiber with protein helps stabilize insulin and maintain satiety.")
            ]
            food_lim = [
                FoodItem(title="Sugary Beverages & Refined Flour", reason="Rapidly raises blood sugar, worsening metabolic parameters.")
            ]
        else:
            self_care = [
                SelfCareItem(title="Adequate Hydration & Rest", description="Drink 2.5 to 3 liters of water daily and ensure 7-8 hours of sleep."),
                SelfCareItem(title="Symptom Monitoring", description="Record changes in symptoms or temperature every 4-6 hours.")
            ]
            food_rec = [
                FoodItem(title="Warm Soups & Whole Foods", reason="Delivers essential nutrients and supports cellular recovery."),
                FoodItem(title="Electrolyte-Rich Fluids", reason="Replenishes essential sodium and potassium minerals.")
            ]
            food_lim = [
                FoodItem(title="Deep-Fried & Processed Foods", reason="Avoid high-trans-fat foods that promote inflammatory strain.")
            ]

        return PatientInsightResponse(
            explanation=explanation,
            possible_patterns=patterns,
            specialist=SpecialistGuidance(
                specialty=specialty,
                reason=f"Recommended for professional evaluation based on {', '.join(req.concepts) or 'reported symptoms'}."
            ),
            self_care=self_care,
            food_guidance=FoodGuidance(recommended=food_rec, limit=food_lim),
            source="DETERMINISTIC_FALLBACK",
        )

    def build_patient_ai_context(self, db, user_id: str) -> str:
        """Assembles safe patient context for AI assistant prompt without exposing secret keys."""
        try:
            from app.db.models import Patient, RiskAssessment, HealthNote
            patient = db.query(Patient).filter(Patient.user_id == user_id).first()
            if not patient:
                return "Patient Context: General Guest Baseline"

            latest_assessment = db.query(RiskAssessment).filter(RiskAssessment.patient_id == patient.id).order_by(RiskAssessment.created_at.desc()).first()
            recent_notes = db.query(HealthNote).filter(HealthNote.patient_id == patient.id).order_by(HealthNote.created_at.desc()).limit(5).all()

            notes_str = "; ".join([n.note_text for n in recent_notes]) if recent_notes else "No recent health notes"
            risk_str = f"Risk Score: {latest_assessment.risk_score}%, Care Level: {latest_assessment.care_level}" if latest_assessment else "Care Level: STABLE"

            return (
                f"PATIENT CONTEXT: Full Name: {patient.full_name}, Age: {patient.age or 'N/A'}, "
                f"Known Conditions: {patient.known_conditions or 'None'}, {risk_str}, Dated Notes: {notes_str}"
            )
        except Exception:
            return "Patient Context: General Baseline"


ai_service = AIService()
