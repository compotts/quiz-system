from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from schemas import (
    QuizCreate, QuizUpdate, QuizResponse,
    QuestionCreate, QuestionUpdate, QuestionResponse,
    StartQuizAttempt, SubmitAnswer, CompleteQuizAttempt,
    QuizAttemptResponse, QuizResultResponse
)
from app.database.models.quiz import Quiz, Question, Option
from app.database.models.group import Group, GroupMember
from app.database.models.attempt import QuizAttempt, Answer
from app.database.models.user import User
from app.utils.auth import get_current_teacher, get_current_user, get_current_student
from datetime import datetime
import json

router = APIRouter(prefix="/quizzes", tags=["Quizzes"])


@router.post("", response_model=QuizResponse)
async def create_quiz(
    data: QuizCreate,
    current_user: User = Depends(get_current_teacher)
):
    """Создание новой викторины"""
    
    # Проверка существования группы и прав
    group = await Group.objects.get_or_none(id=data.group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    
    if group.teacher.id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only create quizzes in your own groups"
        )
    
    quiz = await Quiz.objects.create(
        title=data.title,
        description=data.description,
        group=group,
        teacher=current_user,
        quiz_type=data.quiz_type.value,
        timer_mode=data.timer_mode.value,
        time_limit=data.time_limit,
        is_active=True
    )
    
    return {
        **quiz.dict(),
        "group_id": group.id,
        "teacher_id": current_user.id,
        "question_count": 0
    }


@router.get("", response_model=List[QuizResponse])
async def get_quizzes(
    group_id: int = None,
    current_user: User = Depends(get_current_user)
):
    """Получение списка викторин"""
    
    query = Quiz.objects.select_related(["group", "teacher"])
    
    if current_user.role == "teacher" or current_user.role == "admin":
        # Учитель видит свои викторины
        if group_id:
            query = query.filter(group=group_id, teacher=current_user)
        else:
            query = query.filter(teacher=current_user)
    else:
        # Ученик видит викторины из своих групп
        memberships = await GroupMember.objects.filter(user=current_user).all()
        group_ids = [m.group.id for m in memberships]
        
        if group_id:
            if group_id not in group_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied"
                )
            query = query.filter(group=group_id, is_active=True)
        else:
            query = query.filter(group__in=group_ids, is_active=True)
    
    quizzes = await query.all()
    
    result = []
    for quiz in quizzes:
        question_count = await Question.objects.filter(quiz=quiz).count()
        result.append({
            **quiz.dict(),
            "group_id": quiz.group.id,
            "teacher_id": quiz.teacher.id,
            "question_count": question_count
        })
    
    return result


@router.get("/{quiz_id}", response_model=QuizResponse)
async def get_quiz(
    quiz_id: int,
    current_user: User = Depends(get_current_user)
):
    """Получение информации о викторине"""
    
    quiz = await Quiz.objects.select_related(["group", "teacher"]).get_or_none(id=quiz_id)
    
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found"
        )
    
    # Проверка доступа
    is_teacher = quiz.teacher.id == current_user.id
    is_member = await GroupMember.objects.filter(
        group=quiz.group, user=current_user
    ).exists()
    
    if not (is_teacher or is_member or current_user.role == "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    question_count = await Question.objects.filter(quiz=quiz).count()
    
    return {
        **quiz.dict(),
        "group_id": quiz.group.id,
        "teacher_id": quiz.teacher.id,
        "question_count": question_count
    }


@router.patch("/{quiz_id}", response_model=QuizResponse)
async def update_quiz(
    quiz_id: int,
    data: QuizUpdate,
    current_user: User = Depends(get_current_teacher)
):
    """Обновление викторины"""
    
    quiz = await Quiz.objects.select_related(["group", "teacher"]).get_or_none(id=quiz_id)
    
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found"
        )
    
    if quiz.teacher.id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only quiz owner can update it"
        )
    
    update_data = data.dict(exclude_unset=True)
    if update_data:
        # Конвертация enum в строки
        if "quiz_type" in update_data:
            update_data["quiz_type"] = update_data["quiz_type"].value
        if "timer_mode" in update_data:
            update_data["timer_mode"] = update_data["timer_mode"].value
        
        await quiz.update(**update_data)
    
    question_count = await Question.objects.filter(quiz=quiz).count()
    
    return {
        **quiz.dict(),
        "group_id": quiz.group.id,
        "teacher_id": quiz.teacher.id,
        "question_count": question_count
    }


