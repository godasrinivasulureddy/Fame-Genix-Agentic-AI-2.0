# Neural Pulse Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the FAME-GENIX 2.0 landing page and all five role portals around the approved Neural Pulse visual identity while preserving existing API behavior and accessibility.

**Architecture:** Keep the current React component boundaries and API client unchanged. Add a shared visual token layer and reusable layout primitives in `shared.tsx`, then update `App.tsx`, `patient.tsx`, and `staff.tsx` to consume those primitives without changing endpoint contracts or business behavior. Sync the final frontend source to both `backend/frontend/` and the actual `fame-genix-frontend-v2/` workspace copy.

**Tech Stack:** React 18, TypeScript, Vite 6, Tailwind CSS 4, lucide-react, existing API client and portal components.

**Spec:** `docs/YASIN_LEAD_TASKS_AND_ARCHITECTURE.md` plus the approved Neural Pulse design direction from the conversation.

## Global Constraints

- Preserve all existing API behavior, endpoint paths, payloads, auth handling, SSE behavior, and portal workflows.
- Use the existing React 18 + TypeScript + Vite + Tailwind 4 stack; do not add a component framework.
- Use Neural Pulse palette: obsidian `#07090F`, surface `#0D1117`, elevated `#161B22`, cyan `#00E5FF`, violet `#A78BFA`, amber `#FBBF24`, rose `#FB7185`, border `#21262D`, text `#E6EDF3` / `#8B949E`.
- Use Space Grotesk for display, Inter for interface/body, and JetBrains Mono for numeric telemetry and identifiers, with resilient local/system fallbacks.
- Keep simulated data visibly labelled; never imply clinical validation or real ambulance/GPS integration.
- Maintain keyboard focus visibility, semantic controls, responsive layouts, reduced-motion support, and readable mobile layouts.
- Do not introduce generic SaaS card grids, unearned gradients, or decorative motion that does not explain state.

## Review Focus

- Narrow mobile widths: navigation, modal forms, portal tables, and four-column telemetry must remain usable without horizontal overflow; add responsive checks in Task 5.
- Reduced-motion preference: waveform and entrance motion must disable or become static under `prefers-reduced-motion`; add CSS verification in Task 1 and browser verification in Task 5.
- High-risk and simulated states: critical, warning, and simulated badges must maintain contrast and meaning across dark surfaces; add component assertions in Task 2.
- Empty/loading/error states: new visual primitives must not hide the existing text or retry actions; verify each portal state in Task 4.
- Auth/session failures: visual refresh must not alter sign-in, sign-out, token storage, or unauthorized error behavior; verify the existing auth journey in Task 5.

---

### Task 1: Neural Pulse Token System and Global Shell

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/shared.tsx`
- Modify: `frontend/src/App.tsx`
- Sync after implementation: `fame-genix-frontend-v2/src/index.css`, `fame-genix-frontend-v2/src/shared.tsx`, `fame-genix-frontend-v2/src/App.tsx`

**Interfaces:**
- Consumes: Existing `Card`, `Btn`, `Overline`, `Modal`, `ErrorState`, `fieldCls`, `PORTALS`, and `api` behavior.
- Produces: Shared classes/primitives with unchanged public component props: `Card`, `Btn`, `Overline`, `StatusBadge`, `RiskBadge`, `Simulated`, `Modal`; global tokens and shell styles consumed by all portal components.

- [ ] **Step 1: Add visual-system tests/checklist before implementation**

Create a lightweight frontend verification file or documented browser assertions covering: rendered root uses the Neural Pulse background, focus rings remain visible, `prefers-reduced-motion` disables animation, and `Card`/`Btn` retain accessible semantic elements.

- [ ] **Step 2: Run the frontend type/build check to establish the baseline**

Run: `cd frontend && npm run build`
Expected: PASS before the token refactor.

- [ ] **Step 3: Implement the Neural Pulse token layer in `frontend/src/index.css`**

Define CSS variables for the approved palette, font stacks, focus ring, surface elevations, and reduced-motion behavior. Add a restrained page texture/grid and one reusable waveform animation class; ensure all animation rules have a `prefers-reduced-motion: reduce` override.

- [ ] **Step 4: Refine shared primitives in `frontend/src/shared.tsx`**

Keep existing props and exported names. Replace uniform heavy cards with hierarchy-aware `Card` surfaces, add visible focus/hover states, make status colors use the approved semantic palette, and keep `Simulated`, `ErrorState`, and `Loading` copy unchanged in meaning.

- [ ] **Step 5: Build the persistent app shell in `frontend/src/App.tsx`**

Use a two-column desktop shell with a compact role rail and a responsive top bar that collapses on small screens. Preserve role switching, login modal, token storage, sign-out, and portal rendering. Add the single live waveform signature to the landing/app shell without adding new API calls.

- [ ] **Step 6: Verify the token system**

Run: `cd frontend && npm run build`
Expected: PASS with no TypeScript errors; manually verify keyboard focus and reduced-motion in the browser.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/index.css frontend/src/shared.tsx frontend/src/App.tsx
git commit -m "feat(frontend): add Neural Pulse visual system and shell"
```

