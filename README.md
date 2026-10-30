# FAME-GENIX 2.0

AI-powered clinical decision support and emergency coordination platform submitted to the **Nebius × NVIDIA Global AI Hackathon 2026**, **Best Apps and Agents** track.

## Problem

Patients, clinicians, and emergency operations teams often work from separate views of the same evolving situation. Symptom descriptions, device readings, guideline evidence, risk estimates, clinician review, and emergency coordination can become disconnected, making it difficult to understand why a case was escalated and what should happen next. FAME-GENIX addresses this coordination problem as a software simulation while keeping the boundary explicit: it is non-clinical decision support and does not replace professional medical judgment.

## Solution

FAME-GENIX combines a FastAPI backend, a React and Vite frontend, controlled multi-agent analysis, curated evidence retrieval, deterministic safety rules, a prototype risk model, and a stateful emergency workflow. A patient can submit symptoms or simulated readings; the Agent Orchestrator coordinates specialized medical agents, retrieves relevant evidence from a local guideline knowledge base and optionally Tavily, invokes Nebius Token Factory with NVIDIA open models when configured, applies safety overrides, estimates a prototype care level, and publishes workflow changes to authenticated patient, doctor, emergency, ambulance, and administrator portals through Server-Sent Events.

## Why This Is Different

- **Safety is authoritative.** Deterministic red-flag rules override AI output rather than allowing a language model to determine emergency status.
- **Evidence is inspectable.** Responses can include citations from curated AHA, WHO, NICE, WAO, and ADA guideline chunks, with optional live Tavily evidence.
- **The workflow is end to end.** The demo connects patient intake, clinical review, emergency operations, ambulance milestones, hospital handoff, and synchronized portal updates.
- **The model claims are bounded.** The symptom risk model is a synthetic-data logistic regression prototype, not a clinical prediction system.
- **The agents are controlled.** Typed tools, role authorization, deterministic specialist analysis, and explicit state transitions constrain agent actions.
- **The platform is provider-resilient.** Nebius/NVIDIA is primary, Google Gemini is the configured model failover, and deterministic rules remain available when external AI providers are unavailable.

## Architecture

```text
+---------+       +----------------------+       +---------------------+
| Patient | ----> | FastAPI API          | ----> | Agent Orchestrator  |
| Portal  |       | Auth, intake, data  |       | typed tools/RBAC    |
+---------+       +----------------------+       +----------+----------+
                                                            |
                                                            v
                                             +---------------------------+
                                             | Specialized Medical      |
                                             | Society agents            |
                                             | Cardio-Respiratory       |
                                             | Metabolic/Renal           |
                                             | Emergency/Triage          |
                                             | Safety Evaluator          |
                                             +-------------+-------------+
                                                           |
                         +---------------------------------+----------------------------------+
                         |                                                                    |
                         v                                                                    v
              +-------------------------+                                        +---------------------+
              | Nebius Token Factory    |                                        | RAG / Evidence      |
              | OpenAI-compatible API   |                                        | local tag-based     |
              | NVIDIA Nemotron models  |                                        | guideline chunks    |
              +------------+------------+                                        | optional Tavily     |
                           |                                                     +----------+----------+
                           +----------------------------+--------------------------------------+
                                                        v
                                             +---------------------------+
                                             | Safety Layer              |
                                             | RF-001 through RF-007    |
                                             | deterministic overrides  |
                                             +-------------+-------------+
                                                           |
                                                           v
                                             +---------------------------+
                                             | Risk Engine               |
                                             | prototype ML + rules     |
                                             | care-level classification |
                                             +-------------+-------------+
                                                           |
                                                           v
                                             +---------------------------+
                                             | Emergency FSM             |
                                             | review, verification,    |
                                             | simulated dispatch and   |
                                             | hospital handoff         |
                                             +-------------+-------------+
                                                           |
                                                           v
                                             +---------------------------+
                                             | SSE /api/v1/events/stream|
                                             | authenticated portal bus |
                                             +-------------+-------------+
                                                           |
          +----------------+----------------+--------------+----------------+
          |                |                |                               |
          v                v                v                               v
     Patient UI       Doctor UI       Emergency UI                    Ambulance UI
```

## Agentic Workflow

