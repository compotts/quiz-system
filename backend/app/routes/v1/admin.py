from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List
from schemas import (
    AdminInitRequest, UserResponse, RegistrationRequestResponse,
    ReviewRegistrationRequest, AdminUpdateUserRequest, GroupResponse,
    AdminSettingsResponse, AdminSettingsUpdate, AdminStatsResponse, AuditLogResponse
)
from app.database.models.user import User, UserRole
from app.database.models.audit_log import AuditLog
from app.database.models.group import Group, GroupMember
from app.database.models.quiz import Quiz, Question, Option
from app.database.models.attempt import QuizAttempt, Answer
from app.database.models.registration_request import RegistrationRequest, RegistrationStatus
from app.database.models.contact_message import ContactMessage
from app.database.models.system_setting import SystemSetting
from app.utils.auth import get_password_hash, get_current_admin
from app.database.database import utc_now
from app.utils.audit import log_audit
from config import settings

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/can-initialize", response_model=bool)
async def can_initialize():
    users_count = await User.objects.count()
    return users_count == 0


@router.post("/init", response_model=UserResponse)
async def initialize_admin(data: AdminInitRequest, request: Request):
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
    await log_audit(
        "admin_init",
        user_id=admin.id,
        username=admin.username,
        resource_type="auth",
        details={"email": admin.email},
        request=request,
    )
    return admin


def _setting_bool(setting) -> bool:
    return setting is not None and setting.value.lower() == "true"


async def _get_bool_setting(key: str, default: bool = False) -> bool:
    s = await SystemSetting.objects.get_or_none(key=key)
    return _setting_bool(s) if s else default


async def _set_bool_setting(key: str, value: bool):
    s = await SystemSetting.objects.get_or_none(key=key)
    v = "true" if value else "false"
    if s:
        await s.update(value=v)
    else:
        await SystemSetting.objects.create(key=key, value=v)


async def _get_str_setting(key: str, default: str | None = None) -> str | None:
    s = await SystemSetting.objects.get_or_none(key=key)
    return (s.value if s and s.value else None) or default


async def _set_str_setting(key: str, value: str | None):
    v = (value or "").strip() or ""
    s = await SystemSetting.objects.get_or_none(key=key)
    if s:
        await s.update(value=v)
    else:
        await SystemSetting.objects.create(key=key, value=v)


async def _get_json_setting(key: str, default=None):
    import json
    s = await SystemSetting.objects.get_or_none(key=key)
    if s and s.value:
        try:
            return json.loads(s.value)
        except (json.JSONDecodeError, TypeError):
            return default
    return default


async def _set_json_setting(key: str, v):
    import json
    s = await SystemSetting.objects.get_or_none(key=key)
    json_str = json.dumps(v, ensure_ascii=False) if v else ""
    if s:
        await s.update(value=json_str)
    else:
        await SystemSetting.objects.create(key=key, value=json_str)


@router.get("/settings", response_model=AdminSettingsResponse)
async def get_settings(current_admin: User = Depends(get_current_admin)):
    auto_reg = await _get_bool_setting("auto_registration_enabled", False)
    reg_enabled = await _get_bool_setting("registration_enabled", True)
    maintenance = await _get_bool_setting("maintenance_mode", False)
    contact = await _get_bool_setting("contact_enabled", True)
    home_banner_text = await _get_json_setting("home_banner_text")
    home_banner_style = await _get_str_setting("home_banner_style")
    return AdminSettingsResponse(
        auto_registration_enabled=auto_reg,
        registration_enabled=reg_enabled,
        maintenance_mode=maintenance,
        contact_enabled=contact,
        home_banner_text=home_banner_text or None,
        home_banner_style=home_banner_style or None,
    )


