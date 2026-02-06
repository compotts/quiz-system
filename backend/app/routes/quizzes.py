from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List
from schemas import (
    QuizCreate, QuizUpdate, QuizResponse,
    QuestionCreate, QuestionUpdate, QuestionResponse, QuestionsBatchCreate,
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
        timer_mode=data.timer_mode,
        time_limit=data.time_limit if data.timer_mode == "quiz_total" else None,
        question_time_limit=data.question_time_limit if data.timer_mode == "per_question" else None,
        has_quiz_time_limit=data.timer_mode == "quiz_total",
        available_until=to_naive_utc(data.available_until) if not data.manual_close else None,
        manual_close=data.manual_close,
        allow_show_answers=data.allow_show_answers,
        show_results=data.show_results,
        question_display_mode=data.question_display_mode,
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
    qd = quiz.dict()
    if qd.get("show_results") is None:
        qd["show_results"] = True
    if qd.get("question_display_mode") is None:
        qd["question_display_mode"] = "all_on_page"
    return {
        **qd,
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
        qd = quiz.dict()
        if qd.get("show_results") is None:
            qd["show_results"] = True
        if qd.get("question_display_mode") is None:
            qd["question_display_mode"] = "all_on_page"
        result.append({
            **qd,
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
    qd = quiz.dict()
    if qd.get("show_results") is None:
        qd["show_results"] = True
    if qd.get("question_display_mode") is None:
        qd["question_display_mode"] = "all_on_page"
    return {
        **qd,
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
    qd = quiz.dict()
    if qd.get("show_results") is None:
        qd["show_results"] = True
    if qd.get("question_display_mode") is None:
        qd["question_display_mode"] = "all_on_page"
    return {
        **qd,
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
        correct_text_answer=data.correct_text_answer if data.input_type in ("text", "number") else None
    )
    
    options = []
    if data.input_type == "select":
        if not data.options:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one option is required for select type"
            )
        correct_count_opts = sum(1 for o in data.options if o.is_correct)
        if correct_count_opts < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one correct answer must be selected"
            )
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


@router.post("/{quiz_id}/questions/batch", response_model=List[QuestionResponse])
async def create_questions_batch(
    quiz_id: int,
    data: QuestionsBatchCreate,
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
    
    created_questions = []
    
    for q_data in data.questions:
        question = await Question.objects.create(
            quiz=quiz,
            question_type="single_choice",
            input_type=q_data.input_type,
            text=q_data.text,
            order=q_data.order,
            points=q_data.points,
            correct_text_answer=q_data.correct_text_answer if q_data.input_type in ("text", "number") else None
        )
        
        options = []
        if q_data.input_type == "select":
            if not q_data.options:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="At least one option is required for select type"
                )
            if sum(1 for o in q_data.options if o.is_correct) < 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="At least one correct answer must be selected"
                )
            for opt_data in q_data.options:
                option = await Option.objects.create(
                    question=question,
                    text=opt_data.text,
                    is_correct=opt_data.is_correct,
                    order=opt_data.order
                )
                options.append(option)
        
        correct_count = sum(1 for o in options if o.is_correct)
        is_multiple_choice = correct_count > 1
        
        created_questions.append({
            **question.dict(),
            "quiz_id": quiz.id,
            "options": [opt.dict() for opt in options],
            "is_multiple_choice": is_multiple_choice
        })
    
    await log_audit(
        "questions_batch_created",
        user_id=current_user.id,
        username=current_user.username,
        resource_type="question",
        resource_id=str(quiz_id),
        details={"quiz_id": quiz_id, "count": len(created_questions)},
        request=request,
    )
    
    return created_questions


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
    options_data = update_data.pop("options", None)

    if options_data is not None and (question.input_type == "select" or update_data.get("input_type") == "select"):
        if not options_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one option is required for select type"
            )
        if sum(1 for o in options_data if o.get("is_correct")) < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one correct answer must be selected"
            )
        await Option.objects.filter(question=question).delete()
        for i, opt_data in enumerate(options_data):
            await Option.objects.create(
                question=question,
                text=opt_data["text"],
                is_correct=opt_data.get("is_correct", False),
                order=opt_data.get("order", i),
            )

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


