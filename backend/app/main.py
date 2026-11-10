from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.assessments.router import router as assessments_router
from app.audit.router import router as audit_router
from app.auth.router import router as auth_router
from app.core.config import settings
from app.core.exceptions import AppError, app_error_handler
from app.core.limiter import limiter
from app.core.security_headers import SecurityHeadersMiddleware
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
from app.rag.router import router as rag_router
from app.core.settings_router import router as settings_router
from app.audit.black_box import clinical_black_box


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup lifecycle
    init_db()
    train_model()

    from app.db import session as db_session_module
    db = db_session_module.SessionLocal()
    try:
        clinical_black_box.bind_session_factory(db_session_module.SessionLocal)
        clinical_black_box.load_from_db(db)
    finally:
        db.close()

    from app.emergency.subscribers import register_subscribers as register_emergency_subscribers
    from app.notifications.subscribers import register_subscribers as register_notification_subscribers
    register_notification_subscribers()
    register_emergency_subscribers()

    yield

    # Shutdown lifecycle
    pass


app = FastAPI(title=settings.APP_NAME, version="0.1.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_cors_origins = [o.strip() for o in settings.CORS_ALLOW_ORIGINS.split(",") if o.strip()] or ["http://localhost:3000"]
_app_cors_credentials = settings.CORS_ALLOW_CREDENTIALS and _cors_origins != ["*"]

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=_app_cors_credentials,
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
app.include_router(rag_router)
app.include_router(settings_router)


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME, "demo_mode": settings.DEMO_MODE}


