from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://studyforge:studyforge@localhost:5432/studyforge"
    REDIS_URL: str = "redis://localhost:6379/0"
    NVIDIA_API_KEY: str = ""
    AI_PROVIDER: str = "nvidia"
    AWS_REGION: str = "us-east-1"
    BEDROCK_CHAT_MODEL_ID: str = "anthropic.claude-3-5-sonnet-20241022-v2:0"
    BEDROCK_EMBED_MODEL_ID: str = "amazon.titan-embed-text-v2:0"
    NVIDIA_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    NVIDIA_CHAT_MODEL: str = "meta/llama-3.3-70b-instruct"
    NVIDIA_EMBED_MODEL: str = "nvidia/nv-embedqa-e5-v5"
    CHROMA_HOST: str = "chroma_server"
    CHROMA_PORT: int = 8000
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
