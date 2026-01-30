from ormar import Model, Integer, String, ForeignKey, DateTime
from app.database.database import base_ormar_config, utc_now
from datetime import datetime
from app.database.models.user import User


class Group(Model):
    ormar_config = base_ormar_config.copy(tablename="groups")

    id: int = Integer(primary_key=True)
    name: str = String(max_length=255)
    subject: str = String(max_length=255, nullable=True)
    code: str = String(max_length=6, unique=True, index=True)
    teacher: User = ForeignKey(User, related_name="groups")
    created_at: datetime = DateTime(default=utc_now)
    updated_at: datetime = DateTime(default=utc_now)


class GroupMember(Model):
    ormar_config = base_ormar_config.copy(tablename="members")

    id: int = Integer(primary_key=True)
    group: Group = ForeignKey(Group, related_name="members")
    user: User = ForeignKey(User, related_name="group_memberships")
    joined_at: datetime = DateTime(default=utc_now)