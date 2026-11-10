import os
from pydantic_settings import BaseSettings

# Anchor the default SQLite file to the backend/ directory (parent of app/),
# NOT the process's current working directory. Without this, running the
# server from backend/ and a script from the repo root silently creates two
# different database files.
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_DEFAULT_SQLITE_PATH = os.path.join(_BACKEND_DIR, "fame_genix.db").replace("\\", "/")


def _resolve_database_url() -> str:
    raw = os.getenv("DATABASE_URL", f"sqlite:///{_DEFAULT_SQLITE_PATH}")
    if raw.startswith("sqlite:///") and (raw.endswith("./fame_genix.db") or raw.endswith("/fame_genix.db") or raw == "sqlite:///fame_genix.db"):
        return f"sqlite:///{_DEFAULT_SQLITE_PATH}"
    return raw


class Settings(BaseSettings):
    APP_NAME: str = "Fame Genix"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    SIMULATION_MODE: bool = os.getenv("SIMULATION_MODE", os.getenv("DEMO_MODE", "true")).lower() == "true"
    DEMO_MODE: bool = SIMULATION_MODE

    DATABASE_URL: str = _resolve_database_url()

    JWT_SECRET: str = os.getenv("JWT_SECRET", "415a45b44caeba25b60bb679e70654de1a71b688a97fe808640222730312be3b")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours for development
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    ALLOW_QML: bool = False

    # CORS allow-list (comma-separated). Defaults to the local dev frontend.
    # Never allow wildcard with credentials in a production medical deployment.
    CORS_ALLOW_ORIGINS: str = os.getenv("CORS_ALLOW_ORIGINS", "http://localhost:3000")
    CORS_ALLOW_CREDENTIALS: bool = os.getenv("CORS_ALLOW_CREDENTIALS", "true").lower() == "true"

    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    AI_ENABLED: bool = os.getenv("AI_ENABLED", "true").lower() == "true"
    AI_TIMEOUT_SECONDS: int = int(os.getenv("AI_TIMEOUT_SECONDS", "30"))

    # NVIDIA AI Platform (Primary AI Foundation: Nemotron SuperVL & Omni Reasoning)
    NVIDIA_API_KEY: str = os.getenv("NVIDIA_API_KEY", os.getenv("NEBIUS_API_KEY", ""))
    NVIDIA_BASE_URL: str = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
    NVIDIA_MODEL_SUPERVL: str = os.getenv("NVIDIA_MODEL_SUPERVL", "nvidia/nemotron-3.5-super-vl-120b-a12b")
    NVIDIA_MODEL_OMNI: str = os.getenv("NVIDIA_MODEL_OMNI", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning")
    NEBIUS_API_KEY: str = NVIDIA_API_KEY
    NEBIUS_BASE_URL: str = NVIDIA_BASE_URL
    NVIDIA_MODEL_REASONING: str = NVIDIA_MODEL_SUPERVL
    NVIDIA_MODEL_FAST: str = NVIDIA_MODEL_OMNI

    # Tavily Search API (Clinical Guidelines RAG)
    TAVILY_API_KEY: str = os.getenv("TAVILY_API_KEY", "")

    model_config = {
        "env_file": (
            os.path.join(_BACKEND_DIR, ".env"),
            ".env",
        ),
        "extra": "ignore"
    }

    def model_post_init(self, __context) -> None:
        if self.DATABASE_URL.startswith("sqlite:///") and (
            self.DATABASE_URL.endswith("./fame_genix.db") or self.DATABASE_URL.endswith("/fame_genix.db") or self.DATABASE_URL == "sqlite:///fame_genix.db"
        ):
            self.DATABASE_URL = f"sqlite:///{_DEFAULT_SQLITE_PATH}"


settings = Settings()
