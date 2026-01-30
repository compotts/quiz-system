from ormar import Model, Integer, String, Boolean, DateTime, ForeignKey
from app.database.database import base_ormar_config, utc_now
from datetime import datetime
from app.database.models.user import User


class RegistrationCode(Model):
    ormar_config = base_ormar_config.copy(tablename="reg_codes")

    id: int = Integer(primary_key=True)
    code: str = String(max_length=50, unique=True, index=True)
    role_type: str = String(max_length=20)
    creator: User = ForeignKey(User, nullable=True, related_name="created_codes")
    used: bool = Boolean(default=False)
    used_by: User = ForeignKey(User, nullable=True, related_name="used_codes")
    expires_at: datetime = DateTime()
    created_at: datetime = DateTime(default=utc_now)
