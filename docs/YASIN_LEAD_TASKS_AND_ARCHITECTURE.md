# 🏆 FAME-GENIX 2.0: Mohammad Yasin (Team Lead & Full-Stack Architect) Plan

**Project:** FAME-GENIX 2.0 — Multimodal Agentic Healthcare & Emergency Coordination Platform  
**Competition:** Nebius × NVIDIA Global AI Hackathon 2026 (Best Apps & Agents Track)  
**Team Name:** Skyline Intelligence / Nemotron Intelligence  
**Role Owner:** **Mohammad Yasin Shaik** (Team Lead, Full-Stack & AI Systems Architect)  
**Teammate:** **Goda Srinivasulu Reddy** (Backend, Agentic Workflows & Infrastructure Engineer)  
**Date:** 2026-10-26  

---

## 1. Intent and "The Why"
FAME-GENIX 2.0 bridges the gap between everyday patient health signals, diagnostic medical reports, continuous telemetry, and emergency response workflows.
As **Team Lead and Full-Stack / AI Systems Architect**, Mohammad Yasin's responsibility is to:
1. Ensure the unified end-to-end user experience works across all 5 clinical and emergency roles (Patient, Doctor, Emergency Operator, Ambulance, Admin).
2. Wire real multimodal perception (voice, text, medical report OCR, photo analysis, simulated telemetry) into a cohesive frontend.
3. Establish robust full-stack API contract parity with Srinivasulu's backend (`Agentic-Workflows-Srinu`).
4. Ensure explainable risk intelligence (RiskDonut, Spectrum, RF-001..RF-007 Red-Flag rules, RAG citations, and Emergency Handover Passport) is delivered truthfully without hallucination.
5. Drive the 3-minute hackathon demonstration script and technical deliverables.

---

## 2. Division of Responsibilities

| Responsibility Area | Mohammad Yasin (You) | Goda Srinivasulu Reddy (Teammate) |
|---|---|---|
| **Role & Persona** | Team Lead & Full-Stack / AI Systems Architect | Backend & Agentic Workflows Engineer |
| **Frontend UI/UX** | **100% Ownership**: React 18, Vite 6, Tailwind 4, 5 role portals | N/A (Frontend consumer) |
| **Multimodal Inputs** | **Frontend Audio/Speech STT/TTS, PDF/Image dropzones, Camera, Telemetry visualization** | Ingestion endpoints, OCR engine, PyMuPDF |
| **Full-Stack Contracts** | **API client (`api.ts`), type contracts (`types.ts`), SSE subscriber (`events/stream`)** | FastAPI routers, Pydantic schemas, DB models |
| **Agentic & RAG Integration** | **Evidence display, citations validation, insight presentation, prompt UX** | Nebius Token Factory client, Tavily integration, Qdrant/KB |
| **Risk & Safety UX** | **RiskDonut, Spectrum, Safety Rule alert cards, Handover Passport modal** | Deterministic Z-score, EWMA, RF-001..RF-007 engine |
| **Hackathon Presentation** | **Project framing, multimodal demo, closing architecture (0:00-1:10 & 2:30-3:00)** | AI, risk engine, and emergency state machine (1:10-2:30) |

---

## 3. Goals, Non-Goals & Anti-Goals for Yasin's Scope

### Goals
- **G1: Cohesive V2 Workspace**: Structure `v2` cleanly with `frontend/`, `backend/`, `docs/`, `scripts/`, and root launch scripts.
- **G2: API Parity & Contract Fixes**:
  - Fix `/api/v1/ai/patient-insight` contract (adapt payload between frontend and backend).
  - Add/route `/api/v1/rag/retrieve` or align with `lookup_clinical_guidelines` so clinical evidence loads cleanly.
  - Align assessment creation: allow direct assessment creation or session-backed creation without 422 errors.
  - Wire Server-Sent Events (`GET /api/v1/events/stream`) to replace 15s polling with instant live updates.
- **G3: Multimodal Patient Experience**:
  - Voice intake (English, Telugu, Hindi) with transcript confirmation.
  - Lab report OCR viewer: display parsed test tables (CBC, LFT, KFT, Glucose) with abnormal badges.
  - Optical image analysis with non-diagnostic safety guardrails.
  - Continuous telemetry visualizer with realistic animated waveforms, sparklines, and presets.
