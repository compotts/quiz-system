from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
import random
import string
from schemas import GroupCreate, GroupUpdate, GroupResponse, JoinGroupRequest
from app.database.models.group import Group, GroupMember
from app.database.models.user import User
from app.utils.auth import get_current_teacher, get_current_user, get_current_student

router = APIRouter(prefix="/groups", tags=["Groups"])


def generate_group_code() -> str:
    """Генерация уникального 6-значного кода группы"""
    return ''.join(random.choices(string.digits, k=6))


@router.post("", response_model=GroupResponse)
async def create_group(
    data: GroupCreate,
    current_user: User = Depends(get_current_teacher)
):
    """Создание новой группы (только для учителей)"""
    
    # Генерация уникального кода
    code = generate_group_code()
    while await Group.objects.filter(code=code).exists():
        code = generate_group_code()
    
    group = await Group.objects.create(
        name=data.name,
        code=code,
        teacher=current_user
    )
    
    # Добавление количества участников
    return {
        **group.dict(),
        "teacher_id": current_user.id,
        "member_count": 0
    }


@router.get("", response_model=List[GroupResponse])
async def get_my_groups(current_user: User = Depends(get_current_user)):
    """Получение списка групп пользователя"""
    
    if current_user.role == "teacher" or current_user.role == "admin":
        # Учитель видит созданные им группы
        groups = await Group.objects.filter(teacher=current_user).all()
        
        result = []
        for group in groups:
            member_count = await GroupMember.objects.filter(group=group).count()
            result.append({
                **group.dict(),
                "teacher_id": current_user.id,
                "member_count": member_count
            })
        return result
    else:
        # Ученик видит группы, в которых он состоит
        memberships = await GroupMember.objects.select_related("group").filter(
            user=current_user
        ).all()
        
        result = []
        for membership in memberships:
            group = membership.group
            member_count = await GroupMember.objects.filter(group=group).count()
            result.append({
                **group.dict(),
                "teacher_id": group.teacher.id,
                "member_count": member_count
            })
        return result


@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(
    group_id: int,
    current_user: User = Depends(get_current_user)
):
    """Получение информации о группе"""
    
    group = await Group.objects.select_related("teacher").get_or_none(id=group_id)
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    
    # Проверка прав доступа
    is_teacher = group.teacher.id == current_user.id
    is_member = await GroupMember.objects.filter(
        group=group, user=current_user
    ).exists()
    
    if not (is_teacher or is_member or current_user.role == "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    member_count = await GroupMember.objects.filter(group=group).count()
    
    return {
        **group.dict(),
        "teacher_id": group.teacher.id,
        "member_count": member_count
    }


@router.patch("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: int,
    data: GroupUpdate,
    current_user: User = Depends(get_current_teacher)
):
    """Обновление информации о группе"""
    
    group = await Group.objects.get_or_none(id=group_id)
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    
    if group.teacher.id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only group owner can update it"
        )
    
    update_data = data.dict(exclude_unset=True)
    if update_data:
        await group.update(**update_data)
    
    member_count = await GroupMember.objects.filter(group=group).count()
    
    return {
        **group.dict(),
        "teacher_id": group.teacher.id,
        "member_count": member_count
    }


@router.delete("/{group_id}")
async def delete_group(
    group_id: int,
    current_user: User = Depends(get_current_teacher)
):
    """Удаление группы"""
    
    group = await Group.objects.get_or_none(id=group_id)
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    
    if group.teacher.id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only group owner can delete it"
        )
    
    await group.delete()
    
    return {"message": "Group deleted successfully"}


@router.post("/join", response_model=GroupResponse)
async def join_group(
    data: JoinGroupRequest,
    current_user: User = Depends(get_current_student)
):
    """Присоединение к группе по коду"""
    
    group = await Group.objects.select_related("teacher").get_or_none(code=data.code)
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group with this code not found"
        )
    
    # Проверка существующего членства
    existing_member = await GroupMember.objects.filter(
        group=group, user=current_user
    ).exists()
    
    if existing_member:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already a member of this group"
        )
    
    # Добавление в группу
    await GroupMember.objects.create(
        group=group,
        user=current_user
    )
    
    member_count = await GroupMember.objects.filter(group=group).count()
    
    return {
        **group.dict(),
        "teacher_id": group.teacher.id,
        "member_count": member_count
    }


@router.get("/{group_id}/members", response_model=List[dict])
async def get_group_members(
    group_id: int,
    current_user: User = Depends(get_current_user)
):
    """Получение списка участников группы"""
    
    group = await Group.objects.get_or_none(id=group_id)
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    
    # Проверка прав доступа
    if group.teacher.id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only group owner can view members"
        )
    
    members = await GroupMember.objects.select_related("user").filter(
        group=group
    ).all()
    
    return [
        {
            "id": m.user.id,
            "username": m.user.username,
            "email": m.user.email,
            "first_name": m.user.first_name,
            "last_name": m.user.last_name,
            "joined_at": m.joined_at
        }
        for m in members
    ]


@router.delete("/{group_id}/members/{user_id}")
async def remove_member(
    group_id: int,
    user_id: int,
    current_user: User = Depends(get_current_teacher)
):
    """Удаление участника из группы"""
    
    group = await Group.objects.get_or_none(id=group_id)
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    
    if group.teacher.id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only group owner can remove members"
        )
    
    member = await GroupMember.objects.filter(
        group=group, user=user_id
    ).first()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in this group"
        )
    
    await member.delete()
    
    return {"message": "Member removed from group"}


@router.post("/{group_id}/leave")
async def leave_group(
    group_id: int,
    current_user: User = Depends(get_current_student)
):
    """Покинуть группу"""
    
    group = await Group.objects.get_or_none(id=group_id)
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    
    member = await GroupMember.objects.filter(
        group=group, user=current_user
    ).first()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You are not a member of this group"
        )
    
    await member.delete()
    
    return {"message": "Successfully left the group"}