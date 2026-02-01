from fastapi import APIRouter, Depends, HTTPException, status, Request
from schemas import (
    UserRegisterRequest, UserLogin, Token, UserResponse,
    RefreshTokenRequest, RegisterResponse
)
from app.database.models.user import User, UserRole
from app.database.models.registration_request import RegistrationRequest, RegistrationStatus
from app.database.models.system_setting import SystemSetting
from app.utils.auth import (
    verify_password, get_password_hash, create_access_token,
    create_refresh_token, get_current_user
)
from app.utils.rate_limiter import check_login_rate_limit, check_registration_rate_limit


router = APIRouter(prefix="/auth", tags=["Authentication"])


async def is_auto_registration_enabled() -> bool:
    setting = await SystemSetting.objects.get_or_none(key="auto_registration_enabled")
    return setting is not None and setting.value.lower() == "true"


@router.get("/registration-settings")
async def get_registration_settings():
    enabled = await is_auto_registration_enabled()
    return {"auto_registration_enabled": enabled}


@router.post("/register", response_model=RegisterResponse)
async def register(
    data: UserRegisterRequest,
    request: Request,
    _: None = Depends(check_registration_rate_limit)
):
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
    _: None = Depends(check_login_rate_limit)
):
    user = await User.objects.get_or_none(username=data.username)
    
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not active. Please wait for approval."
        )
    
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


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