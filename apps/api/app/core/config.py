from enum import Enum
from typing import Any

from pydantic import AnyHttpUrl, Field, field_validator
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
    # OpenAI-compatible provider (default — works with AWS Bedrock, Azure, or any OpenAI-compat endpoint)
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = ""          # leave empty to use api.openai.com
    OPENAI_CHAT_MODEL: str = "openai.gpt-oss-120b"
    OPENAI_EMBED_MODEL: str = "amazon.titan-embed-text-v2:0"

    AI_PROVIDER: str = "openai"        # openai | nvidia | bedrock | ollama

    # Ollama local settings (used when AI_PROVIDER=ollama)
    OLLAMA_BASE_URL: str = "http://localhost:11434/v1"
    OLLAMA_CHAT_MODEL: str = "llama3.2:3b"
    OLLAMA_EMBED_MODEL: str = "nomic-embed-text"

    # NVIDIA NIM — embeddings + reranking
    NVIDIA_API_KEY: str = ""
    NVIDIA_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    NVIDIA_CHAT_MODEL: str = "meta/llama-3.3-70b-instruct"
    NVIDIA_EMBED_MODEL: str = "nvidia/nv-embedqa-e5-v5"
    NVIDIA_RERANK_MODEL: str = "nvidia/nv-rerankqa-mistral-4b-v3"

    # Legacy Bedrock settings (kept for backward compat)
    AWS_REGION: str = "us-east-1"
    BEDROCK_CHAT_MODEL_ID: str = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
    BEDROCK_EMBED_MODEL_ID: str = "amazon.titan-embed-text-v2:0"
    CHROMA_HOST: str = "chroma_server"
    CHROMA_PORT: int = 8000
    # Primary S3 configuration
    S3_BUCKET: str = ""
    S3_REGION: str = "us-east-1"
    S3_ENDPOINT_URL: str = ""
    S3_KMS_KEY_ID: str = ""
    S3_AUTO_CREATE_BUCKET: bool = False
    S3_USE_AWS_MANAGED_CREDENTIALS: bool = True
    S3_SERVER_SIDE_ENCRYPTION: str = ""  # "AES256" (SSE-S3) or "aws:kms" (SSE-KMS)

    # Temporary backward-compatibility for legacy R2/MinIO env names
    R2_BUCKET: str = ""
    R2_ENDPOINT: str = ""
    R2_ACCESS_KEY: str = ""
    R2_SECRET_KEY: str = ""
    CLERK_SECRET_KEY: str = ""
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: str = ""
    CLERK_WEBHOOK_SECRET: str = ""
    SENDGRID_API_KEY: str = ""
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_WHATSAPP_FROM: str = "whatsapp:+14155238886"
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PERSONAL_MONTHLY_PRICE_ID: str = ""
    STRIPE_PERSONAL_ANNUAL_PRICE_ID: str = ""
    # Moroccan CMI payment gateway
    CMI_CLIENT_ID: str = ""
    CMI_PAYMENT_URL: str = "https://payment.cmi.co.ma/fim/est3Dgate"
    CMI_STORE_KEY: str = ""
    API_BASE_URL: str = "http://localhost:8000"
    SECRET_KEY: str = "change-me-in-production"
    FRONTEND_URL: str = "http://localhost:3000"
    FRONTEND_URLS: Any = Field(default_factory=list)
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    TASK_EXECUTION_MODE: str = "celery"  # celery | hybrid | lambda
    TASK_SQS_FILE_QUEUE_URL: str = ""
    TASK_SQS_SLIDE_QUEUE_URL: str = ""
    TASK_SQS_NOTIFICATION_QUEUE_URL: str = ""
    TASK_EVENTBRIDGE_EXAM_DEADLINE_RULE: str = ""

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