@router.patch("/settings", response_model=AdminSettingsResponse)
async def update_settings(
    data: AdminSettingsUpdate,
    request: Request,
    current_admin: User = Depends(get_current_admin)
):
    if data.auto_registration_enabled is not None:
        await _set_bool_setting("auto_registration_enabled", data.auto_registration_enabled)
    if data.registration_enabled is not None:
        await _set_bool_setting("registration_enabled", data.registration_enabled)
    if data.maintenance_mode is not None:
        await _set_bool_setting("maintenance_mode", data.maintenance_mode)
    if data.contact_enabled is not None:
        await _set_bool_setting("contact_enabled", data.contact_enabled)
    payload = data.model_dump(exclude_unset=True)
    if "home_banner_text" in payload:
        await _set_json_setting("home_banner_text", payload["home_banner_text"] or {})
    if "home_banner_style" in payload:
        await _set_str_setting("home_banner_style", payload["home_banner_style"] or "warning")
    auto_reg = await _get_bool_setting("auto_registration_enabled", False)
    reg_enabled = await _get_bool_setting("registration_enabled", True)
    maintenance = await _get_bool_setting("maintenance_mode", False)
    contact = await _get_bool_setting("contact_enabled", True)
    home_banner_text = await _get_json_setting("home_banner_text")
    home_banner_style = await _get_str_setting("home_banner_style")
    await log_audit(
        "settings_updated",
        user_id=current_admin.id,
        username=current_admin.username,
        resource_type="settings",
        details={
            "auto_registration_enabled": auto_reg,
            "registration_enabled": reg_enabled,
            "maintenance_mode": maintenance,
            "contact_enabled": contact,
        },
        request=request,
    )
    return AdminSettingsResponse(
        auto_registration_enabled=auto_reg,
        registration_enabled=reg_enabled,
        maintenance_mode=maintenance,
        contact_enabled=contact,
        home_banner_text=home_banner_text or None,
        home_banner_style=home_banner_style or None,
    )


@router.get("/stats", response_model=AdminStatsResponse)
async def get_admin_stats(current_admin: User = Depends(get_current_admin)):
    users_total = await User.objects.count()
    users_admin = await User.objects.filter(role=UserRole.ADMIN.value).count()
    users_teacher = await User.objects.filter(role=UserRole.TEACHER.value).count()
    users_student = await User.objects.filter(role=UserRole.STUDENT.value).count()
    groups_count = await Group.objects.count()
    quizzes_count = await Quiz.objects.count()
    pending_requests_count = await RegistrationRequest.objects.filter(
        status=RegistrationStatus.PENDING.value
    ).count()
    unread_messages_count = await ContactMessage.objects.filter(is_read=False).count()
    total_messages_count = await ContactMessage.objects.count()
    recent_logs = await AuditLog.objects.order_by("-created_at").limit(10).all()
    return AdminStatsResponse(
        users_total=users_total,
        users_admin=users_admin,
        users_teacher=users_teacher,
        users_student=users_student,
        groups_count=groups_count,
        quizzes_count=quizzes_count,
        pending_requests_count=pending_requests_count,
        unread_messages_count=unread_messages_count,
        total_messages_count=total_messages_count,
        recent_logs=[AuditLogResponse.model_validate(log) for log in recent_logs],
    )


@router.get("/audit-logs", response_model=dict)
async def get_audit_logs(
    page: int = 1,
    per_page: int = 50,
    action: str = None,
    resource_type: str = None,
    user_id: int = None,
    search: str = None,
    search_field: str = None,
    current_admin: User = Depends(get_current_admin)
):
    query = AuditLog.objects
    if action:
        query = query.filter(action=action)
    if resource_type:
        query = query.filter(resource_type=resource_type)
    if user_id is not None:
        query = query.filter(user_id=user_id)
    if search and search_field:
        term = search.strip().lower()
        if search_field == "username":
            query = query.filter(username__icontains=term)
        elif search_field == "ip":
            query = query.filter(ip_address__icontains=term)
        elif search_field == "all":
            from ormar.queryset.clause import or_
            query = query.filter(or_(username__icontains=term, ip_address__icontains=term))
    total = await query.count()
    offset = (page - 1) * per_page
    logs = await query.order_by("-created_at").offset(offset).limit(per_page).all()
    total_pages = (total + per_page - 1) // per_page if per_page > 0 else 0
    return {
        "logs": [AuditLogResponse.model_validate(log) for log in logs],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": total_pages,
    }


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
    request: Request,
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
    await log_audit(
        "registration_approve_all",
        user_id=current_admin.id,
        username=current_admin.username,
        resource_type="registration",
        details={"approved": approved, "role": role.value},
        request=request,
    )
    return {"message": f"Approved {approved} registration requests", "approved": approved}


