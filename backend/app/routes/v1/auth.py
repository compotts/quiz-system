import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File
from schemas import (
    UserRegisterRequest, UserLogin, Token, UserResponse,
    RefreshTokenRequest, RegisterResponse, ProfileUpdate, ChangePasswordRequest
)
from app.database.models.user import User, UserRole
from app.database.models.registration_request import RegistrationRequest, RegistrationStatus
from app.database.models.system_setting import SystemSetting
from app.utils.auth import (
    verify_password, get_password_hash, create_access_token,
    create_refresh_token, get_current_user
)
from app.utils.rate_limiter import check_login_rate_limit, check_registration_rate_limit
from app.utils.audit import log_audit
from config import settings


router = APIRouter(prefix="/auth", tags=["Authentication"])

UPLOADS_AVATARS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "static" / "uploads" / "avatars"


async def _get_setting(key: str, default: str) -> bool:
    setting = await SystemSetting.objects.get_or_none(key=key)
    return setting is not None and setting.value.lower() == "true" if setting else default == "true"


async def is_auto_registration_enabled() -> bool:
    return await _get_setting("auto_registration_enabled", "false")


async def is_registration_enabled() -> bool:
    return await _get_setting("registration_enabled", "true")


async def is_maintenance_mode() -> bool:
    return await _get_setting("maintenance_mode", "false")


async def is_contact_enabled() -> bool:
    return await _get_setting("contact_enabled", "true")


async def _get_str_setting(key: str) -> str | None:
    s = await SystemSetting.objects.get_or_none(key=key)
    return s.value if s and s.value else None


async def _get_json_setting(key: str, default=None):
    import json
    s = await SystemSetting.objects.get_or_none(key=key)
    if s and s.value:
        try:
            return json.loads(s.value)
        except (json.JSONDecodeError, TypeError):
            return default
    return default


@router.get("/registration-settings")
async def get_registration_settings():
    auto_enabled = await is_auto_registration_enabled()
    reg_enabled = await is_registration_enabled()
    maintenance = await is_maintenance_mode()
    contact = await is_contact_enabled()
    home_banner_text = await _get_json_setting("home_banner_text", {})
    home_banner_style = await _get_str_setting("home_banner_style")
    return {
        "auto_registration_enabled": auto_enabled,
        "registration_enabled": reg_enabled,
        "maintenance_mode": maintenance,
        "contact_enabled": contact,
        "home_banner_text": home_banner_text or {},
        "home_banner_style": home_banner_style or "warning",
    }


@router.post("/register", response_model=RegisterResponse)
async def register(
    data: UserRegisterRequest,
    request: Request,
    _: None = Depends(check_registration_rate_limit)
):
    if not await is_registration_enabled():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Registration is currently disabled"
        )
    existing_user = await User.objects.get_or_none(username=data.username)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    existing_email = await User.objects.get_or_none(email=data.email)
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    auto_register = await is_auto_registration_enabled()

    if auto_register:
        role = UserRole.STUDENT.value
        if data.role in (UserRole.STUDENT.value, UserRole.TEACHER.value):
            role = data.role

        await log_audit(
            "register_auto",
            details={"username": data.username, "email": data.email, "role": role},
            request=request,
        )
        user = await User.objects.create(
            username=data.username,
            email=data.email,
            first_name=data.first_name,
            last_name=data.last_name,
            hashed_password=get_password_hash(data.password),
            role=role,
            is_active=True,
            registration_ip=request.client.host,
        )
        access_token = create_access_token(data={"sub": str(user.id)})
        refresh_token = create_refresh_token(data={"sub": str(user.id)})
        return RegisterResponse(
            auto_approved=True,
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
        )
    else:
        pending_request = await RegistrationRequest.objects.get_or_none(
            username=data.username,
            status=RegistrationStatus.PENDING.value
        )
        pending_email_request = await RegistrationRequest.objects.get_or_none(
            email=data.email,
            status=RegistrationStatus.PENDING.value
        )
        if pending_request or pending_email_request:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Registration request already pending approval"
            )
        reg = await RegistrationRequest.objects.create(
            username=data.username,
            email=data.email,
            first_name=data.first_name,
            last_name=data.last_name,
            message=data.message,
            hashed_password=get_password_hash(data.password),
            ip_address=request.client.host,
            user_agent=request.headers.get("user-agent"),
            status=RegistrationStatus.PENDING.value
        )
        await log_audit(
            "register_request",
            details={"username": data.username, "email": data.email},
            request=request,
        )
        return RegisterResponse(
            auto_approved=False,
            id=reg.id,
            username=reg.username,
            email=reg.email,
            first_name=reg.first_name,
            last_name=reg.last_name,
            message=reg.message,
            ip_address=reg.ip_address,
            user_agent=reg.user_agent,
            status=reg.status,
            created_at=reg.created_at,
        )


