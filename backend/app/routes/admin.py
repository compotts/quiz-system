from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from schemas import (
    AdminInitRequest, UserResponse, RegistrationRequestResponse,
    ReviewRegistrationRequest
)
from app.database.models.user import User, UserRole
from app.database.models.registration_request import RegistrationRequest, RegistrationStatus
from app.utils.auth import get_password_hash, get_current_admin
from config import settings

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.post("/init", response_model=UserResponse)
async def initialize_admin(data: AdminInitRequest):
    """Инициализация первого администратора (только если БД пуста)"""
    
    if not settings.admin_init_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin initialization is disabled"
        )
    
    # Проверка существующих пользователей
    users_count = await User.objects.count()
    if users_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin already exists. This endpoint is disabled."
        )
    
    # Создание админа
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


@router.get("/registration-requests", response_model=List[RegistrationRequestResponse])
async def get_registration_requests(
    status_filter: str = None,
    current_admin: User = Depends(get_current_admin)
):
    """Получение всех заявок на регистрацию"""
    
    query = RegistrationRequest.objects
    
    if status_filter:
        if status_filter not in [s.value for s in RegistrationStatus]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status filter"
            )
        query = query.filter(status=status_filter)
    
    requests = await query.order_by("-created_at").all()
    return requests


@router.post("/registration-requests/{request_id}/review")
async def review_registration_request(
    request_id: int,
    review_data: ReviewRegistrationRequest,
    current_admin: User = Depends(get_current_admin)
):
    """Одобрение или отклонение заявки на регистрацию"""
    
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
        # Создание пользователя
        user = await User.objects.create(
            username=reg_request.username,
            email=reg_request.email,
            first_name=reg_request.first_name,
            last_name=reg_request.last_name,
            hashed_password=reg_request.hashed_password,
            role=review_data.role.value if review_data.role else UserRole.STUDENT.value,
            is_active=True
        )
        
        # Обновление статуса заявки
        await reg_request.update(
            status=RegistrationStatus.APPROVED.value,
            reviewed_by=current_admin,
            reviewed_at=datetime.utcnow()
        )
        
        return {"message": "User approved and created", "user_id": user.id}
    else:
        # Отклонение заявки
        await reg_request.update(
            status=RegistrationStatus.REJECTED.value,
            reviewed_by=current_admin,
            reviewed_at=datetime.utcnow()
        )
        
        return {"message": "Registration request rejected"}


@router.get("/users", response_model=List[UserResponse])
async def get_all_users(
    skip: int = 0,
    limit: int = 100,
    current_admin: User = Depends(get_current_admin)
):
    """Получение списка всех пользователей"""
    
    users = await User.objects.order_by("-created_at").paginate(skip, limit).all()
    return users


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user_details(
    user_id: int,
    current_admin: User = Depends(get_current_admin)
):
    """Получение подробной информации о пользователе"""
    
    user = await User.objects.get_or_none(id=user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user


@router.patch("/users/{user_id}/role")
async def change_user_role(
    user_id: int,
    new_role: UserRole,
    current_admin: User = Depends(get_current_admin)
):
    """Изменение роли пользователя"""
    
    user = await User.objects.get_or_none(id=user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Запрет на изменение своей роли
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
    """Активация/деактивация пользователя"""
    
    user = await User.objects.get_or_none(id=user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Запрет на деактивацию самого себя
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
    """Удаление пользователя"""
    
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


from datetime import datetime