### Task 2: Landing Page and Authentication Experience

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/shared.tsx` only if a modal primitive adjustment is required
- Sync: same files under `fame-genix-frontend-v2/src/`

**Interfaces:**
- Consumes: `Landing`, `AuthModal`, `PORTALS`, `api.login`, `api.me`, and existing `Btn`/`Modal` primitives.
- Produces: A responsive landing page with the Neural Pulse hero, pipeline, portal chooser, sign-in modal, and unchanged role entry behavior.

- [ ] **Step 1: Add landing/auth behavior assertions**

Pin these behaviors: clicking “Explore as Patient” opens/signs into the Patient role as currently configured; invalid credentials render an alert; the modal closes with Escape; all portal chooser buttons remain keyboard reachable.

- [ ] **Step 2: Implement the Neural Pulse landing composition**

Replace the generic hero/card grid with a left-aligned operational headline, live waveform signature, concise safety scope copy, one primary Patient entry action, and a compact portal rail. Keep the six pipeline stages because they represent the actual system sequence, but style them as a connected signal path rather than six identical cards.

- [ ] **Step 3: Refine authentication modal copy and states**

Keep email/password fields, demo-role prefilling, loading, error, and close behavior. Improve hierarchy and focus treatment without displaying credentials or changing auth requests.

- [ ] **Step 4: Verify landing/auth**

Run: `cd frontend && npm run build`
Then use the browser to verify landing at desktop and 375px mobile widths, open/close sign-in, submit invalid credentials, and keyboard-navigate the portal chooser.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/shared.tsx
git commit -m "feat(frontend): redesign landing and sign-in experience"
```

### Task 3: Patient Portal Neural Dashboard

**Files:**
- Modify: `frontend/src/patient.tsx`
- Modify: `frontend/src/shared.tsx` for patient-specific visualization primitives only
- Sync: same files under `fame-genix-frontend-v2/src/`

**Interfaces:**
- Consumes: Existing `api.myPatient`, `api.createAssessment`, `api.insight`, `api.rag`, `api.sos`, `api.analyze`, `api.requestConsultation`, `api.subscribeEvents`, and all existing patient types.
- Produces: Patient UI with the same API calls and state transitions, redesigned around a telemetry header, asymmetric vitals grid, risk state, AI evidence, consultation, SOS, report/image upload, and Handover Passport.

- [ ] **Step 1: Add patient UI behavior assertions**

Cover: symptom entry and removal, voice input availability message, preset vitals label `[SIMULATED]`, assessment loading/error, safety rules visibility, consultation request, SOS success/error, evidence empty state, upload error, and Handover Passport opening/copying.

- [ ] **Step 2: Implement the Neural Pulse patient header and telemetry surface**

Use the waveform as the single signature element. Make current care level, latest vitals, simulation provenance, and “last analysis” the first readable cluster. Keep SVG sparkline data and existing values; do not invent measurements.

- [ ] **Step 3: Redesign patient inputs and analysis action**

Use a focused symptom composer, a compact vitals entry matrix, and a clear primary “Analyze health” action. Preserve voice language controls, preset behavior, numeric parsing, and disabled-state logic.

- [ ] **Step 4: Redesign risk, AI, evidence, consultation, SOS, and upload sections**

Use cyan for telemetry, violet for AI/RAG, amber for simulated/uncertain content, and rose for urgent rules. Keep existing disclaimers and backend-required language truthful. Do not add diagnosis claims or API calls.

- [ ] **Step 5: Verify patient portal**

