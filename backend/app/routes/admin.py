from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from schemas import (
    AdminInitRequest, UserResponse, RegistrationRequestResponse,
    ReviewRegistrationRequest, AdminUpdateUserRequest, GroupResponse,
    AdminSettingsResponse, AdminSettingsUpdate
)
from app.database.models.user import User, UserRole
from app.database.models.group import Group, GroupMember
from app.database.models.registration_request import RegistrationRequest, RegistrationStatus
from app.database.models.system_setting import SystemSetting
from app.utils.auth import get_password_hash, get_current_admin
from app.database.database import utc_now
from config import settings

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/can-initialize", response_model=bool)
async def can_initialize():
    users_count = await User.objects.count()
    return users_count == 0


@router.post("/init", response_model=UserResponse)
async def initialize_admin(data: AdminInitRequest):
    if not settings.admin_init_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin initialization is disabled"
        )
    users_count = await User.objects.count()
    if users_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin already exists. This endpoint is disabled."
        )
    hashed_password = get_password_hash(data.password)
    
    admin = await User.objects.create(
        username=data.username,
        email=data.email,
        hashed_password=hashed_password,
        first_name=data.first_name,
        last_name=data.last_name,
        role=UserRole.ADMIN.value,
        is_active=True
    )
    
    return admin


@router.get("/settings", response_model=AdminSettingsResponse)
async def get_settings(current_admin: User = Depends(get_current_admin)):
    setting = await SystemSetting.objects.get_or_none(key="auto_registration_enabled")
    enabled = setting is not None and setting.value.lower() == "true"
    return AdminSettingsResponse(auto_registration_enabled=enabled)


@router.patch("/settings", response_model=AdminSettingsResponse)
async def update_settings(
    data: AdminSettingsUpdate,
    current_admin: User = Depends(get_current_admin)
):
    if data.auto_registration_enabled is not None:
        setting = await SystemSetting.objects.get_or_none(key="auto_registration_enabled")
        value = "true" if data.auto_registration_enabled else "false"
        if setting:
            await setting.update(value=value)
        else:
            await SystemSetting.objects.create(key="auto_registration_enabled", value=value)
    setting = await SystemSetting.objects.get_or_none(key="auto_registration_enabled")
    enabled = setting is not None and setting.value.lower() == "true"
    return AdminSettingsResponse(auto_registration_enabled=enabled)


@router.get("/registration-requests")
async def get_registration_requests(
    status_filter: str = None,
    page: int = 1,
    per_page: int = 10,
    current_admin: User = Depends(get_current_admin)
):
    query = RegistrationRequest.objects

    if status_filter:
        if status_filter not in [s.value for s in RegistrationStatus]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status filter"
            )
        query = query.filter(status=status_filter)

    total = await query.count()
    offset = (page - 1) * per_page
    requests = await query.order_by("-created_at").offset(offset).limit(per_page).all()
    total_pages = (total + per_page - 1) // per_page if per_page > 0 else 0

    return {
        "requests": requests,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": total_pages,
    }


@router.post("/registration-requests/approve-all")
async def approve_all_registration_requests(
    role: UserRole = UserRole.STUDENT,
    current_admin: User = Depends(get_current_admin)
):
    pending = await RegistrationRequest.objects.filter(
        status=RegistrationStatus.PENDING.value
    ).all()
    approved = 0
    for reg_request in pending:
        try:
            user = await User.objects.create(
                username=reg_request.username,
                email=reg_request.email,
                first_name=reg_request.first_name,
                last_name=reg_request.last_name,
                hashed_password=reg_request.hashed_password,
                role=role.value,
                is_active=True,
                registration_ip=reg_request.ip_address
            )

            await reg_request.update(
                status=RegistrationStatus.APPROVED.value,
                reviewed_by=current_admin,
                reviewed_at=utc_now()
            )
        except:
            pass
        
        approved += 1
    return {"message": f"Approved {approved} registration requests", "approved": approved}


@router.post("/registration-requests/{request_id}/review")
async def review_registration_request(
    request_id: int,
    review_data: ReviewRegistrationRequest,
    current_admin: User = Depends(get_current_admin)
):
    reg_request = await RegistrationRequest.objects.get_or_none(id=request_id)
    
    if not reg_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registration request not found"
        )
    
    if reg_request.status != RegistrationStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request already reviewed"
        )
    
    if review_data.approve:
        user = await User.objects.create(
            username=reg_request.username,
            email=reg_request.email,
            first_name=reg_request.first_name,
            last_name=reg_request.last_name,
            hashed_password=reg_request.hashed_password,
            role=review_data.role.value if review_data.role else UserRole.STUDENT.value,
            is_active=True,
            registration_ip=reg_request.ip_address
        )
        await reg_request.update(
            status=RegistrationStatus.APPROVED.value,
            reviewed_by=current_admin,
            reviewed_at=utc_now()
        )
        return {"message": "User approved and created", "user_id": user.id}
    else:
        await reg_request.update(
            status=RegistrationStatus.REJECTED.value,
            reviewed_by=current_admin,
            reviewed_at=utc_now()
        )
        return {"message": "Registration request rejected"}


