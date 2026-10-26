from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.assessments.router import router as assessments_router
from app.audit.router import router as audit_router
from app.auth.router import router as auth_router
from app.core.config import settings
from app.core.exceptions import AppError, app_error_handler
from app.db.session import init_db
from app.devices.router import router as devices_router
from app.doctors.router import router as doctors_router
from app.emergency.router import ambulance_router, router as emergency_router
from app.notifications.router import router as notifications_router
from app.patients.router import router as patients_router
from app.risk.ml_model import train_model
from app.simulator.router import router as simulator_router
from app.symptoms.router import router as symptoms_router
from app.ai.router import router as ai_router
from app.images.router import router as images_router
from app.reports.router import router as reports_router
from app.core.sse_router import router as sse_router
from app.core.settings_router import router as settings_router

app = FastAPI(title=settings.APP_NAME, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # demo-scope only; restrict in real deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AppError, app_error_handler)

app.include_router(auth_router)
app.include_router(patients_router)
app.include_router(symptoms_router)
app.include_router(assessments_router)
app.include_router(devices_router)
app.include_router(simulator_router)
app.include_router(doctors_router)
app.include_router(emergency_router)
app.include_router(ambulance_router)
app.include_router(notifications_router)
app.include_router(audit_router)
app.include_router(ai_router)
app.include_router(images_router)
app.include_router(reports_router)
app.include_router(sse_router)
app.include_router(settings_router)


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    train_model()  # warm the demo symptom-risk model once at boot

    # Wire domain-event subscribers (notifications + auto emergency-case creation)
    from app.emergency.subscribers import register_subscribers as register_emergency_subscribers
    from app.notifications.subscribers import register_subscribers as register_notification_subscribers
    register_notification_subscribers()
    register_emergency_subscribers()


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME, "demo_mode": settings.DEMO_MODE}


