from ormar import Model, Integer, String, Text, DateTime
from app.database.database import base_ormar_config, utc_now
from datetime import datetime
from typing import Optional


class AuditLog(Model):
    ormar_config = base_ormar_config.copy(tablename="audit_logs")

    id: int = Integer(primary_key=True, autoincrement=True)
    created_at: datetime = DateTime(default=utc_now)
    user_id: Optional[int] = Integer(nullable=True)
    username: Optional[str] = String(max_length=255, nullable=True)
    action: str = String(max_length=100)
    resource_type: Optional[str] = String(max_length=50, nullable=True)
    resource_id: Optional[str] = String(max_length=100, nullable=True)
    details: Optional[str] = Text(nullable=True)
    ip_address: Optional[str] = String(max_length=100, nullable=True)
    user_agent: Optional[str] = String(max_length=500, nullable=True)
