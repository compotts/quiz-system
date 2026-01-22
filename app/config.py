from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )
    
    database_url: str = Field(default="sqlite+aiosqlite:///./quiz.db", validation_alias="DATABASE_URL")
    secret_key: str = Field(default="123456789", validation_alias="SECRET_KEY")
    app_name: str = Field(default="vpm quizz system", validation_alias="APP_NAME")
    debug: bool = Field(default=True, validation_alias="DEBUG")
    api_prefix: str = Field(default="/api", validation_alias="API_PREFIX")
    app_version: str = Field(default="0.0.1", validation_alias="APP_VERSION")


settings = Settings()
