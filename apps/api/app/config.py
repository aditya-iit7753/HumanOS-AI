from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "HumanOS AI"
    database_url: str = "postgresql+psycopg://humanos:humanos_dev_password@localhost:5432/humanos"
    openai_api_key: str = ""
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60 * 24 * 7
    cors_origins: str = "http://localhost:3000"
    cors_origin_regex: str = ""
    clerk_jwks_url: str = ""
    clerk_issuer: str = ""
    clerk_jwt_audience: str = ""
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str = ""
    qdrant_collection: str = "humanos_memories"
    qdrant_document_collection: str = "humanos_documents"
    openai_chat_model: str = "gpt-4.1-mini"
    openai_embedding_model: str = "text-embedding-3-small"
    openai_memory_model: str = "gpt-4.1-mini"
    app_url: str = "http://localhost:3000"
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_pro: str = ""
    stripe_price_premium: str = ""
    stripe_price_enterprise: str = ""
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""
    razorpay_plan_starter: str = ""
    razorpay_plan_pro: str = ""
    razorpay_plan_premium: str = ""
    razorpay_plan_enterprise: str = ""
    admin_emails: str = ""
    rate_limit_per_minute: int = 120
    auth_rate_limit_per_minute: int = 20
    max_request_bytes: int = 10 * 1024 * 1024

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8-sig", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def admin_email_list(self) -> list[str]:
        return [email.strip().lower() for email in self.admin_emails.split(",") if email.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()