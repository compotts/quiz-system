from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import settings
from app.database.models.user import User, UserRole

security = HTTPBearer(auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password.startswith("$2b$"):
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    password_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt(rounds=settings.bcrypt_rounds)
    return bcrypt.hashpw(password_bytes, salt).decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = None
    auth_header = request.headers.get("Authorization")
    if auth_header and (auth_header.startswith("Bearer ") or auth_header.startswith("bearer ")):
        token = auth_header[7:]
    if not token and credentials:
        token = credentials.credentials

    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id_str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = int(user_id_str)
    except (JWTError, ValueError, TypeError):
        raise credentials_exception

    user = await User.objects.get_or_none(id=user_id)
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    return user


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


async def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[User]:
    token = None
    auth_header = request.headers.get("Authorization")
    if auth_header and (auth_header.startswith("Bearer ") or auth_header.startswith("bearer ")):
        token = auth_header[7:]
    if not token and credentials:
        token = credentials.credentials

    if not token:
        return None

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id_str = payload.get("sub")
        if user_id_str is None:
            return None
        user_id = int(user_id_str)
    except (JWTError, ValueError, TypeError):
        return None

    user = await User.objects.get_or_none(id=user_id)
    if user is None or not user.is_active:
        return None

    return user


async def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (UserRole.ADMIN.value, UserRole.DEVELOPER.value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


async def get_current_teacher(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in [UserRole.TEACHER.value, UserRole.ADMIN.value, UserRole.DEVELOPER.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions. Teacher role required."
        )
    return current_user


async def get_current_student(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in [UserRole.STUDENT.value, UserRole.TEACHER.value, UserRole.ADMIN.value, UserRole.DEVELOPER.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user