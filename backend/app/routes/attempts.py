from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from schemas import (
    StartQuizAttempt, SubmitAnswer, CompleteQuizAttempt,
    QuizAttemptResponse, QuizResultResponse
)
from app.database.models.quiz import Quiz, Question, Option
from app.database.models.group import GroupMember
from app.database.models.attempt import QuizAttempt, Answer
from app.database.models.user import User
from app.utils.auth import get_current_student, get_current_user
from app.database.database import utc_now
from datetime import datetime
import json

router = APIRouter(prefix="/attempts", tags=["Quiz Attempts"])


@router.post("/start", response_model=QuizAttemptResponse)
async def start_quiz_attempt(
    data: StartQuizAttempt,
    current_user: User = Depends(get_current_student)
):
    quiz = await Quiz.objects.select_related("group").get_or_none(id=data.quiz_id)
    
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found"
        )
    
    if not quiz.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quiz is not active"
        )
    
    is_member = await GroupMember.objects.filter(
        group=quiz.group, user=current_user
    ).exists()
    
    if not is_member and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )
    

    existing_attempt = None
    try:
        existing_attempt = await QuizAttempt.objects.filter(
            quiz=quiz,
            student=current_user,
            is_completed=False
        ).first()
    except:
        pass
    
    if existing_attempt:
        return existing_attempt
    
    questions = await Question.objects.filter(quiz=quiz).all()
    max_score = sum(q.points for q in questions)
    
    attempt = await QuizAttempt.objects.create(
        quiz=quiz,
        student=current_user,
        score=0.0,
        max_score=max_score,
        started_at=utc_now(),
        is_completed=False
    )
    
    return {
        **attempt.dict(),
        "quiz_id": quiz.id,
        "student_id": current_user.id
    }


@router.post("/answer")
async def submit_answer(
    data: SubmitAnswer,
    current_user: User = Depends(get_current_student)
):
    question = await Question.objects.select_related("quiz").get_or_none(id=data.question_id)
    
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )
    
    attempt = await QuizAttempt.objects.filter(
        quiz=question.quiz,
        student=current_user,
        is_completed=False
    ).first()
    
    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active quiz attempt found"
        )
    
    existing_answer = None
    try:
        existing_answer = await Answer.objects.filter(
            attempt=attempt,
            question=question
        ).first()
    except:
        pass
    
    if existing_answer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question already answered"
        )
    
    all_question_options = await Option.objects.filter(question=question).all()
    all_option_ids = set(opt.id for opt in all_question_options)
    selected_ids = set(data.selected_options)
    
    if not selected_ids.issubset(all_option_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected options do not belong to this question"
        )
    
    correct_options = await Option.objects.filter(
        question=question,
        is_correct=True
    ).all()
    correct_ids = set(opt.id for opt in correct_options)
    
    is_correct = correct_ids == selected_ids
    points_earned = question.points if is_correct else 0.0
    
    answer = await Answer.objects.create(
        attempt=attempt,
        question=question,
        selected_options=json.dumps(data.selected_options),
        is_correct=is_correct,
        points_earned=points_earned,
        answered_at=utc_now()
    )
    
    await attempt.load()
    await attempt.update(score=attempt.score + points_earned)
    
    return {
        "message": "Answer submitted",
        "is_correct": is_correct,
        "points_earned": points_earned
    }


@router.post("/complete")
async def complete_quiz_attempt(
    data: CompleteQuizAttempt,
    current_user: User = Depends(get_current_student)
):
    attempt = await QuizAttempt.objects.get_or_none(
        id=data.attempt_id,
        student=current_user
    )
    
    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attempt not found"
        )
    
    if attempt.is_completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attempt already completed"
        )
    
    time_spent = int((utc_now() - attempt.started_at).total_seconds())
    
    await attempt.update(
        completed_at=now,
        time_spent=time_spent,
        is_completed=True
    )
    
    return {
        "message": "Quiz completed",
        "score": attempt.score,
        "max_score": attempt.max_score,
        "percentage": (attempt.score / attempt.max_score * 100) if attempt.max_score > 0 else 0
    }


@router.get("/my-attempts", response_model=List[QuizAttemptResponse])
async def get_my_attempts(
    quiz_id: int = None,
    current_user: User = Depends(get_current_student)
):
    query = QuizAttempt.objects.filter(student=current_user)
    
    if quiz_id:
        query = query.filter(quiz=quiz_id)
    
    attempts = await query.order_by("-started_at").all()
    
    return [
        {
            **attempt.dict(),
            "quiz_id": attempt.quiz.id,
            "student_id": current_user.id
        }
        for attempt in attempts
    ]


@router.get("/results/{attempt_id}", response_model=QuizResultResponse)
async def get_attempt_results(
    attempt_id: int,
    current_user: User = Depends(get_current_user)
):
    attempt = await QuizAttempt.objects.select_related(["quiz", "student"]).get_or_none(id=attempt_id)
    
    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attempt not found"
        )
    
    is_student = attempt.student.id == current_user.id
    is_teacher = attempt.quiz.teacher.id == current_user.id
    
    if not (is_student or is_teacher or current_user.role == "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    answers = await Answer.objects.select_related("question").filter(attempt=attempt).all()
    answer_details = []
    for answer in answers:
        question = answer.question
        options = await Option.objects.filter(question=question).all()
        selected_ids = json.loads(answer.selected_options)
        
        answer_details.append({
            "question_id": question.id,
            "question_text": question.text,
            "selected_options": selected_ids,
            "correct_options": [opt.id for opt in options if opt.is_correct],
            "is_correct": answer.is_correct,
            "points_earned": answer.points_earned,
            "max_points": question.points
        })
    
    percentage = (attempt.score / attempt.max_score * 100) if attempt.max_score > 0 else 0
    
    return {
        "attempt": {
            **attempt.dict(),
            "quiz_id": attempt.quiz.id,
            "student_id": attempt.student.id
        },
        "answers": answer_details,
        "percentage": percentage
    }


@router.get("/quiz/{quiz_id}/results")
async def get_quiz_results(
    quiz_id: int,
    current_user: User = Depends(get_current_user)
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
    
    attempts = await QuizAttempt.objects.select_related("student").filter(
        quiz=quiz,
        is_completed=True
    ).order_by("-score").all()
    
    results = []
    for attempt in attempts:
        percentage = (attempt.score / attempt.max_score * 100) if attempt.max_score > 0 else 0
        results.append({
            "attempt_id": attempt.id,
            "student_id": attempt.student.id,
            "student_name": f"{attempt.student.first_name} {attempt.student.last_name}",
            "score": attempt.score,
            "max_score": attempt.max_score,
            "percentage": percentage,
            "time_spent": attempt.time_spent,
            "completed_at": attempt.completed_at
        })
    
    return results


@router.get("/current")
async def get_current_attempt(
    quiz_id: int,
    current_user: User = Depends(get_current_student)
):
    attempt = None
    try:
        attempt = await QuizAttempt.objects.filter(
            quiz=quiz_id,
            student=current_user,
            is_completed=False
        ).first()
    except:
        pass
    
    if not attempt:
        return {"has_attempt": False}
    
    answered_questions = await Answer.objects.filter(attempt=attempt).all()
    answered_ids = [ans.question.id for ans in answered_questions]
    
    return {
        "has_attempt": True,
        "attempt_id": attempt.id,
        "started_at": attempt.started_at,
        "answered_questions": answered_ids
    }