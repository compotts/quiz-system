from fastapi import APIRouter, Depends, HTTPException, status, Request
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
from app.utils.audit import log_audit
from app.database.database import to_naive_utc
from datetime import datetime
import json

router = APIRouter(prefix="/quizzes", tags=["Quizzes"])


@router.post("", response_model=QuizResponse)
async def create_quiz(
    data: QuizCreate,
    request: Request,
    current_user: User = Depends(get_current_teacher)
):
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
        has_quiz_time_limit=data.has_quiz_time_limit,
        time_limit=data.time_limit,
        available_until=to_naive_utc(data.available_until) if not data.manual_close else None,
        manual_close=data.manual_close,
        allow_show_answers=data.allow_show_answers,
        is_active=True
    )
    await log_audit(
        "quiz_created",
        user_id=current_user.id,
        username=current_user.username,
        resource_type="quiz",
        resource_id=str(quiz.id),
        details={"title": quiz.title, "group_id": group.id},
        request=request,
    )
    now = datetime.utcnow()
    is_expired = not quiz.manual_close and quiz.available_until and quiz.available_until < now
    return {
        **quiz.dict(),
        "group_id": group.id,
        "teacher_id": current_user.id,
        "question_count": 0,
        "is_expired": is_expired
    }


@router.get("", response_model=List[QuizResponse])
async def get_quizzes(
    group_id: int = None,
    current_user: User = Depends(get_current_user)
):
    now = datetime.utcnow()
    query = Quiz.objects.select_related(["group", "teacher"])
    
    if current_user.role == "teacher" or current_user.role == "admin":
        if group_id:
            query = query.filter(group=group_id, teacher=current_user)
        else:
            query = query.filter(teacher=current_user)
    else:
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
        is_expired = not quiz.manual_close and quiz.available_until and quiz.available_until < now
        result.append({
            **quiz.dict(),
            "group_id": quiz.group.id,
            "teacher_id": quiz.teacher.id,
            "question_count": question_count,
            "is_expired": is_expired
        })
    
    return result


@router.get("/{quiz_id}", response_model=QuizResponse)
async def get_quiz(
    quiz_id: int,
    current_user: User = Depends(get_current_user)
):
    now = datetime.utcnow()
    quiz = await Quiz.objects.select_related(["group", "teacher"]).get_or_none(id=quiz_id)
    
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found"
        )
    
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
    is_expired = not quiz.manual_close and quiz.available_until and quiz.available_until < now
    
    return {
        **quiz.dict(),
        "group_id": quiz.group.id,
        "teacher_id": quiz.teacher.id,
        "question_count": question_count,
        "is_expired": is_expired
    }


@router.patch("/{quiz_id}", response_model=QuizResponse)
async def update_quiz(
    quiz_id: int,
    data: QuizUpdate,
    request: Request,
    current_user: User = Depends(get_current_teacher)
):
    now = datetime.utcnow()
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
        if "available_until" in update_data:
            update_data["available_until"] = to_naive_utc(update_data["available_until"])
        
        await quiz.update(**update_data)
        await log_audit(
            "quiz_updated",
            user_id=current_user.id,
            username=current_user.username,
            resource_type="quiz",
            resource_id=str(quiz_id),
            details={"title": quiz.title},
            request=request,
        )
    
    question_count = await Question.objects.filter(quiz=quiz).count()
    is_expired = not quiz.manual_close and quiz.available_until and quiz.available_until < now
    
    return {
        **quiz.dict(),
        "group_id": quiz.group.id,
        "teacher_id": quiz.teacher.id,
        "question_count": question_count,
        "is_expired": is_expired
    }


