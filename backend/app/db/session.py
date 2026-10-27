from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.base import Base

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

try:
    engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
    engine.connect().close()
except Exception as e:
    print(f"[db] Could not connect to {settings.DATABASE_URL} ({e}); falling back to SQLite.")
    fallback_url = "sqlite:///./fame_genix.db"
    engine = create_engine(fallback_url, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    from app.db import models  # noqa: F401  ensure models are registered
    Base.metadata.create_all(bind=engine)

    # Safely migrate existing SQLite database tables if new columns were added
    with engine.connect() as conn:
        for col_def in [
            ("age", "INTEGER"),
            ("height_cm", "FLOAT"),
            ("weight_kg", "FLOAT"),
            ("profile_picture_url", "TEXT"),
            ("public_id", "TEXT"),
            ("allergies", "TEXT"),
            ("family_history", "TEXT"),
            ("blood_group", "TEXT"),
            ("emergency_contact_relationship", "TEXT"),
            ("secondary_contact_name", "TEXT"),
            ("secondary_contact_phone", "TEXT"),
            ("secondary_contact_relationship", "TEXT"),
        ]:
            try:
                conn.execute(text(f"ALTER TABLE patients ADD COLUMN {col_def[0]} {col_def[1]}"))
                conn.commit()
            except Exception:
                pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