1. **Patient input.** A patient submits natural-language symptoms, simulated device readings, an image or report workflow, or a demo scenario through the frontend.
2. **Authenticated intake.** FastAPI validates the request, associates it with the patient record, and applies JWT and role-based access controls.
3. **Orchestration.** The Agent Orchestrator selects controlled, typed tools for guideline lookup, risk calculation, emergency escalation, or teleconsult scheduling. Tool access is checked against the caller's RBAC role.
4. **Specialized analysis.** The deterministic Medical Society runs explainable analyses for Cardio-Respiratory, Metabolic/Renal, Emergency/Triage, and independent Safety Evaluator concerns. It returns observations, hypotheses, recommendations, contraindication checks, and a reasoning trail.
5. **Evidence retrieval.** The workflow retrieves matching curated medical guideline chunks using local tag and keyword matching. If configured, Tavily adds live clinical evidence for verification.
6. **Model reasoning.** Nebius Token Factory routes the prompt to the configured NVIDIA Nemotron reasoning or fast model. If Nebius is unavailable, the service attempts Google Gemini models and then continues with deterministic fallbacks.
7. **Safety evaluation.** Versioned deterministic red-flag rules evaluate the symptom and vital context. These rules are authoritative and can override an AI-generated response or lower-severity recommendation.
8. **Risk estimation.** The risk layer combines structured symptoms, severity, duration, red flags, and available readings. It exposes care levels from `STABLE` through `POSSIBLE_EMERGENCY`.
9. **Emergency coordination.** A possible emergency can create a case in the finite-state machine. Authorized users verify, request a simulated dispatch, and advance the simulated ambulance and hospital milestones.
10. **Real-time synchronization.** The backend publishes case, notification, and status events to the authenticated SSE stream so the patient, doctor, emergency, and ambulance portals can update without polling.
11. **Auditability.** Role actions, review activity, evidence references, and emergency state changes are recorded for the demo's governance and traceability views.

## NVIDIA + Nebius Integration

FAME-GENIX uses **Nebius Token Factory** as its primary hosted model provider. The backend creates an OpenAI-compatible client with:

```text
Base URL: https://api.tokenfactory.nebius.ai/v1
```

When `NEBIUS_API_KEY` is configured, the AI service sends chat-completion requests to the configured NVIDIA open models:

- `nvidia/nemotron-4-340b-instruct` for reasoning-oriented analysis.
- `nvidia/llama-3.1-nemotron-70b-instruct` for a faster model path.

The service attempts the reasoning model first and then the fast model. If both Nebius requests fail, the failover path attempts configured Google Gemini models, including Gemini 2.5/3.x variants. If external providers are not configured or are unavailable, the application returns deterministic symptom parsing, rule-based analysis, evidence-based fallback text, and safety decisions instead of treating an unavailable model as a clinical conclusion.

The Nebius integration is provider abstraction rather than a second database or a local model runtime. Nebius handles model API access; the application remains responsible for prompt construction, input sanitization, response parsing, role authorization, evidence grounding, and deterministic safety enforcement.

## RAG / Evidence Layer

The evidence layer uses **hybrid retrieval**, not a vector database.

1. **Local curated knowledge base.** Medical guideline content is stored as application data, split into searchable chunks, and tagged by topic. The current curated domains include AHA cardiac/acute coronary syndrome guidance, WHO respiratory and hypoxemia guidance, NICE neurological and stroke guidance, WAO anaphylaxis guidance, and ADA metabolic/DKA guidance.
2. **Local tag and keyword matching.** Queries are normalized and matched against chunk tags and token overlap with chunk text. The retriever ranks matching chunks and returns source names and citation text. There are no embeddings, vector indexes, or vector-database dependencies in this path.
3. **Optional live retrieval.** When `TAVILY_API_KEY` is available, Tavily can search for current clinical evidence. The result is treated as supplemental evidence and is returned with its source metadata.
4. **Grounded generation.** Retrieved evidence is placed into the model prompt with instructions to cite sources, avoid invented claims, and state when a specific reference is unavailable. If no model is available, the service can still return retrieved evidence with a safety disclaimer.

This design favors a small, inspectable, deterministic demo knowledge layer over opaque semantic retrieval. It is not a substitute for a maintained clinical evidence service.

## Risk & Safety Layer

The platform separates probabilistic or generative components from authoritative safety boundaries.

