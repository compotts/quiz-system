from ormar import Model, Integer, String, Text, Boolean, DateTime, ForeignKey
from app.database.database import base_ormar_config
from app.database.models.user import User
from datetime import datetime


class BlogPost(Model):
    ormar_config = base_ormar_config.copy(tablename="blog_posts")

    id: int = Integer(primary_key=True)
    title: str = String(max_length=255)
    content: str = Text()
    author: User = ForeignKey(User, related_name="blog_posts")
    is_published: bool = Boolean(default=True)
    created_at: datetime = DateTime(default=datetime.utcnow)
    updated_at: datetime = DateTime(default=datetime.utcnow, onupdate=datetime.utcnow)