@router.delete("/{quiz_id}")
async def delete_quiz(
    quiz_id: int,
    request: Request,
    current_user: User = Depends(get_current_teacher)
):
    quiz = await Quiz.objects.select_related("teacher", "group").get_or_none(id=quiz_id)
    
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
    
    quiz_title = quiz.title
    group_id = quiz.group.id

    attempts = await QuizAttempt.objects.filter(quiz=quiz).all()
    for attempt in attempts:
        answers = await Answer.objects.filter(attempt=attempt).all()
        for ans in answers:
            await ans.delete()
    
    for attempt in attempts:
        await attempt.delete()
    
    questions = await Question.objects.filter(quiz=quiz).all()
    for question in questions:
        options = await Option.objects.filter(question=question).all()
        for opt in options:
            await opt.delete()
        await question.delete()
    
    await quiz.delete()

    await log_audit(
        "quiz_deleted",
        user_id=current_user.id,
        username=current_user.username,
        resource_type="quiz",
        resource_id=str(quiz_id),
        details={"title": quiz_title, "group_id": group_id},
        request=request,
    )
    
    return {"message": "Quiz deleted successfully"}


@router.post("/{quiz_id}/questions", response_model=QuestionResponse)
async def create_question(
    quiz_id: int,
    data: QuestionCreate,
    request: Request,
    current_user: User = Depends(get_current_teacher)
):
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
    
    question = await Question.objects.create(
        quiz=quiz,
        question_type="single_choice",
        input_type=data.input_type,
        text=data.text,
        order=data.order,
        points=data.points,
        has_time_limit=data.has_time_limit,
        time_limit=data.time_limit if data.has_time_limit else None,
        correct_text_answer=data.correct_text_answer if data.input_type in ("text", "number") else None
    )
    
    options = []
    if data.input_type == "select":
        for opt_data in data.options:
            option = await Option.objects.create(
                question=question,
                text=opt_data.text,
                is_correct=opt_data.is_correct,
                order=opt_data.order
            )
            options.append(option)

    await log_audit(
        "question_created",
        user_id=current_user.id,
        username=current_user.username,
        resource_type="question",
        resource_id=str(question.id),
        details={"quiz_id": quiz_id},
        request=request,
    )
    
    correct_count = sum(1 for o in options if o.is_correct)
    is_multiple_choice = correct_count > 1
    
    return {
        **question.dict(),
        "quiz_id": quiz.id,
        "options": [opt.dict() for opt in options],
        "is_multiple_choice": is_multiple_choice
    }


@router.get("/{quiz_id}/questions", response_model=List[QuestionResponse])
async def get_questions(
    quiz_id: int,
    current_user: User = Depends(get_current_user)
):
    quiz = await Quiz.objects.select_related("group").get_or_none(id=quiz_id)
    
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found"
        )
    
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
        correct_count = sum(1 for o in options if o.is_correct)
        is_multiple_choice = correct_count > 1
        
        options_data = []
        for opt in options:
            opt_dict = opt.dict()
            if current_user.role == "student":
                opt_dict["is_correct"] = False
            options_data.append(opt_dict)
        
        q_dict = question.dict()
        if current_user.role == "student":
            q_dict["correct_text_answer"] = None
        
        result.append({
            **q_dict,
            "quiz_id": quiz.id,
            "options": options_data,
            "is_multiple_choice": is_multiple_choice
        })
    
    return result


@router.patch("/{quiz_id}/questions/{question_id}")
async def update_question(
    quiz_id: int,
    question_id: int,
    data: QuestionUpdate,
    request: Request,
    current_user: User = Depends(get_current_teacher)
):
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
        await log_audit(
            "question_updated",
            user_id=current_user.id,
            username=current_user.username,
            resource_type="question",
            resource_id=str(question_id),
            details={"quiz_id": quiz_id},
            request=request,
        )
    
    return {"message": "Question updated successfully"}