@router.post("/login", response_model=Token)
async def login(
    data: UserLogin,
    request: Request,
    _: None = Depends(check_login_rate_limit)
):
    user = await User.objects.get_or_none(username=data.username)

    if not user or not verify_password(data.password, user.hashed_password):
        await log_audit(
            "login_failed",
            details={"username": data.username},
            request=request,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        await log_audit(
            "login_failed",
            username=user.username,
            details={"reason": "account_inactive"},
            request=request,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not active. Please wait for approval."
        )

    if await is_maintenance_mode() and user.role not in (UserRole.ADMIN.value, UserRole.DEVELOPER.value):
        await log_audit(
            "login_failed",
            username=user.username,
            details={"reason": "maintenance_mode"},
            request=request,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Site is under maintenance. Only administrators can log in."
        )

    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    await log_audit(
        "login_success",
        user_id=user.id,
        username=user.username,
        resource_type="auth",
        request=request,
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_me(
    data: ProfileUpdate,
    current_user: User = Depends(get_current_user)
):
    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        return current_user

    if "email" in update_data and update_data["email"] != current_user.email:
        existing = await User.objects.get_or_none(email=update_data["email"])
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already in use"
            )

    await current_user.update(**update_data)
    await current_user.load_all()
    return current_user


@router.post("/me/avatar", response_model=UserResponse)
async def upload_avatar(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    content_type = file.content_type or ""
    if content_type not in settings.allowed_image_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Allowed types: {', '.join(settings.allowed_image_types)}"
        )
    contents = await file.read()
    if len(contents) > settings.max_image_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image must be under {settings.max_image_size} bytes"
        )
    ext = {"image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp"}.get(
        content_type, ".jpg"
    )
    filename = f"{current_user.id}_{uuid.uuid4().hex[:12]}{ext}"
    UPLOADS_AVATARS_DIR.mkdir(parents=True, exist_ok=True)
    filepath = UPLOADS_AVATARS_DIR / filename
    with open(filepath, "wb") as f:
        f.write(contents)
    url_path = f"/uploads/avatars/{filename}"
    old_url = getattr(current_user, "avatar_url", None)
    await current_user.update(avatar_url=url_path)
    await current_user.load_all()
    if old_url and old_url.startswith("/uploads/avatars/"):
        old_name = old_url.split("/")[-1]
        old_path = UPLOADS_AVATARS_DIR / old_name
        if old_path.exists():
            try:
                os.remove(old_path)
            except OSError:
                pass
    await log_audit(
        "avatar_uploaded",
        user_id=current_user.id,
        username=current_user.username,
        resource_type="auth",
        request=request,
    )
    return current_user


@router.delete("/me/avatar", response_model=UserResponse)
async def delete_avatar(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    old_url = getattr(current_user, "avatar_url", None)
    await current_user.update(avatar_url=None)
    await current_user.load_all()
    if old_url and old_url.startswith("/uploads/avatars/"):
        old_name = old_url.split("/")[-1]
        old_path = UPLOADS_AVATARS_DIR / old_name
        if old_path.exists():
            try:
                os.remove(old_path)
            except OSError:
                pass
    await log_audit(
        "avatar_deleted",
        user_id=current_user.id,
        username=current_user.username,
        resource_type="auth",
        request=request,
    )
    return current_user


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    await current_user.update(
        hashed_password=get_password_hash(data.new_password)
    )
    await log_audit(
        "password_changed",
        user_id=current_user.id,
        username=current_user.username,
        resource_type="auth",
        request=request,
    )
    return {"message": "Password updated successfully"}


@router.post("/refresh", response_model=Token)
async def refresh_token(data: RefreshTokenRequest):
    from jose import jwt, JWTError
    from config import settings
    
    try:
        payload = jwt.decode(
            data.refresh_token,
            settings.secret_key,
            algorithms=[settings.algorithm]
        )
        
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type"
            )
        
        user_id_str: str | None = payload.get("sub")
        if user_id_str is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        user_id = int(user_id_str)
        
    except (JWTError, ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

    user = await User.objects.get_or_none(id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is not active"
        )

    access_token = create_access_token(data={"sub": str(user_id)})
    new_refresh_token = create_refresh_token(data={"sub": str(user_id)})
    
    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }