from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.database.models import UserRole


class AdminInit(BaseModel):
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    password: str
    username: Optional[str] = None


class RegistrationCodeCreate(BaseModel):
    role_type: str
    expires_in_hours: int = 24


class RegistrationCodeResponse(BaseModel):
    id: int
    code: str
    role_type: str
    creator_id: Optional[int]
    used: bool
    used_by_id: Optional[int]
    expires_at: datetime
    created_at: datetime
    
    class Config:
        from_attributes = True


class RegistrationRequestResponse(BaseModel):
    id: int
    email: str
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = None
    status: str
    registration_code_id: Optional[int] = None
    reviewed_by_id: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class UserAdminUpdate(BaseModel):
    is_active: Optional[bool] = None
    role: Optional[UserRole] = None


class UserListResponse(BaseModel):
    id: int
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str]
    role: UserRole
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True
