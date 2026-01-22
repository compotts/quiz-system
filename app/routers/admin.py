from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
import secrets
from datetime import datetime, timedelta

from app.schemas.admin import (
    AdminInit, RegistrationCodeCreate, RegistrationCodeResponse,
    UserAdminUpdate, UserListResponse, RegistrationRequestResponse
)
from app.schemas.user import Token
from app.database.models import User, RegistrationCode, UserRole
from app.core import hash_password, create_access_token, require_admin
from app.core.registration import check_user_exists, registration_code_to_dict
from app.config import settings
from app.database.models import RegistrationRequest
from datetime import datetime

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/init", response_model=Token)
async def initialize_admin(admin_data: AdminInit):
    existing_admin = None
    existing_admin_username = None
    try:
        try:
            existing_admin = await User.objects.filter(role=UserRole.ADMIN).first()
        except:
            pass

        if existing_admin:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admin already initialized"
            )
    except:
        pass

    await check_user_exists(admin_data.email)
    
    if admin_data.username:
        try:
            try:
                existing_user_username = await User.objects.filter(username=admin_data.username).first()
            except:
                pass

            if existing_user_username:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="User with this username already exists"
                )
        except:
            pass
    
    hashed_password = hash_password(admin_data.password)
    admin_user = await User.objects.create(
        email=admin_data.email,
        first_name=admin_data.first_name,
        last_name=admin_data.last_name,
        username=admin_data.username,
        hashed_password=hashed_password,
        role=UserRole.ADMIN,
        is_active=True
    )
    
    access_token = create_access_token(
        data={"sub": str(admin_user.id), "role": admin_user.role}
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/init")
async def admin_init_status():
    """Return whether an admin user already exists (for frontend to hide init form)."""
    existing_admin = None
    try:
        existing_admin = await User.objects.filter(role=UserRole.ADMIN).first()
    except:
        pass

    return {"initialized": bool(existing_admin)}


@router.get("/users", response_model=List[UserListResponse])
async def list_users(current_user: User = Depends(require_admin)):
    users = await User.objects.all()
    return users


@router.patch("/users/{user_id}")
async def update_user(
    user_id: int,
    update_data: UserAdminUpdate,
    current_user: User = Depends(require_admin)
):
    user = await User.objects.get_or_none(id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify own account"
        )
    
    update_dict = update_data.model_dump(exclude_unset=True)
    if update_dict:
        await user.update(**update_dict)
    
    return {"message": "User updated successfully"}


@router.delete("/users/{user_id}")
async def delete_user(user_id: int, current_user: User = Depends(require_admin)):
    user = await User.objects.get_or_none(id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete own account"
        )
    
    await user.update(is_active=False)
    return {"message": "User deactivated successfully"}


@router.post("/registration-codes", response_model=RegistrationCodeResponse)
async def create_registration_code(
    code_data: RegistrationCodeCreate,
    current_user: User = Depends(require_admin)
):
    if code_data.role_type not in ["teacher", "student"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be 'teacher' or 'student'"
        )
    
    code = secrets.token_urlsafe(16)
    expires_at = datetime.utcnow() + timedelta(hours=code_data.expires_in_hours)
    
    registration_code = await RegistrationCode.objects.create(
        code=code,
        role_type=code_data.role_type,
        creator=current_user.id,
        expires_at=expires_at
    )
    
    return registration_code_to_dict(registration_code)


@router.get("/registration-codes", response_model=List[RegistrationCodeResponse])
async def list_registration_codes(current_user: User = Depends(require_admin)):
    codes = await RegistrationCode.objects.select_related(["creator", "used_by"]).all()
    return [registration_code_to_dict(code) for code in codes]


@router.get("/registration-requests", response_model=List[RegistrationRequestResponse])
async def list_registration_requests(current_user: User = Depends(require_admin)):
    requests = await RegistrationRequest.objects.select_related(["registration_code", "reviewed_by"]).all()
    result = []
    for r in requests:
        req_dict = r.model_dump(exclude={"registration_code", "reviewed_by"})
        req_dict["registration_code_id"] = r.registration_code.id if hasattr(r, 'registration_code') and r.registration_code else None
        req_dict["reviewed_by_id"] = r.reviewed_by.id if hasattr(r, 'reviewed_by') and r.reviewed_by else None
        result.append(req_dict)
    return result


@router.post("/registration-requests/{request_id}/approve")
async def approve_registration_request(request_id: int, current_user: User = Depends(require_admin)):
    req = await RegistrationRequest.objects.get_or_none(id=request_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registration request not found")
    if req.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request already processed")

    # create user
    user = await User.objects.create(
        email=req.email,
        username=req.username,
        first_name=req.first_name,
        last_name=req.last_name,
        hashed_password=req.hashed_password,
        role=req.role,
        is_active=True
    )

    # mark registration code used if present
    if hasattr(req, 'registration_code') and req.registration_code:
        await req.registration_code.update(used=True, used_by=user)

    await req.update(status="approved", reviewed_by=current_user, reviewed_at=datetime.utcnow())

    return {"message": "Registration request approved", "user_id": user.id}


@router.post("/registration-requests/{request_id}/reject")
async def reject_registration_request(request_id: int, current_user: User = Depends(require_admin)):
    req = await RegistrationRequest.objects.get_or_none(id=request_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registration request not found")
    if req.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request already processed")

    await req.update(status="rejected", reviewed_by=current_user, reviewed_at=datetime.utcnow())
    return {"message": "Registration request rejected"}


@router.delete("/registration-codes/{code_id}")
async def delete_registration_code(
    code_id: int,
    current_user: User = Depends(require_admin)
):
    code = await RegistrationCode.objects.get_or_none(id=code_id)
    if not code:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registration code not found"
        )
    
    if code.used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete used registration code"
        )
    
    await code.delete()
    return {"message": "Registration code deleted successfully"}
