from ormar import Integer, String, DateTime, Text, Boolean, Model
from app.database.database import base_ormar_config
from datetime import datetime


class ContactMessage(Model):
    ormar_config = base_ormar_config.copy(tablename="contact_messages")

    id: int = Integer(primary_key=True)
    message: str = Text()
    user_id: int = Integer(nullable=True)
    username: str = String(max_length=100, nullable=True)
    email: str = String(max_length=255, nullable=True)
    ip_address: str = String(max_length=45)
    user_agent: str = String(max_length=500, nullable=True)
    is_read: bool = Boolean(default=False)
    created_at: datetime = DateTime(default=datetime.utcnow)
