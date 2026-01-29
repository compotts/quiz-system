from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from schemas import (
    UserRegisterRequest, UserLogin, Token, UserResponse,
    RegistrationRequestResponse, RefreshTokenRequest
)
from app.database.models.user import User
from app.database.models.registration_request import RegistrationRequest, RegistrationStatus
from app.utils.auth import (
    verify_password, get_password_hash, create_access_token,
    create_refresh_token, get_current_user
)
from app.utils.rate_limiter import check_login_rate_limit, check_registration_rate_limit


router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=RegistrationRequestResponse)
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

    # Проверка pending request по username
    pending_request = await RegistrationRequest.objects.get_or_none(
        username=data.username,
        status=RegistrationStatus.PENDING.value
    )
    
    # Проверка pending request по email
    pending_email_request = await RegistrationRequest.objects.get_or_none(
        email=data.email,
        status=RegistrationStatus.PENDING.value
    )
    
    if pending_request or pending_email_request:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration request already pending approval"
        )
    
    return await RegistrationRequest.objects.create(
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
        
        user_id_str: str = payload.get("sub")
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

    # Проверка существования и активности пользователя
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