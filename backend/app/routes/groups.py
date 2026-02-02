from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List
import random
import string
from schemas import GroupCreate, GroupUpdate, GroupResponse, JoinGroupRequest
from app.database.models.group import Group, GroupMember
from app.database.models.user import User
from app.database.models.quiz import Quiz, Question, Option
from app.database.models.attempt import QuizAttempt, Answer
from app.utils.auth import get_current_teacher, get_current_user, get_current_student
from app.utils.audit import log_audit

router = APIRouter(prefix="/groups", tags=["Groups"])


def generate_group_code() -> str:
    return ''.join(random.choices(string.digits, k=6))


@router.post("", response_model=GroupResponse)
async def create_group(
    data: GroupCreate,
    request: Request,
    current_user: User = Depends(get_current_teacher)
):
    code = generate_group_code()
    while await Group.objects.filter(code=code).exists():
        code = generate_group_code()
    
    group = await Group.objects.create(
        name=data.name,
        subject=data.subject,
        code=code,
        teacher=current_user
    )
    await log_audit(
        "group_created",
        user_id=current_user.id,
        username=current_user.username,
        resource_type="group",
        resource_id=str(group.id),
        details={"name": group.name, "code": code},
        request=request,
    )
    teacher_full_name = f"{current_user.first_name} {current_user.last_name}".strip() if current_user.first_name or current_user.last_name else current_user.username
    return {
        **group.dict(),
        "teacher_id": current_user.id,
        "teacher_name": teacher_full_name,
        "member_count": 0
    }


@router.get("", response_model=List[GroupResponse])
async def get_my_groups(current_user: User = Depends(get_current_user)):
    if current_user.role == "teacher" or current_user.role == "admin":
        groups = await Group.objects.select_related("teacher").filter(teacher=current_user).all()
        
        result = []
        for group in groups:
            member_count = await GroupMember.objects.filter(group=group).count()
            teacher_full_name = f"{group.teacher.first_name} {group.teacher.last_name}".strip() if group.teacher.first_name or group.teacher.last_name else group.teacher.username
            result.append({
                **group.dict(),
                "teacher_id": current_user.id,
                "teacher_name": teacher_full_name,
                "member_count": member_count
            })
        return result
    else:
        memberships = await GroupMember.objects.select_related("group__teacher").filter(
            user=current_user
        ).all()
        
        result = []
        for membership in memberships:
            group = membership.group
            member_count = await GroupMember.objects.filter(group=group).count()
            teacher_full_name = f"{group.teacher.first_name} {group.teacher.last_name}".strip() if group.teacher.first_name or group.teacher.last_name else group.teacher.username
            result.append({
                **group.dict(),
                "teacher_id": group.teacher.id,
                "teacher_name": teacher_full_name,
                "member_count": member_count
            })
        return result


@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(
    group_id: int,
    current_user: User = Depends(get_current_user)
):
    group = await Group.objects.select_related("teacher").get_or_none(id=group_id)
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    
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
    teacher_full_name = f"{group.teacher.first_name} {group.teacher.last_name}".strip() if group.teacher.first_name or group.teacher.last_name else group.teacher.username
    
    return {
        **group.dict(),
        "teacher_id": group.teacher.id,
        "teacher_name": teacher_full_name,
        "member_count": member_count
    }


@router.patch("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: int,
    data: GroupUpdate,
    request: Request,
    current_user: User = Depends(get_current_teacher)
):
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
        await log_audit(
            "group_updated",
            user_id=current_user.id,
            username=current_user.username,
            resource_type="group",
            resource_id=str(group_id),
            details={"name": group.name, "fields": list(update_data.keys())},
            request=request,
        )
    
    member_count = await GroupMember.objects.filter(group=group).count()
    
    return {
        **group.dict(),
        "teacher_id": group.teacher.id,
        "member_count": member_count
    }


@router.delete("/{group_id}")
async def delete_group(
    group_id: int,
    request: Request,
    current_user: User = Depends(get_current_teacher)
):
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
    
    group_name = group.name
    # Каскадное удаление: квизы (ответы → попытки → варианты → вопросы → квизы), участники, группа
    quizzes = await Quiz.objects.filter(group=group).all()
    for quiz in quizzes:
        attempts = await QuizAttempt.objects.filter(quiz=quiz).all()
        for attempt in attempts:
            await Answer.objects.filter(attempt=attempt).delete()
        await QuizAttempt.objects.filter(quiz=quiz).delete()
        questions = await Question.objects.filter(quiz=quiz).all()
        for question in questions:
            await Option.objects.filter(question=question).delete()
        await Question.objects.filter(quiz=quiz).delete()
    await Quiz.objects.filter(group=group).delete()
    await GroupMember.objects.filter(group=group).delete()
    await group.delete()

    await log_audit(
        "group_deleted",
        user_id=current_user.id,
        username=current_user.username,
        resource_type="group",
        resource_id=str(group_id),
        details={"name": group_name},
        request=request,
    )
    
    return {"message": "Group deleted successfully"}


@router.post("/join", response_model=GroupResponse)
async def join_group(
    data: JoinGroupRequest,
    request: Request,
    current_user: User = Depends(get_current_student)
):
    group = await Group.objects.select_related("teacher").get_or_none(code=data.code)
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group with this code not found"
        )
    
    existing_member = await GroupMember.objects.filter(
        group=group, user=current_user
    ).exists()
    
    if existing_member:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already a member of this group"
        )
    
    await GroupMember.objects.create(
        group=group,
        user=current_user
    )
    await log_audit(
        "group_joined",
        user_id=current_user.id,
        username=current_user.username,
        resource_type="group",
        resource_id=str(group.id),
        details={"group_name": group.name},
        request=request,
    )
    member_count = await GroupMember.objects.filter(group=group).count()
    teacher_full_name = f"{group.teacher.first_name} {group.teacher.last_name}".strip() if group.teacher.first_name or group.teacher.last_name else group.teacher.username
    
    return {
        **group.dict(),
        "teacher_id": group.teacher.id,
        "teacher_name": teacher_full_name,
        "member_count": member_count
    }


@router.get("/{group_id}/members", response_model=List[dict])
async def get_group_members(
    group_id: int,
    current_user: User = Depends(get_current_user)
):
    group = await Group.objects.get_or_none(id=group_id)
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    
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
    request: Request,
    current_user: User = Depends(get_current_teacher)
):
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
    
    member = await GroupMember.objects.select_related("user").filter(
        group=group, user=user_id
    ).first()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in this group"
        )
    
    removed_username = member.user.username
    await member.delete()

    await log_audit(
        "member_removed",
        user_id=current_user.id,
        username=current_user.username,
        resource_type="group",
        resource_id=str(group_id),
        details={"group_name": group.name, "removed_user_id": user_id, "removed_username": removed_username},
        request=request,
    )
    
    return {"message": "Member removed from group"}


@router.post("/{group_id}/leave")
async def leave_group(
    group_id: int,
    request: Request,
    current_user: User = Depends(get_current_student)
):
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
    await log_audit(
        "group_left",
        user_id=current_user.id,
        username=current_user.username,
        resource_type="group",
        resource_id=str(group_id),
        details={"group_name": group.name},
        request=request,
    )
    
    return {"message": "Successfully left the group"}