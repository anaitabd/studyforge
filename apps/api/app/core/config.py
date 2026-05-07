from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://studyforge:studyforge@localhost:5432/studyforge"
    REDIS_URL: str = "redis://localhost:6379/0"
    NVIDIA_API_KEY: str = ""
    NVIDIA_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    NVIDIA_CHAT_MODEL: str = "meta/llama-3.3-70b-instruct"
    NVIDIA_EMBED_MODEL: str = "nvidia/nv-embedqa-e5-v5"
    CHROMA_HOST: str = "chroma_server"
    CHROMA_PORT: int = 8000
    # Primary S3 configuration
    S3_BUCKET: str = "studyforge"
    S3_REGION: str = "us-east-1"
    S3_ENDPOINT_URL: str = "http://localhost:9000"
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
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_KEY: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
