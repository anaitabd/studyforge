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
    OPENAI_API_KEY: str = "bedrock-api-key-YmVkcm9jay5hbWF6b25hd3MuY29tLz9BY3Rpb249Q2FsbFdpdGhCZWFyZXJUb2tlbiZYLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFTSUEzMkFRVkpDVjdQS0dJTTZPJTJGMjAyNjA1MTAlMkZ1cy1lYXN0LTElMkZiZWRyb2NrJTJGYXdzNF9yZXF1ZXN0JlgtQW16LURhdGU9MjAyNjA1MTBUMTQ0NDExWiZYLUFtei1FeHBpcmVzPTQzMjAwJlgtQW16LVNlY3VyaXR5LVRva2VuPUlRb0piM0pwWjJsdVgyVmpFRGNhQ1hWekxXVmhjM1F0TVNKSU1FWUNJUURGQU01dUFrNXVad3dJRHN1MWJuaW1paWhkTVVEOG5zNzJFekhDZHJSaHJnSWhBUGMwJTJCOWZnV0VnZU5zVElRSHVJcXJQdU04WHhJQ1BJWVVNakhwT2FxYk1WS3NJRENBQVFBQm9NT0RFeE56Z3pOelk0TWpNMUlnemVmZDVUNmpjVE9LMk5GQlVxbndQNkdNd3pSVHhQOXVNbmpuS3RNJTJCYUlWU3VDQ3lWNVBlUjBmcUdBWGc3NHBjSGRuY1o3aXdxVnRiMG0zUzBJUjRiclhBdGQlMkJTelc0RWRWV01zQkFIdVJsU3JJUFdmWnFVRnE1ZFQyejAlMkYyJTJCTmI5Sk9VdyUyRlBSR09UeVdIcXl4NHQ0NmVEWVNHTzNiRUFneDdNZnB4SU1Oeng1WEZhV01iZ0NySDNUUDJta3JJR2JZbklCZWp3ZHQ3VHB1ckR1MGoyV003ZVpOaDlEc1ptdFZSdElRVUk5NTllWUcwbiUyRkJzRWlVc3lENUhJb3JnWEsxNzlDJTJCNiUyQkhhWTdNRFclMkZmQXB1VWt1WVBrMk1GJTJCZmltJTJGNnMzckRyRXg2eVZkaGZiWTElMkZlbHVSaUk3QjhEMWVnSXBxcE1mT3Boem1qYVFZb2xpUERWM0U2JTJCSklOSWN1N2dqMEwwb0x6S09NcDNtMmRZM0FRTW9KbTcwbTA3Vlpnd3NveHEzaHA3OGpoRVFPNVNta3dwWFJYaU5LbDFibTk5eGUyd2dsbEpGcGx0bGRKUEM1JTJGUldYNmx0dHphYXJrY0JLTWJDR0NWUXlRVmNYMWNYNTZKZ0ZDYTRLbSUyQms1NkcyVSUyRjJNMERZVHI4eDVhNXhtc0MyaUxaVlhFWVM4TVNRdG5iWWY5NXdyZUxpTEloM0tYNTd4cG1waSUyRkxUNDYxcnhpZHkxcjlBeGxWazZZcUpnSjEyU3VkRExzVDNNTDZ4Z3RBR090MENvZmx5M1UxclJYMnlJcGhwSHZqUFdJQWlRaW1JTjUya0ZqUDdLZVkzeFF3TlhwMHpkQVpVRm1qVUc3c2tiN1ZnbG1odyUyQlhrbzYyZjJxeWtPazE5cU1BQXolMkYlMkZLdFpOZEM0YXlZSmxVMXJ1WSUyRnFHV2JzUEVMd1JFd1pDJTJGNHVneEtaeGFTRUxnaXdrQnQ2NWNGT1NWTnhYWnNQeFc5M1hUNWVSZGpKQm1EQVNpb2Zjb2NENGxlN2VkTFQ4VDdDRzlsaFpHRzZ5cGhQb045bnV5ZW9odWFMOUlDaEx0Um9JWWVZd3phY2RmYmlna2FiUmQ3WkZWU1ZSNVByQUdvVTNyU0clMkZOWiUyRmFBQnpJak1NMUtjUHJGV1Q4ektOVWZlenZGMVBZR2d3NzBTekN3JTJCVlpTMWlQQkcyczhFRlhDVGdyVW1EYzVrYVRjZXJ3TGpGQlZ3dWNSMW5LbVpPRkluUzh3OWlPSGMzWGhJM3hYNVRseGxKejk5aUJya05QaXV6MnZjQmluRndIVWF0cFd1ejdhRUZyJTJGT1lMeEpqRmxaemFUSmc0RmV3dmx6a0N1dyUyQlNpJTJGJTJGbW0wMjRVNkdzUjhSaUpEUE92a1B1TlJpcHpySWVUNjZBJTNEJTNEJlgtQW16LVNpZ25hdHVyZT0zOTRlODE5NGI5MjQ2ZjRkMThiZWViZGYzNTc5MzJjMDZhNTE0YWE5ZTk2Mjk0YWJiMTg3ZTRhOTY5NmExMGY4JlgtQW16LVNpZ25lZEhlYWRlcnM9aG9zdCZWZXJzaW9uPTE="
    OPENAI_BASE_URL: str = "https://bedrock-mantle.us-east-1.api.aws/v1"          # leave empty to use api.openai.com
    OPENAI_CHAT_MODEL: str = "openai.gpt-oss-120b"
    OPENAI_EMBED_MODEL: str = "amazon.titan-embed-text-v2:0"

    AI_PROVIDER: str = "openai"        # openai | nvidia | bedrock

    # Legacy NVIDIA settings (kept for backward compat)
    NVIDIA_API_KEY: str = ""
    NVIDIA_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    NVIDIA_CHAT_MODEL: str = "meta/llama-3.3-70b-instruct"
    NVIDIA_EMBED_MODEL: str = "nvidia/nv-embedqa-e5-v5"

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
    CLERK_SECRET_KEY: str = "sk_test_mnerEkX6KyXArpVpLpKgkNpJKzSKqckNaDFJQaRAQ9"
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: str ="pk_test_aG9seS1kb2xwaGluLTc2LmNsZXJrLmFjY291bnRzLmRldiQ"
    CLERK_WEBHOOK_SECRET: str = ""
    SENDGRID_API_KEY: str = ""
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_WHATSAPP_FROM: str = "whatsapp:+14155238886"
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PERSONAL_MONTHLY_PRICE_ID: str = ""
    STRIPE_PERSONAL_ANNUAL_PRICE_ID: str = ""
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
