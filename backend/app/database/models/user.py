from ormar import Model, Integer, String, Boolean, DateTime
from app.database.database import base_ormar_config, utc_now
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    ADMIN = "admin"
    TEACHER = "teacher"
    STUDENT = "student"


class User(Model):
    ormar_config = base_ormar_config.copy(tablename="users")

    id: int = Integer(primary_key=True)
    email: str = String(max_length=255, unique=True, index=True)
    first_name: str = String(max_length=100, nullable=True)
    last_name: str = String(max_length=100, nullable=True)
    username: str = String(max_length=100, unique=True, index=True)
    hashed_password: str = String(max_length=255)
    role: str = String(max_length=20, default=UserRole.STUDENT.value)
    is_active: bool = Boolean(default=True)
    registration_ip: str = String(max_length=100, nullable=True)
    created_at: datetime = DateTime(default=utc_now)
    updated_at: datetime = DateTime(default=utc_now)