- **Deterministic red flags.** Versioned rules (`safety-rules-v1`) evaluate conditions such as low simulated SpO2, rapid desaturation, severe tachycardia, severe breathing difficulty, severe chest pain, dizziness or unconsciousness, and severe bleeding. The primary red-flag contract is represented by rules `RF-001` through `RF-007`.
- **AI override boundary.** An LLM cannot declare an emergency or suppress a triggered safety rule. A triggered red flag takes precedence over a lower-severity AI suggestion.
- **Care levels.** The application uses `STABLE`, `MONITOR`, `ROUTINE_REVIEW`, `PRIORITY_REVIEW`, `URGENT`, and `POSSIBLE_EMERGENCY`.
- **Prototype ML model.** The Symptom Risk ML model is a logistic regression classifier trained on a small, hand-authored synthetic dataset using symptom count, maximum severity, duration, and red-flag count. It is a prototype/non-clinical risk estimation component. It is not clinically validated and is not trained on real patient data.
- **Explainability.** The system preserves triggered rules, input snapshots, evidence citations, model/provider information where available, and reasoning summaries for review.

## Emergency Coordination

Emergency coordination is a **simulation workflow only**. The application does not contact a real ambulance service, dispatch center, hospital, or emergency network. It does not provide real-world emergency response.

The finite-state machine models this nominal path:

```text
DETECTED
  -> UNDER_REVIEW
  -> VERIFIED
  -> DISPATCH_REQUESTED
  -> DISPATCHED
  -> EN_ROUTE
  -> ON_SCENE
  -> PATIENT_REACHED
  -> TRANSPORTING
  -> HOSPITAL_REACHED
  -> COMPLETED
```

`CANCELLED` is the terminal cancellation branch available from applicable states. The emergency portal can verify a case and request simulated dispatch; the ambulance portal can advance simulated milestones; and the hospital handoff is represented as a simulated notification. Location sharing requires explicit demo consent and is not a live dispatch integration.

## Technology Stack

| Layer | Technology |
| --- | --- |
| Backend API | Python 3.10+, FastAPI, Uvicorn |
| Persistence | SQLAlchemy, SQLite by default; PostgreSQL-compatible configuration is available |
| Authentication | JWT Bearer access tokens, 24-hour access lifetime, 7-day refresh lifetime |
| Password security | bcrypt password hashing |
| Authorization | Five RBAC roles: patient, doctor, emergency operator, ambulance team, system administrator |
| Agent runtime | Controlled FastAPI/Python orchestrator with typed tool schemas and role authorization |
| Generative AI | Nebius Token Factory OpenAI-compatible API with NVIDIA Nemotron models; Google Gemini failover |
| Evidence | Local tag-based and keyword retrieval over curated guideline chunks; optional Tavily live search |
| Risk prototype | NumPy, scikit-learn logistic regression over synthetic data |
| Real-time updates | Server-Sent Events at `GET /api/v1/events/stream` |
| Frontend | React, Vite, TypeScript |
| Local development | Windows batch launchers, Python virtual environment, npm |

## Repository Structure

```text
.
├── backend/
│   ├── app/
│   │   ├── agents/             # Agent Orchestrator and specialized Medical Society
│   │   ├── ai/                 # Provider abstraction, prompts, parsing, safety guardrails
│   │   ├── assessments/        # Clinical assessment schemas and routes
│   │   ├── auth/               # Login, refresh, and authentication schemas/routes
│   │   ├── core/               # Configuration, dependencies, events, SSE, responses
│   │   ├── db/                 # SQLAlchemy models, sessions, and database setup
│   │   ├── doctors/            # Doctor review and clinical queue operations
│   │   ├── emergency/          # Emergency cases, FSM transitions, and subscriptions
│   │   ├── patients/           # Patient services and profiles
│   │   ├── rag/                # Curated knowledge base and optional Tavily retrieval
│   │   ├── reports/             # Report validation, OCR, and lab extraction
│   │   ├── risk/               # Fusion, drift, anomaly, ML prototype, and safety rules
│   │   ├── simulator/           # Demo scenarios and simulated telemetry
│   │   └── symptoms/            # Symptom extraction and vocabulary
│   ├── requirements.txt
│   └── .env.example
├── frontend/                   # React + Vite TypeScript application
├── scripts/
│   └── seed_demo.py            # Creates the five demo accounts and initial patient data
├── start_backend.bat            # Seeds the database and starts FastAPI
├── start_frontend.bat           # Starts the Vite development server
├── start_all.bat                # Starts backend and frontend in separate windows
├── LICENSE
└── README.md
```

## Local Setup

The commands below assume the repository root is the directory containing `backend/`, `frontend/`, `scripts/`, and the start scripts.

