from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///../backend/quiz.db"
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    bcrypt_rounds: int = 12
    rate_limit_login: int = 50
    rate_limit_period: int = 60
    captcha_after_attempts: int = 3
    admin_init_enabled: bool = True
    cors_origins: list = ["http://localhost:3000", "http://localhost:4173", "http://localhost:8000"]
    
    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings():
    return Settings()


settings = get_settings()