- **G4: Explainable Clinical Intelligence & Handover Passport**:
  - Risk Donut, Risk Spectrum, dynamic Red-Flag Safety Rules display.
  - Verified clinical literature citations (AHA, WHO, NICE, WAO, ADA).
  - Standardized Emergency Handover Passport modal with one-click JSON copy.
- **G5: Five Working Portals**:
  - Patient Portal: Health intake, vitals, report viewer, doctor consult request, SOS.
  - Doctor Portal: Triage queue, clinical dossier, decision logger.
  - Emergency Operator Portal: Real-time incident board, 10-stage lifecycle stepper, verify & dispatch actions.
  - Ambulance Portal: Dispatched incident list, pre-arrival brief, transit status stepper.
  - Admin Portal: Connect live backend metrics (`/api/v1/assessments/model/metrics`), safety rule catalog, audit logs.
- **G6: Demo Readiness**: One-click demo launch with preconfigured credentials (`patient@famegenix.org` / `FameGenix#2026`).

### Non-Goals
- Reinventing Srinivasulu's backend core, DB models, or ML algorithms.
- Connecting real clinical hardware or real 911/ambulance dispatch (simulation is explicitly labelled).
- Modifying Version 1 (`repo_1_0`), which stays as historical reference.

### Anti-Goals (What would make this fail)
- Showing "BACKEND SUPPORT REQUIRED" on portals during the hackathon demonstration.
- Presenting simulated telemetry or AI risk predictions as verified clinical diagnoses.
- Incompatible schemas crashing the app during a live demo.
- Hardcoding static mock data where real backend APIs exist.

---

## 4. Work Breakdown Structure (Mohammad Yasin's Task Backlog)

### Sprint 1: Workspace & API Contract Parity
- [ ] **Task 1.1**: Set up root launch scripts (`start_all.bat`, `start_frontend.bat`, `start_backend.bat`) and environment configuration (`.env`).
- [ ] **Task 1.2**: Align `api.ts` with backend FastAPI routes:
  - Connect `/api/v1/ai/patient-insight` properly.
  - Implement `/api/v1/rag/retrieve` backend adapter/route to expose `rag_assistant` & `knowledge_engine`.
  - Connect `/api/v1/assessments` creation flow smoothly.
  - Connect `/api/v1/ambulance/cases/{id}/brief`.
  - Connect `/api/v1/assessments/model/metrics` to the Admin portal.
  - Connect `/api/v1/audit` and safety rule catalog to Admin portal.
- [ ] **Task 1.3**: Wire Server-Sent Events (`/api/v1/events/stream`) in frontend `api.ts` / custom hook `usePortalEvents` for instant cross-portal updates.

### Sprint 2: Patient Portal Multimodal & Telemetry Polish
- [ ] **Task 2.1**: Enhance voice input with language selector (`en-IN`, `te-IN`, `hi-IN`) and transcript review/correction before submission.
- [ ] **Task 2.2**: Lab report OCR viewer: render extracted lab table (test name, value, unit, reference range, abnormal flag).
- [ ] **Task 2.3**: Image analysis component: render image observation results with clinical disclaimer.
- [ ] **Task 2.4**: Continuous telemetry visualizer: waveform animation, live vitals cards, simulated anomaly triggers.
- [ ] **Task 2.5**: Emergency Handover Passport modal enhancements with FHIR/HL7 formatted JSON and export.

### Sprint 3: Staff & Governance Portals Polish
- [ ] **Task 3.1**: Doctor Portal: Triage & consultation queue auto-refresh via SSE, complete clinical dossier, decision logging.
- [ ] **Task 3.2**: Emergency Operator Portal: Real-time incident board with severity badges, 10-stage lifecycle stepper, verify & dispatch triggers.
- [ ] **Task 3.3**: Ambulance Portal: Assigned cases, real-time transit stepper, pre-arrival emergency brief.
- [ ] **Task 3.4**: Admin Portal: Real model metrics (accuracy, F1, latency), deterministic safety rules catalog (RF-001..RF-007), audit log stream.

### Sprint 4: Pre-PR Quality Verification & Hackathon Script
- [ ] **Task 4.1**: Run TypeScript check (`npm run lint`), build check (`npm run build`).
- [ ] **Task 4.2**: Verify end-to-end flow with seeded users (`FameGenix#2026`).
- [ ] **Task 4.3**: Rehearse 3-minute demo script matching Mohammad Yasin's speaking sections (0:00-1:10 & 2:30-3:00).
