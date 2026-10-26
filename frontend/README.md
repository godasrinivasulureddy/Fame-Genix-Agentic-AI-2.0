# FAME-GENIX 2.0 frontend

React 18 + TypeScript + Vite 6 + Tailwind 4. One app, five portals (Patient, Doctor, Emergency Operator, Ambulance, Admin).

    cp .env.example .env   # set VITE_DEMO_PASSWORD locally; never commit .env
    npm install
    npm run lint && npm run build
    npm run dev            # http://localhost:3000, proxies /api to 127.0.0.1:8001

Drop `src/` into the existing `frontend/` (replacing the old components) once the checks below pass.

## Verify against the real backend (contracts the spec did not define)
- `POST /ai/patient-insight` body `{assessment_id}`; response `{explanation, suggested_specialty}`
- `POST /rag/retrieve` body `{query}`; response `Evidence[]`
- `POST /reports/analyze`, `/images/analyze` multipart field `file`
- Shape of `GET /doctors/queue` rows, `GET /ambulance/cases/{id}/brief`, and `vitals` on assessments (respiratory_rate / temperature key names)
- Ambulance role may not be allowed to call `GET /emergency/cases` or `/advance`
- `public_id` on emergency cases (CASE-xxxxxx)

## Not implemented (no backend endpoint in the spec)
Emergency SOS, prior clinical reviews list, all three Admin panels. Each shows `BACKEND SUPPORT REQUIRED`.
Wearable link and GPS are labelled `[SIMULATED]`.