Run: `cd frontend && npm run build`
Use the browser at desktop and mobile widths with the live backend; verify the complete patient assessment flow and no horizontal overflow.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/patient.tsx frontend/src/shared.tsx
 git commit -m "feat(frontend): redesign patient Neural Pulse dashboard"
```

### Task 4: Staff Portal Surfaces

**Files:**
- Modify: `frontend/src/staff.tsx`
- Modify: `frontend/src/shared.tsx` only for shared staff primitives
- Sync: same files under `fame-genix-frontend-v2/src/`

**Interfaces:**
- Consumes: Existing Doctor, Emergency, Ambulance, and Admin components; `api.doctorQueue`, `api.consultationQueue`, `api.emergencyCases`, `api.verifyCase`, `api.dispatchCase`, `api.advanceCase`, `api.ambulanceBrief`, `api.adminMetrics`, `api.adminSafetyRules`, `api.adminAuditLogs`, and unchanged types.
- Produces: Redesigned staff surfaces with consistent shell hierarchy, role-specific status color, readable queues, lifecycle stepper, dossier, and audit/metrics presentation.

- [ ] **Step 1: Add staff state assertions**

Pin empty/loading/error states for every queue, correct disabled action states for emergency transitions, consultation start/complete behavior, ambulance status progression, admin metrics/rules/log loading, and Handover Passport opening.

- [ ] **Step 2: Redesign DoctorView**

Use an operational queue rail and a clinical dossier workspace. Preserve RAG lookup, safety rules, vitals, decision logger, consultation actions, and backend-required messaging. Make selected-patient context obvious without decorative repetition.

- [ ] **Step 3: Redesign EmergencyView and AmbulanceView**

Use the emergency lifecycle as a strong horizontal/vertical signal path. Preserve state transition buttons and simulation labels. Make invalid or unavailable actions visually and semantically disabled.

- [ ] **Step 4: Redesign AdminView**

Present metrics, RF-001..RF-011 rules, and audit logs as three distinct governance surfaces. Keep raw metrics fallback readable and avoid implying clinical validation.

- [ ] **Step 5: Verify all staff portals**

Run: `cd frontend && npm run build`
Use the browser with the seeded Doctor, Emergency Operator, Ambulance, and Admin credentials; verify desktop/mobile layouts and keyboard focus.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/staff.tsx frontend/src/shared.tsx
git commit -m "feat(frontend): redesign staff Neural Pulse portals"
```

### Task 5: Sync, Accessibility, Responsive Review, and Release Verification

**Files:**
- Modify: `frontend/vite.config.ts` only if the launch/proxy contract changes during implementation
- Sync: all changed files from `backend/frontend/` to `fame-genix-frontend-v2/`
- Test/verify: `frontend/`, `fame-genix-frontend-v2/`, and backend live services

**Interfaces:**
- Consumes: Completed Tasks 1–4 and existing launch scripts.
- Produces: Identical connected frontend copies, passing builds, verified live flows, and a reviewable diff.

- [ ] **Step 1: Sync frontend sources**

Copy only source/config files changed by Tasks 1–4 into `fame-genix-frontend-v2/`; do not copy `node_modules/` or `dist/` into tracked source.

- [ ] **Step 2: Run static verification**

Run both:
```bash
cd frontend && npm run build
cd ../../fame-genix-frontend-v2 && npm run build
```
Expected: both TypeScript and Vite builds pass.

- [ ] **Step 3: Run accessibility/responsive browser review**

Verify at 375px, 768px, and desktop widths: no horizontal overflow, visible focus rings, readable contrast, Escape closes dialogs, reduced motion removes waveform/entrance motion, and all primary controls remain reachable by keyboard.

- [ ] **Step 4: Run live smoke flows**

With backend and frontend running, verify login, patient assessment, RAG evidence, SOS creation, doctor queue, emergency board, ambulance brief, and admin metrics/rules/audit log. Confirm simulated labels remain visible.

- [ ] **Step 5: Review diff and commit**

Run: `git status --short && git diff --stat`
Expected: only intended frontend source/config and plan files changed; generated `node_modules/`, `dist/`, and coverage files remain ignored.

```bash
git add frontend fame-genix-frontend-v2 docs/superpowers/plans/2026-10-26-neural-pulse-frontend-redesign.md
git commit -m "feat(frontend): complete Neural Pulse redesign verification"
git push origin AI-Systems-Architect-Yasin
```
