from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from datetime import datetime
import json

from app.core import require_student
from app.database.models import Group, GroupMember, User, Quiz, Question, Option, QuizAttempt, Answer
from app.schemas.attempt import AnswerSubmit, QuizStartResponse, QuizSubmitRequest, AttemptResponse, DetailedAttemptResponse

router = APIRouter(prefix="/student", tags=["student"])


@router.post("/groups/join")
async def join_group(code: str, current_user: User = Depends(require_student)):
    group = await Group.objects.get_or_none(code=code)
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    existing = await GroupMember.objects.get_or_none(group=group, user=current_user)
    if existing:
        return {"message": "Already a member"}

    await GroupMember.objects.create(group=group, user=current_user)
    return {"message": "Joined group"}


@router.get("/groups", response_model=List[dict])
async def list_my_groups(current_user: User = Depends(require_student)):
    memberships = await GroupMember.objects.filter(user=current_user).select_related(["group"]).all()
    return [m.group.model_dump() for m in memberships]


@router.get("/groups/{group_id}/quizzes", response_model=List[dict])
async def list_group_quizzes(group_id: int, current_user: User = Depends(require_student)):
    member = await GroupMember.objects.get_or_none(group__id=group_id, user=current_user)
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this group")

    quizzes = await Quiz.objects.filter(group__id=group_id, is_active=True).all()
    return [q.model_dump() for q in quizzes]


@router.post("/quizzes/{quiz_id}/start", response_model=QuizStartResponse)
async def start_quiz(quiz_id: int, current_user: User = Depends(require_student)):
    quiz = await Quiz.objects.get_or_none(id=quiz_id)
    if not quiz or not quiz.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")

    # check membership
    member = await GroupMember.objects.get_or_none(group=quiz.group, user=current_user)
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    # create attempt
    questions = await quiz.questions.select_related(["options"]).all()
    max_score = sum([q.points for q in questions])

    attempt = await QuizAttempt.objects.create(quiz=quiz, student=current_user, score=0.0, max_score=max_score, started_at=datetime.utcnow())

    qs = []
    for q in questions:
        qs.append({
            "id": q.id,
            "text": q.text,
            "question_type": q.question_type,
            "options": [o.model_dump() for o in q.options]
        })

    return {"attempt_id": attempt.id, "quiz_id": quiz.id, "started_at": attempt.started_at, "time_limit": quiz.time_limit, "questions": qs}


@router.post("/attempts/{attempt_id}/answer")
async def submit_answer(attempt_id: int, answer: AnswerSubmit, current_user: User = Depends(require_student)):
    attempt = await QuizAttempt.objects.get_or_none(id=attempt_id)
    if not attempt or attempt.student.id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attempt not found")

    question = await Question.objects.get_or_none(id=answer.question_id)
    if not question or question.quiz.id != attempt.quiz.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid question")

    # evaluate
    correct_options = await Option.objects.filter(question=question, is_correct=True).all()
    correct_ids = {o.id for o in correct_options}
    selected_ids = set(answer.selected_options)

    is_correct = selected_ids == correct_ids
    points_earned = question.points if is_correct else 0.0

    await Answer.objects.create(
        attempt=attempt,
        question=question,
        selected_options=json.dumps(list(selected_ids)),
        is_correct=is_correct,
        points_earned=points_earned,
        answered_at=datetime.utcnow()
    )

    return {"message": "Answer recorded", "is_correct": is_correct, "points_earned": points_earned}


@router.post("/attempts/{attempt_id}/finish", response_model=AttemptResponse)
async def finish_attempt(attempt_id: int, current_user: User = Depends(require_student)):
    attempt = await QuizAttempt.objects.get_or_none(id=attempt_id)
    if not attempt or attempt.student.id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attempt not found")

    answers = await Answer.objects.filter(attempt=attempt).all()
    total = sum([a.points_earned for a in answers])
    await attempt.update(score=total, completed_at=datetime.utcnow(), is_completed=True)

    question_count = await attempt.quiz.questions.count()
    correct_count = sum([1 for a in answers if a.is_correct])

    return {
        "id": attempt.id,
        "quiz_id": attempt.quiz.id,
        "student_id": current_user.id,
        "score": total,
        "max_score": attempt.max_score,
        "started_at": attempt.started_at,
        "completed_at": datetime.utcnow(),
        "time_spent": None,
        "is_completed": True,
        "question_count": question_count,
        "correct_answers": correct_count
    }
