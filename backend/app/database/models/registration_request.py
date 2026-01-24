from ormar import Model, Integer, String, DateTime, ForeignKey
from app.database.database import base_ormar_config
from datetime import datetime
from enum import Enum
from app.database.models.user import User
from app.database.models.registration_code import RegistrationCode


class RegistrationStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class RegistrationRequest(Model):
    ormar_config = base_ormar_config.copy(tablename="registration_requests")

    id: int = Integer(primary_key=True)
    username: str = String(max_length=100)
    email: str = String(max_length=255)
    first_name: str = String(max_length=100, nullable=True)
    last_name: str = String(max_length=100, nullable=True)
    message: str = String(max_length=1000, nullable=True)
    ip_address: str = String(max_length=100, nullable=True)
    user_agent: str = String(max_length=500, nullable=True)
    status: str = String(max_length=20, default=RegistrationStatus.PENDING.value)
    registration_code: RegistrationCode = ForeignKey(RegistrationCode, nullable=True, related_name="requests")
    hashed_password: str = String(max_length=255, nullable=True)
    role: str = String(max_length=20, nullable=True)
    reviewed_by: User = ForeignKey(User, nullable=True, related_name="reviewed_requests")
    reviewed_at: datetime = DateTime(nullable=True)
    created_at: datetime = DateTime(default=datetime.utcnow)