@router.post("/registration-requests/{request_id}/review")
async def review_registration_request(
    request_id: int,
    review_data: ReviewRegistrationRequest,
    request: Request,
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
        await log_audit(
            "registration_approved",
            user_id=current_admin.id,
            username=current_admin.username,
            resource_type="registration",
            resource_id=str(request_id),
            details={"target_username": reg_request.username, "role": user.role},
            request=request,
        )
        return {"message": "User approved and created", "user_id": user.id}
    else:
        await reg_request.update(
            status=RegistrationStatus.REJECTED.value,
            reviewed_by=current_admin,
            reviewed_at=utc_now()
        )
        await log_audit(
            "registration_rejected",
            user_id=current_admin.id,
            username=current_admin.username,
            resource_type="registration",
            resource_id=str(request_id),
            details={"target_username": reg_request.username},
            request=request,
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
    request: Request,
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
        await log_audit(
            "user_updated",
            user_id=current_admin.id,
            username=current_admin.username,
            resource_type="user",
            resource_id=str(user_id),
            details={"target_username": user.username, "fields": list(update_fields.keys())},
            request=request,
        )

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
    request: Request,
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

    await log_audit(
        "user_role_changed",
        user_id=current_admin.id,
        username=current_admin.username,
        resource_type="user",
        resource_id=str(user_id),
        details={"target_username": user.username, "new_role": new_role.value},
        request=request,
    )
    
    return {"message": f"User role changed to {new_role.value}"}


@router.patch("/users/{user_id}/status")
async def toggle_user_status(
    user_id: int,
    request: Request,
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

    await log_audit(
        "user_status_toggled",
        user_id=current_admin.id,
        username=current_admin.username,
        resource_type="user",
        resource_id=str(user_id),
        details={"target_username": user.username, "is_active": user.is_active},
        request=request,
    )
    
    return {"message": f"User {'activated' if user.is_active else 'deactivated'}"}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    request: Request,
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
    
    deleted_username = user.username
    await user.delete()

    await log_audit(
        "user_deleted",
        user_id=current_admin.id,
        username=current_admin.username,
        resource_type="user",
        resource_id=str(user_id),
        details={"deleted_username": deleted_username},
        request=request,
    )
    
    return {"message": "User deleted successfully"}


@router.post("/experimental-cleanup")
async def experimental_cleanup(
    request: Request,
    current_admin: User = Depends(get_current_admin)
):
    if current_admin.id != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only developer can perform this action"
        )

    quizzes = await Quiz.objects.all()
    deleted_quizzes = 0
    for quiz in quizzes:
        attempts = await QuizAttempt.objects.filter(quiz=quiz).all()
        for attempt in attempts:
            await Answer.objects.filter(attempt=attempt).delete()
        await QuizAttempt.objects.filter(quiz=quiz).delete()
        questions = await Question.objects.filter(quiz=quiz).all()
        for question in questions:
            await Option.objects.filter(question=question).delete()
        await Question.objects.filter(quiz=quiz).delete()
        await quiz.delete()
        deleted_quizzes += 1

    await log_audit(
        "experimental_cleanup",
        user_id=current_admin.id,
        username=current_admin.username,
        resource_type="quiz",
        details={"deleted_quizzes": deleted_quizzes},
        request=request,
    )
    return {"message": "Experimental cleanup completed", "deleted_quizzes": deleted_quizzes}