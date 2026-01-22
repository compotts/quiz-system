from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class GroupBase(BaseModel):
    name: str


class GroupCreate(GroupBase):
    pass


class GroupUpdate(BaseModel):
    name: Optional[str] = None


class GroupResponse(GroupBase):
    id: int
    code: str
    teacher_id: int
    created_at: datetime
    member_count: int = 0
    
    class Config:
        from_attributes = True


class GroupMemberResponse(BaseModel):
    id: int
    user_id: int
    username: Optional[str]
    email: str
    joined_at: datetime
    
    class Config:
        from_attributes = True