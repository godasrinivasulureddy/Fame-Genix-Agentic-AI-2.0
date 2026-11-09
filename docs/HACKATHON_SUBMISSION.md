# Nebius × NVIDIA Global AI Hackathon Submission

Track: Best Apps and Agents

Project: FAME-GENIX 2.0

Core problem:
Patients and emergency operators lack a unified, real-time clinical decision-support and pre-hospital coordination platform. Symptoms, vitals drift, red flags, emergency dispatch state, and hospital handover are handled in disconnected systems, delaying triage and handoff during critical events.

Solution:
FAME-GENIX 2.0 is a full-stack FastAPI + React platform that ingests patient symptoms and device vitals, runs deterministic red-flag safety rules over real-time input, routes them through an agentic multi-medical-consensus workflow with grounded RAG evidence (local guideline chunks + optional Tavily live search), scores symptom-severity risk with a prototype logistic-regression ML model, drives a 12-state emergency finite-state machine (detected → verified → dispatch → en route → hospital reached), and streams multi-portal events via SSE — all orchestrated through the Nebius Token Factory calling NVIDIA open-source models (Nemotron 340B reasoning / Llama-3.1-Nemotron 70B fast), with deterministic fallback when AI providers are unavailable.

NVIDIA open-source model:
- Primary reasoning model: `nvidia/nemotron-4-340b-instruct`
- Fast model: `nvidia/llama-3.1-nemotron-70b-instruct`
- Both are served through the Nebius Token Factory (https://api.tokenfactory.nebius.ai/v1), which is OpenAI-compatible.

Nebius service:
- Nebius Token Factory at `NEBIUS_BASE_URL=https://api.tokenfactory.nebius.ai/v1`
- Authenticated with `NEBIUS_API_KEY`
- Used as the **primary inference provider** for symptom extraction, assessment explanation, patient insight, AI chat, and grounded RAG answers.

How Nebius is used:
1. Frontend sends symptom text / assessment data to FastAPI `/api/v1/ai/*` endpoints.
2. `AIService._generate_with_failover()` first calls Nebius Token Factory with the NVIDIA Nemotron reasoning model, then NVIDIA Llama-3.1-Nemotron fast model.
3. If Nebius is unavailable, the service falls back to Google Gemini (if configured), then to deterministic rules — so the demo never hangs, but the Nebius+NVIDIA path is exercised first whenever credentials are present.
4. RAG answers use the same Nebius→Gemini→deterministic chain over retrieved evidence citations.
5. Status endpoint `/api/v1/ai/status` reports whether the Nebius client is initialized.

Agentic workflow:
1. Patient input (symptom text + vitals).
2. Agent Orchestrator executes typed tool schemas: lookup_clinical_guidelines, calculate_risk, escalate_emergency_incident, schedule_doctor_teleconsult, each with role authorization.
3. Specialized reasoning via the Multi-Agent Medical Society: Cardio-Respiratory, Metabolic & Pharmacological, Emergency Triage agents, plus an independent Safety Evaluator Critic.
4. Evidence retrieval / RAG: local keyword-based guideline retrieval + optional Tavily live search.
5. Safety evaluator: deterministic red-flag rules (RF-001–RF-007) override AI output.
6. Risk engine: prototype ML logistic-regression risk score.
7. Explainable result: per-assessment factors, safety rules, specialist guidance, self-care, food guidance.
8. Clinical/emergency workflow: patient SOS creates an emergency case; FSM advances through dispatch → en route → hospital → completion; SSE streams state transitions to patient/doctor/emergency/ambulance portals.

Why this is technically interesting:
- End-to-end Nebius→NVIDIA→deterministic inference chain with real OpenAI-compatible client code and graceful fallback.
- 5-RBAC portal architecture (patient, doctor, emergency operator, ambulance, admin) sharing one FSM and SSE event bus with per-role isolation.
- Non-clinical ML model documented honestly as a synthetic-data prototype.
- Real-time emergency dispatch lifecycle persisted in SQLite with audit logging at every state transition.
- No committed secrets; `.env.example` files carry placeholders only.

Why people would use it:
- A single dashboard for symptom triage, AI explanation, emergency dispatch tracking, and hospital handover.
- Roles view exactly the data they need: patients see their vitals and AI insight; doctors see triage queues and dossiers; emergency operators see incident boards; ambulance teams see field briefs and handovers.
- Deterministic safety rules mean judges can reproduce red-flag behavior without any API key.

Demo flow:
1. Login as `patient@famegenix.org` / `FameGenix#2026` (demo password).
2. Patient dashboard: view vitals gauges, enter symptoms / health info.
3. AI analysis: symptom extraction → risk score → patient insight via Nebius/NVIDIA.
4. RAG: view evidence citations (local guideline chunks).
5. Risk reasoning: top factors and triggered safety rules shown.
6. Trigger emergency workflow: patient SOS → emergency case created (DETECTED state).
7. Emergency operator verifies (VERIFIED), dispatches (DISPATCHED).
8. Ambulance advances status through en route → hospital reached.
9. Show explainable handoff / handover passport.
10. Each step is backed by persisted DB state and SSE real-time updates; all emergency flows are simulation-mode workflows.

Known limitations:
- ML risk model is trained on a synthetic, hand-authored dataset — not clinical data.
- Emergency dispatch is simulation-only; no real ambulance, EMS, or hospital integration.
- RAG retrieval is keyword/tag-based over curated chunks, not vector search.
- No external AI credentials are committed; without NEBIUS_API_KEY/GEMINI_API_KEY the service uses deterministic fallbacks.
- JWT secret must be provided via environment in deployment; local demo uses `.env.example` placeholder.
- SQLite default; switch to Postgres via DATABASE_URL for closer-to-production testing.