@router.delete("/{quiz_id}")
async def delete_quiz(
    quiz_id: int,
    current_user: User = Depends(get_current_teacher)
):
    """Удаление викторины"""
    
    quiz = await Quiz.objects.get_or_none(id=quiz_id)
    
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found"
        )
    
    if quiz.teacher.id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only quiz owner can delete it"
        )
    
    await quiz.delete()
    
    return {"message": "Quiz deleted successfully"}


# ============ QUESTIONS ============

@router.post("/{quiz_id}/questions", response_model=QuestionResponse)
async def create_question(
    quiz_id: int,
    data: QuestionCreate,
    current_user: User = Depends(get_current_teacher)
):
    """Добавление вопроса в викторину"""
    
    quiz = await Quiz.objects.get_or_none(id=quiz_id)
    
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found"
        )
    
    if quiz.teacher.id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Создание вопроса
    question = await Question.objects.create(
        quiz=quiz,
        question_type=data.question_type.value,
        text=data.text,
        order=data.order,
        points=data.points,
        time_limit=data.time_limit
    )
    
    # Создание вариантов ответа
    options = []
    for opt_data in data.options:
        option = await Option.objects.create(
            question=question,
            text=opt_data.text,
            is_correct=opt_data.is_correct,
            order=opt_data.order
        )
        options.append(option)
    
    return {
        **question.dict(),
        "quiz_id": quiz.id,
        "options": [opt.dict() for opt in options]
    }


@router.get("/{quiz_id}/questions", response_model=List[QuestionResponse])
async def get_questions(
    quiz_id: int,
    current_user: User = Depends(get_current_user)
):
    """Получение всех вопросов викторины"""
    
    quiz = await Quiz.objects.select_related("group").get_or_none(id=quiz_id)
    
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found"
        )
    
    # Проверка доступа
    is_teacher = quiz.teacher.id == current_user.id
    is_member = await GroupMember.objects.filter(
        group=quiz.group, user=current_user
    ).exists()
    
    if not (is_teacher or is_member or current_user.role == "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    questions = await Question.objects.filter(quiz=quiz).order_by("order").all()
    
    result = []
    for question in questions:
        options = await Option.objects.filter(question=question).order_by("order").all()
        result.append({
            **question.dict(),
            "quiz_id": quiz.id,
            "options": [opt.dict() for opt in options]
        })
    
    return result


@router.patch("/{quiz_id}/questions/{question_id}")
async def update_question(
    quiz_id: int,
    question_id: int,
    data: QuestionUpdate,
    current_user: User = Depends(get_current_teacher)
):
    """Обновление вопроса"""
    
    quiz = await Quiz.objects.get_or_none(id=quiz_id)
    
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found"
        )
    
    if quiz.teacher.id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    question = await Question.objects.get_or_none(id=question_id, quiz=quiz)
    
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )
    
    update_data = data.dict(exclude_unset=True)
    if update_data:
        if "question_type" in update_data:
            update_data["question_type"] = update_data["question_type"].value
        await question.update(**update_data)
    
    return {"message": "Question updated successfully"}


@router.delete("/{quiz_id}/questions/{question_id}")
async def delete_question(
    quiz_id: int,
    question_id: int,
    current_user: User = Depends(get_current_teacher)
):
    """Удаление вопроса"""
    
    quiz = await Quiz.objects.get_or_none(id=quiz_id)
    
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found"
        )
    
    if quiz.teacher.id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    question = await Question.objects.get_or_none(id=question_id, quiz=quiz)
    
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )
    
    await question.delete()
    
    return {"message": "Question deleted successfully"}