@router.delete("/{quiz_id}/questions")
async def delete_all_questions(
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
    
    questions = await Question.objects.filter(quiz=quiz).all()
    deleted_count = len(questions)
    
    for question in questions:
        await Answer.objects.filter(question=question).delete()
        await Option.objects.filter(question=question).delete()
        await question.delete()
    
    await log_audit(
        "all_questions_deleted",
        user_id=current_user.id,
        username=current_user.username,
        resource_type="quiz",
        resource_id=str(quiz_id),
        details={"deleted_count": deleted_count},
        request=request,
    )
    
    return {"message": f"Deleted {deleted_count} questions", "deleted_count": deleted_count}


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
        attempt = None
        try:
            attempt = await QuizAttempt.objects.filter(quiz=quiz, student=student).first()
        except:
            pass
        
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


@router.get("/{quiz_id}/student-detail/{student_id}")
async def get_student_detail(
    quiz_id: int,
    student_id: int,
    current_user: User = Depends(get_current_teacher)
):
    """Get detailed statistics for a specific student's attempt"""
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
    
    student = await User.objects.get_or_none(id=student_id)
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    student_name = f"{student.first_name or ''} {student.last_name or ''}".strip() or student.username
    
    attempt = None
    try:
        attempt = await QuizAttempt.objects.filter(quiz=quiz, student=student).first()
    except:
        pass
    questions = await Question.objects.filter(quiz=quiz).order_by("order").all()
    
    question_details = []
    for q in questions:
        options = await Option.objects.filter(question=q).order_by("order").all()
        
        answer = None
        if attempt:
            try:
                answer = await Answer.objects.filter(attempt=attempt, question=q).first()
            except:
                pass
        
        selected_options = []
        if answer and answer.selected_options:
            try:
                selected_options = json.loads(answer.selected_options) if isinstance(answer.selected_options, str) else answer.selected_options
            except:
                selected_options = []
        
        is_correct = answer.is_correct if answer else None
        points_earned = answer.points_earned if answer else 0
        time_spent = answer.time_spent if answer else None
        text_answer = answer.text_answer if answer else None
        
        question_details.append({
            "question_id": q.id,
            "question_text": q.text,
            "input_type": q.input_type or "select",
            "points": q.points,
            "correct_text_answer": q.correct_text_answer,
            "options": [
                {
                    "id": o.id,
                    "text": o.text,
                    "is_correct": o.is_correct,
                    "was_selected": o.id in selected_options
                }
                for o in options
            ],
            "answered": answer is not None,
            "is_correct": is_correct,
            "points_earned": points_earned,
            "time_spent": time_spent,
            "text_answer": text_answer,
            "selected_option_ids": selected_options
        })
    
    total_time = sum(q["time_spent"] or 0 for q in question_details if q["answered"])
    answered_count = sum(1 for q in question_details if q["answered"])
    correct_count = sum(1 for q in question_details if q["is_correct"])
    
    return {
        "student_id": student_id,
        "student_name": student_name,
        "attempt_id": attempt.id if attempt else None,
        "started_at": attempt.started_at.isoformat() if attempt and attempt.started_at else None,
        "completed_at": attempt.completed_at.isoformat() if attempt and attempt.completed_at else None,
        "is_completed": attempt.is_completed if attempt else False,
        "score": attempt.score if attempt else 0,
        "max_score": attempt.max_score if attempt else sum(q.points for q in questions),
        "total_time": total_time,
        "answered_count": answered_count,
        "correct_count": correct_count,
        "total_questions": len(questions),
        "questions": question_details
    }


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