@router.delete("/{quiz_id}/questions/{question_id}")
async def delete_question(
    quiz_id: int,
    question_id: int,
    request: Request,
    current_user: User = Depends(get_current_teacher)
):
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
    
    await Answer.objects.filter(question=question).delete()
    await Option.objects.filter(question=question).delete()
    await question.delete()

    await log_audit(
        "question_deleted",
        user_id=current_user.id,
        username=current_user.username,
        resource_type="question",
        resource_id=str(question_id),
        details={"quiz_id": quiz_id},
        request=request,
    )
    
    return {"message": "Question deleted successfully"}


@router.get("/{quiz_id}/student-statuses")
async def get_student_statuses(
    quiz_id: int,
    current_user: User = Depends(get_current_teacher)
):
    quiz = await Quiz.objects.select_related("group").get_or_none(id=quiz_id)
    
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
    
    now = datetime.utcnow()
    is_expired = not quiz.manual_close and quiz.available_until and quiz.available_until < now
    
    members = await GroupMember.objects.select_related("user").filter(group=quiz.group).all()
    questions = await Question.objects.filter(quiz=quiz).all()
    total_questions = len(questions)
    
    result = []
    for member in members:
        student = member.user
        student_name = f"{student.first_name or ''} {student.last_name or ''}".strip() or student.username
        attempt = await QuizAttempt.objects.filter(quiz=quiz, student=student).first()
        
        if not attempt:
            status = "expired" if is_expired else "not_opened"
            result.append({
                "student_id": student.id,
                "student_name": student_name,
                "status": status,
                "score": None,
                "max_score": None,
                "answered_count": 0,
                "total_questions": total_questions,
                "avg_time_per_answer": None
            })
        else:
            answers = await Answer.objects.filter(attempt=attempt).all()
            answered_count = len(answers)
            
            total_time = sum(a.time_spent or 0 for a in answers)
            avg_time = total_time / answered_count if answered_count > 0 else None
            
            if attempt.is_completed:
                status = "completed"
            elif is_expired and answered_count == 0:
                status = "expired"
            elif answered_count > 0:
                status = "in_progress"
            else:
                status = "opened"
            
            result.append({
                "student_id": student.id,
                "student_name": student_name,
                "status": status,
                "score": attempt.score,
                "max_score": attempt.max_score,
                "answered_count": answered_count,
                "total_questions": total_questions,
                "avg_time_per_answer": avg_time
            })
    
    return result


@router.post("/{quiz_id}/reissue")
async def reissue_quiz(
    quiz_id: int,
    data: dict,
    request: Request,
    current_user: User = Depends(get_current_teacher)
):
    from schemas import ReissueQuizRequest
    
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
    
    student_ids = data.get("student_ids", [])
    new_available_until = data.get("new_available_until")
    
    if new_available_until:
        new_available_until = datetime.fromisoformat(new_available_until.replace("Z", "+00:00")).replace(tzinfo=None)
    
    for student_id in student_ids:
        attempts = await QuizAttempt.objects.filter(quiz=quiz, student=student_id).all()
        for attempt in attempts:
            await Answer.objects.filter(attempt=attempt).delete()
            await attempt.delete()
    
    if new_available_until:
        await quiz.update(available_until=new_available_until, manual_close=False)
    
    await log_audit(
        "quiz_reissued",
        user_id=current_user.id,
        username=current_user.username,
        resource_type="quiz",
        resource_id=str(quiz_id),
        details={"student_ids": student_ids, "new_available_until": str(new_available_until)},
        request=request,
    )
    
    return {"message": "Quiz reissued successfully", "reissued_for": len(student_ids)}


@router.post("/{quiz_id}/close")
async def close_quiz_early(
    quiz_id: int,
    request: Request,
    current_user: User = Depends(get_current_teacher)
):
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
    
    now = datetime.utcnow()
    await quiz.update(available_until=now, manual_close=False)
    
    await log_audit(
        "quiz_closed_early",
        user_id=current_user.id,
        username=current_user.username,
        resource_type="quiz",
        resource_id=str(quiz_id),
        details={"closed_at": str(now)},
        request=request,
    )
    
    return {"message": "Quiz closed successfully"}