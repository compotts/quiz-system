from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str
    secret_key: str
    algorithm: str = "HS256"
    version: str = "1.1"
    title: str = "API for quizzez.site"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7
    bcrypt_rounds: int = 12
    rate_limit_login: int = 50
    rate_limit_period: int = 60
    captcha_after_attempts: int = 3
    admin_init_enabled: bool = True
    max_image_size: int = 5 * 1024 * 1024
    allowed_image_types: list = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    cors_origins: list = [
        "http://localhost:5173",
        "http://localhost:4173",
        "https://quiz-system-eta.vercel.app",
        "http://192.168.68.108:5173",
        "https://quizzez.site",
    ]
    env: str = "dev"
    api_version: str = "v1" 
    
    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings():
    return Settings()


settings = get_settings()