@router.get("/users")
async def get_all_users(
    page: int = 1,
    per_page: int = 10,
    search: str = None,
    search_field: str = None, 
    role_filter: str = None,
    status_filter: str = None,
    current_admin: User = Depends(get_current_admin)
):
    query = User.objects
    
    if search and search_field:
        search_term = search.lower()
        if search_field == "username":
            query = query.filter(username__icontains=search_term)
        elif search_field == "email":
            query = query.filter(email__icontains=search_term)
        elif search_field == "first_name":
            query = query.filter(first_name__icontains=search_term)
        elif search_field == "last_name":
            query = query.filter(last_name__icontains=search_term)
        elif search_field == "all":
            all_users = await User.objects.order_by("-created_at").all()
            filtered = [
                u for u in all_users
                if search_term in (u.username or "").lower()
                or search_term in (u.email or "").lower()
                or search_term in (u.first_name or "").lower()
                or search_term in (u.last_name or "").lower()
            ]
            if role_filter and role_filter in [r.value for r in UserRole]:
                filtered = [u for u in filtered if u.role == role_filter]
            if status_filter == "active":
                filtered = [u for u in filtered if u.is_active]
            elif status_filter == "inactive":
                filtered = [u for u in filtered if not u.is_active]
            
            total = len(filtered)
            start = (page - 1) * per_page
            end = start + per_page
            users = filtered[start:end]
            
            return {
                "users": users,
                "total": total,
                "page": page,
                "per_page": per_page,
                "total_pages": (total + per_page - 1) // per_page
            }
    
    if role_filter and role_filter in [r.value for r in UserRole]:
        query = query.filter(role=role_filter)
    
    if status_filter == "active":
        query = query.filter(is_active=True)
    elif status_filter == "inactive":
        query = query.filter(is_active=False)
    
    total = await query.count()
    
    offset = (page - 1) * per_page
    users = await query.order_by("-created_at").offset(offset).limit(per_page).all()
    
    return {
        "users": users,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page
    }


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user_details(
    user_id: int,
    current_admin: User = Depends(get_current_admin)
):
    user = await User.objects.get_or_none(id=user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user_details(
    user_id: int,
    data: AdminUpdateUserRequest,
    current_admin: User = Depends(get_current_admin)
):
    user = await User.objects.get_or_none(id=user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    update_fields = {}
    if data.username is not None:
        existing = await User.objects.get_or_none(username=data.username)
        if existing and existing.id != user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already in use"
            )
        update_fields["username"] = data.username
    if data.email is not None:
        update_fields["email"] = data.email
    if data.first_name is not None:
        update_fields["first_name"] = data.first_name
    if data.last_name is not None:
        update_fields["last_name"] = data.last_name

    if update_fields:
        await user.update(**update_fields)
        user = await User.objects.get_or_none(id=user_id)

    return user


@router.get("/users/{user_id}/groups", response_model=List[GroupResponse])
async def get_user_groups(
    user_id: int,
    current_admin: User = Depends(get_current_admin)
):
    user = await User.objects.get_or_none(id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    memberships = await GroupMember.objects.select_related("group__teacher").filter(
        user=user
    ).all()
    result = []
    for membership in memberships:
        group = membership.group
        member_count = await GroupMember.objects.filter(group=group).count()
        teacher_full_name = (
            f"{group.teacher.first_name} {group.teacher.last_name}".strip()
            if (group.teacher.first_name or group.teacher.last_name)
            else group.teacher.username
        )
        result.append({
            **group.dict(),
            "teacher_id": group.teacher.id,
            "teacher_name": teacher_full_name,
            "member_count": member_count,
        })
    return result


@router.patch("/users/{user_id}/role")
async def change_user_role(
    user_id: int,
    new_role: UserRole,
    current_admin: User = Depends(get_current_admin)
):
    user = await User.objects.get_or_none(id=user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    if user.id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own role"
        )
    
    await user.update(role=new_role.value)
    
    return {"message": f"User role changed to {new_role.value}"}


@router.patch("/users/{user_id}/status")
async def toggle_user_status(
    user_id: int,
    current_admin: User = Depends(get_current_admin)
):
    user = await User.objects.get_or_none(id=user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if user.id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate yourself"
        )
    
    await user.update(is_active=not user.is_active)
    
    return {"message": f"User {'activated' if user.is_active else 'deactivated'}"}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    current_admin: User = Depends(get_current_admin)
):
    user = await User.objects.get_or_none(id=user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if user.id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself"
        )
    
    await user.delete()
    
    return {"message": "User deleted successfully"}