### 1. Install prerequisites

- Python 3.10 or newer with `pip`.
- Node.js 18 or newer with `npm`.

### 2. Create and activate a Python environment

Windows Command Prompt:

```cmd
python -m venv .venv
.venv\Scripts\activate
```

PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 3. Install backend dependencies

```cmd
pip install -r backend\requirements.txt
```

### 4. Configure optional providers

Copy `backend/.env.example` to `backend/.env`, then set the provider keys and security values described in [Environment Variables](#environment-variables). The default SQLite configuration requires no external database.

```cmd
copy backend\.env.example backend\.env
```

Do not commit real API keys or production secrets.

### 5. Seed demo data

From the repository root:

```cmd
python scripts\seed_demo.py
```

The seed script is idempotent for the demo users. It creates the SQLite database and the initial patient profile when needed.

### 6. Install frontend dependencies

```cmd
cd frontend
npm install
cd ..
```

## Environment Variables

Set these in `backend/.env`. Empty provider keys are valid for a deterministic local demo.

| Variable | Required | Default / example | Purpose |
| --- | --- | --- | --- |
| `ENVIRONMENT` | No | `development` | Runtime environment label. |
| `SIMULATION_MODE` | No | `true` | Keeps emergency and device workflows in simulation mode. |
| `DATABASE_URL` | No | SQLite database under `backend/` | SQLAlchemy database URL. SQLite is the zero-setup default. |
| `JWT_SECRET` | Recommended | `change-me-in-production` | Secret used to sign JWTs. Replace it outside a local demo. |
| `GEMINI_API_KEY` | No | Empty | Enables Google Gemini fallback when Nebius is unavailable. |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Configured Gemini model label. |
| `AI_ENABLED` | No | `true` | Enables provider calls when a configured key is available. |
| `AI_TIMEOUT_SECONDS` | No | `30` | Timeout for external model requests. |
| `NEBIUS_API_KEY` | No | Empty | Primary Nebius Token Factory credential. |
| `NEBIUS_BASE_URL` | No | `https://api.tokenfactory.nebius.ai/v1` | OpenAI-compatible Nebius endpoint. |
| `NVIDIA_MODEL_REASONING` | No | `nvidia/nemotron-4-340b-instruct` | Primary reasoning model requested through Nebius. |
| `NVIDIA_MODEL_FAST` | No | `nvidia/llama-3.1-nemotron-70b-instruct` | Secondary faster model requested through Nebius. |
| `TAVILY_API_KEY` | No | Empty | Enables optional live evidence search. |
| `ALLOW_QML` | No | `false` | Demo configuration flag; leave disabled unless explicitly needed. |

## Running the Application

### Backend

From the repository root, after activating the virtual environment and seeding the database:

```cmd
uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```

The API is available at `http://127.0.0.1:8000`. FastAPI's interactive documentation is available at `http://127.0.0.1:8000/docs`.

### Frontend

From the `frontend/` directory:

```cmd
npm install
npm run dev
```

Open the Vite application at `http://localhost:3000` when the frontend reports that it is ready.

### Windows launch scripts

From the repository root:

```cmd
start_backend.bat
start_frontend.bat
start_all.bat
```

`start_backend.bat` seeds the demo database before starting Uvicorn. `start_all.bat` opens backend and frontend processes in separate command windows.

## Demo Accounts

All seeded accounts use the password `FameGenix#2026`.

| Email | Role | Demo portal |
| --- | --- | --- |
| `patient@famegenix.org` | Patient | Patient intake, simulated readings, symptoms, and timeline |
| `doctor@famegenix.org` | Doctor | Clinical review queue and patient dossier |
| `emergency@famegenix.org` | Emergency operator | Incident verification and simulated dispatch workflow |
| `ambulance@famegenix.org` | Ambulance team | Simulated en-route, scene, transport, and handoff milestones |
| `admin@famegenix.org` | System administrator | Audit and governance views |

These credentials are for local demonstration only. Do not use them in a deployed environment.

## Demo Flow

The following path is designed for an approximately three-minute demonstration.

1. **Start both services.** Run `start_all.bat`, or start the backend and frontend manually. Open `http://localhost:3000`.
2. **Open the patient portal.** Sign in as `patient@famegenix.org` with `FameGenix#2026`.
3. **Submit a case.** Enter symptoms such as severe breathing difficulty or chest pain, or use a simulator scenario that produces concerning readings. Keep the UI's simulated-data labels visible.
4. **Show the clinical reasoning.** Point out the specialized agent findings, retrieved guideline citations, care level, triggered safety rule, and the explicit non-clinical disclaimer.
5. **Switch to the doctor portal.** Sign in as `doctor@famegenix.org` and show the prioritized review item, data provenance, patient context, and review action.
6. **Open emergency operations.** Sign in as `emergency@famegenix.org`, verify the simulated incident, and request simulated dispatch. Emphasize that no real service is contacted.
7. **Advance the ambulance workflow.** Sign in as `ambulance@famegenix.org` and advance the state through the simulated milestones toward hospital arrival and completion.
8. **Demonstrate synchronization.** Keep another portal open or refresh its event view to show updates delivered through `GET /api/v1/events/stream`.
9. **Close with governance.** Optionally sign in as `admin@famegenix.org` to show audit information and the prototype ML benchmark metrics, then state the limitations clearly.

## Hackathon Track

FAME-GENIX 2.0 is submitted to the **Nebius × NVIDIA Global AI Hackathon 2026**, **Best Apps and Agents** track. The project is framed as an application and agent workflow demonstration: the value is in coordinating specialized agents, evidence retrieval, safety evaluation, risk estimation, and synchronized emergency simulation around a single case.

## NVIDIA/Nebius Usage

Nebius Token Factory is the project's primary AI inference gateway. It exposes an OpenAI-compatible API endpoint that the FastAPI backend uses to route prompts to NVIDIA open-source Nemotron models. The application uses the larger `nvidia/nemotron-4-340b-instruct` path for reasoning-oriented work and `nvidia/llama-3.1-nemotron-70b-instruct` for the faster path, selected through `NVIDIA_MODEL_REASONING` and `NVIDIA_MODEL_FAST`.

In the demonstration, NVIDIA/Nebius supports symptom interpretation, evidence-grounded explanations, and agentic clinical reasoning. The surrounding application is deliberately provider-independent: typed tool schemas, role checks, local retrieval, deterministic red-flag rules, and emergency state transitions remain in the FastAPI service. When Nebius is unavailable, the service fails over to Google Gemini 2.5/3.x models and then to deterministic application behavior. This makes the safety-critical boundaries visible rather than hiding them inside a model call.

## Limitations

- This is a simulation and non-clinical prototype. It has not been clinically validated.
- The Symptom Risk ML model uses synthetic, hand-authored data and is not trained on real patient data. Its metrics are demonstration metrics, not clinical performance evidence.
- Thresholds and red-flag conditions are prototype/demo calibration and must not be used as medical triage guidance.
- AI output can be incomplete, incorrect, or outdated even when evidence citations are returned.
- The local evidence layer is a small curated chunk set, not a complete medical knowledge base or a continuously maintained clinical evidence service.
- Optional Tavily results require network access and can vary over time; retrieved web content should be reviewed by qualified professionals.
- The emergency workflow does not dispatch real ambulances, contact emergency services, reserve hospital capacity, or guarantee a handoff.
- Simulated telemetry and demo patient data are not medical-grade device measurements.
- The default CORS and local development settings are intentionally permissive and are not production deployment settings.
- Production use would require clinical governance, validated models and thresholds, privacy controls, secure deployment, monitoring, integration testing, and regulatory review.

## Medical Safety Disclaimer

**FAME-GENIX is a software simulation and non-clinical prototype. It is not a medical device, does not provide a diagnosis, and does not replace a licensed healthcare professional's judgment.** AI responses, risk estimates, evidence retrieval, and emergency status are for demonstration and decision-support workflow evaluation only. Do not use this application to make real medical decisions or to request real emergency response. For an actual medical emergency, contact local emergency services and qualified medical professionals immediately.

## Existing Project Update Disclosure

FAME-GENIX 2.0 is an update to the existing FAME-GENIX project rather than a greenfield application. This version retains the FastAPI and React foundation while extending it with the controlled Agent Orchestrator, specialized Medical Society analysis, Nebius Token Factory and NVIDIA model routing, hybrid evidence retrieval, deterministic safety evaluation, prototype risk estimation, emergency finite-state coordination, and SSE-based multi-portal synchronization. The update is presented honestly as a simulation/non-clinical prototype and does not claim clinical validation, FDA approval, or real emergency dispatch.

## License

This project is licensed under the [MIT License](LICENSE).
