from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://studyforge:studyforge@localhost:5432/studyforge"
    REDIS_URL: str = "redis://localhost:6379/0"
    NVIDIA_API_KEY: str = ""
    NVIDIA_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    NVIDIA_CHAT_MODEL: str = "deepseek-ai/deepseek-r1"
    NVIDIA_EMBED_MODEL: str = "nvidia/nv-embedqa-e5-v5"
    CHROMA_PATH: str = "./chroma_db"
    R2_BUCKET: str = "studyforge"
    R2_ENDPOINT: str = "http://localhost:9000"
    R2_ACCESS_KEY: str = "minioadmin"
    R2_SECRET_KEY: str = "minioadmin"
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
