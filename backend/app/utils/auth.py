from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import settings
from app.database.models.user import User, UserRole

security = HTTPBearer()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверка пароля"""
    try:
        # Проверяем, что хеш начинается с $2b$ (bcrypt формат)
        if not hashed_password.startswith('$2b$'):
            return False
        # Преобразуем строку в bytes для bcrypt
        password_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """Хеширование пароля"""
    # Обрезаем пароль до 72 байт (ограничение bcrypt)
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    
    # Генерируем соль и хешируем пароль
    salt = bcrypt.gensalt(rounds=settings.bcrypt_rounds)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Создание JWT токена"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """Создание refresh токена"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """Получение текущего пользователя из JWT токена"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        token = credentials.credentials
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await User.objects.get_or_none(id=user_id)
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    
    return user


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Проверка активного пользователя"""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


async def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    """Проверка прав администратора"""
    if current_user.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


async def get_current_teacher(current_user: User = Depends(get_current_user)) -> User:
    """Проверка прав учителя"""
    if current_user.role not in [UserRole.TEACHER.value, UserRole.ADMIN.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions. Teacher role required."
        )
    return current_user


async def get_current_student(current_user: User = Depends(get_current_user)) -> User:
    """Проверка прав ученика"""
    if current_user.role not in [UserRole.STUDENT.value, UserRole.TEACHER.value, UserRole.ADMIN.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user