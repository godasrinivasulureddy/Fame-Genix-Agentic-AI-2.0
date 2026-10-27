import os
from pydantic import model_validator
from pydantic_settings import BaseSettings

# Anchor the default SQLite file to the backend/ directory (parent of app/),
# NOT the process's current working directory. Without this, running the
# server from backend/ and a script from the repo root silently creates two
# different database files.
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_DEFAULT_SQLITE_PATH = os.path.join(_BACKEND_DIR, "fame_genix.db")


class Settings(BaseSettings):
    APP_NAME: str = "Fame Genix"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    SIMULATION_MODE: bool = os.getenv("SIMULATION_MODE", os.getenv("DEMO_MODE", "true")).lower() == "true"
    DEMO_MODE: bool = SIMULATION_MODE

    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{_DEFAULT_SQLITE_PATH}")

    JWT_SECRET: str = os.getenv("JWT_SECRET", "")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours for development
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    ALLOW_QML: bool = False

    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
    AI_ENABLED: bool = os.getenv("AI_ENABLED", "true").lower() == "true"
    AI_TIMEOUT_SECONDS: int = int(os.getenv("AI_TIMEOUT_SECONDS", "30"))

    # Nebius Token Factory & NVIDIA Models
    NEBIUS_API_KEY: str = os.getenv("NEBIUS_API_KEY", "")
    NEBIUS_BASE_URL: str = os.getenv("NEBIUS_BASE_URL", "https://api.tokenfactory.nebius.ai/v1")
    NVIDIA_MODEL_REASONING: str = os.getenv("NVIDIA_MODEL_REASONING", "nvidia/nemotron-4-340b-instruct")
    NVIDIA_MODEL_FAST: str = os.getenv("NVIDIA_MODEL_FAST", "nvidia/llama-3.1-nemotron-70b-instruct")

    # Tavily Search API (Clinical Guidelines RAG)
    TAVILY_API_KEY: str = os.getenv("TAVILY_API_KEY", "")

    class Config:
        env_file = (
            ".env",
            "backend/.env",
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env"),
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "backend", ".env")
        )
        extra = "ignore"

    @model_validator(mode="after")
    def _validate_jwt_secret(self):
        """Reject empty, placeholder, or weak JWT secrets in production-like environments."""
        env = self.ENVIRONMENT.lower()
        if env in ("production", "staging", "prod"):
            if len(self.JWT_SECRET) < 32 or self.JWT_SECRET in {"change-me-in-production", "your_jwt_secret_here"}:
                raise ValueError(
                    f"JWT_SECRET must be a strong 32+ character value when ENVIRONMENT={env}."
                )
        return self


settings = Settings()
