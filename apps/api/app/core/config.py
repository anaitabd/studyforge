from enum import Enum
from typing import Any

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppEnv(str, Enum):
    local = "local"
    dev = "dev"
    staging = "staging"
    prod = "prod"


class Settings(BaseSettings):
    APP_ENV: AppEnv = AppEnv.local
    DATABASE_URL: str = "postgresql+asyncpg://studyforge:studyforge@localhost:5432/studyforge"
    REDIS_URL: str = "redis://localhost:6379/0"

    # AI provider: gemini (default) | claude_vertex
    AI_PROVIDER: str = "gemini"

    # GCP / Vertex AI — used by GeminiVertexProvider and ClaudeVertexProvider
    GCP_PROJECT_ID: str = "studyforge-495618"
    GCP_LOCATION: str = "europe-west9"
    GEMINI_CHAT_MODEL: str = "gemini-2.5-flash"
    GEMINI_EMBED_MODEL: str = "text-multilingual-embedding-002"

    # Google Cloud Storage
    GCS_BUCKET: str = "studyforge-495618-files"
    GCS_EMULATOR_HOST: str = ""  # e.g. http://localhost:4443 for fake-gcs-server

    # ChromaDB vector store
    CHROMA_HOST: str = "chroma_server"
    CHROMA_PORT: int = 8000

    # Auth (Clerk)
    CLERK_SECRET_KEY: str = ""
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: str = ""
    CLERK_WEBHOOK_SECRET: str = ""

    # Notifications (Twilio WhatsApp)
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_WHATSAPP_FROM: str = "whatsapp:+14155238886"

    # Payments (PayPal)
    PAYPAL_CLIENT_ID: str = ""
    PAYPAL_SECRET: str = ""

    # Monitoring
    SENTRY_DSN: str = ""

    # Task queue
    TASK_EXECUTION_MODE: str = "celery"

    # URLs
    API_BASE_URL: str = "http://localhost:8000"
    SECRET_KEY: str = "change-me-in-production"
    FRONTEND_URL: str = "http://localhost:3000"
    FRONTEND_URLS: Any = Field(default_factory=list)

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("FRONTEND_URLS", mode="before")
    @classmethod
    def parse_frontend_urls(cls, value: Any) -> list[str] | Any:
        import json as _json
        if value in (None, "", []):
            return []
        if isinstance(value, str):
            try:
                parsed = _json.loads(value)
                if isinstance(parsed, list):
                    return [str(u).strip() for u in parsed if str(u).strip()]
            except ValueError:
                pass
            return [u.strip() for u in value.split(",") if u.strip()]
        return value

    @property
    def cors_origins(self) -> list[str]:
        explicit = [str(url).rstrip("/") for url in self.FRONTEND_URLS]
        if explicit:
            return sorted(set(explicit))

        by_env = {
            AppEnv.local: ["http://localhost:3000", "http://127.0.0.1:3000"],
            AppEnv.dev: ["https://dev.studyforge.app"],
            AppEnv.staging: ["https://staging.studyforge.app"],
            AppEnv.prod: ["https://studyforge.app"],
        }
        fallback = str(self.FRONTEND_URL).rstrip("/")
        return sorted(set([fallback, *by_env[self.APP_ENV]]))


settings = Settings()
