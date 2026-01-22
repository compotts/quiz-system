from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
import random
from datetime import datetime

from app.core import require_teacher
from app.database.models import Group, GroupMember, User, Quiz, Question, Option
from app.schemas.quiz import (
    QuizCreate, QuizResponse, QuizUpdate,
    QuestionCreate, QuestionResponse, OptionCreate
)

router = APIRouter(prefix="/teacher", tags=["teacher"])


def _generate_group_code() -> str:
    return str(random.randint(0, 999999)).zfill(6)


@router.post("/groups")
async def create_group(name: str, current_user: User = Depends(require_teacher)):
    # ensure unique code
    for _ in range(5):
        code = _generate_group_code()
        existing = await Group.objects.get_or_none(code=code)
        if not existing:
            break
    else:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not generate unique group code")

    group = await Group.objects.create(name=name, code=code, teacher=current_user)
    return {"id": group.id, "code": group.code, "name": group.name}


@router.get("/groups", response_model=List[dict])
async def list_groups(current_user: User = Depends(require_teacher)):
    groups = await Group.objects.filter(teacher=current_user).all()
    return [g.model_dump() for g in groups]


@router.post("/groups/{group_id}/add-member")
async def add_member(group_id: int, email: str, current_user: User = Depends(require_teacher)):
    group = await Group.objects.get_or_none(id=group_id)
    if not group or group.teacher.id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    user = await User.objects.get_or_none(email=email)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.role != "student":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only students can be added as members")

    existing = await GroupMember.objects.get_or_none(group=group, user=user)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already in group")

    member = await GroupMember.objects.create(group=group, user=user)
    return {"message": "Member added", "member_id": member.id}


@router.delete("/groups/{group_id}/members/{user_id}")
async def remove_member(group_id: int, user_id: int, current_user: User = Depends(require_teacher)):
    group = await Group.objects.get_or_none(id=group_id)
    if not group or group.teacher.id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    member = await GroupMember.objects.get_or_none(group=group, user__id=user_id)
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    await member.delete()
    return {"message": "Member removed"}


@router.post("/quizzes", response_model=QuizResponse)
async def create_quiz(quiz_data: QuizCreate, current_user: User = Depends(require_teacher)):
    group = await Group.objects.get_or_none(id=quiz_data.group_id)
    if not group or group.teacher.id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found or access denied")

    quiz = await Quiz.objects.create(
        title=quiz_data.title,
        description=quiz_data.description,
        group=group,
        teacher=current_user,
        quiz_type=quiz_data.quiz_type,
        timer_mode=quiz_data.timer_mode,
        time_limit=quiz_data.time_limit
    )

    return quiz


@router.get("/quizzes/{quiz_id}/questions")
async def list_quiz_questions(quiz_id: int, current_user: User = Depends(require_teacher)):
    quiz = await Quiz.objects.get_or_none(id=quiz_id)
    if not quiz or quiz.teacher.id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")

    questions = await Question.objects.filter(quiz=quiz).select_related(["options"]).all()
    result = []
    for q in questions:
        q_dict = q.model_dump()
        q_dict["options"] = [o.model_dump() for o in q.options]
        result.append(q_dict)
    return result


@router.get("/quizzes", response_model=List[QuizResponse])
async def list_quizzes(current_user: User = Depends(require_teacher)):
    quizzes = await Quiz.objects.filter(teacher=current_user).all()
    # enrich with question_count
    result = []
    for q in quizzes:
        q_dict = q.model_dump()
        q_dict["question_count"] = await q.questions.count()
        result.append(q_dict)
    return result


@router.get("/quizzes/{quiz_id}", response_model=QuizResponse)
async def get_quiz(quiz_id: int, current_user: User = Depends(require_teacher)):
    quiz = await Quiz.objects.get_or_none(id=quiz_id)
    if not quiz or quiz.teacher.id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")

    q_dict = quiz.model_dump()
    q_dict["question_count"] = await quiz.questions.count()
    return q_dict


@router.patch("/quizzes/{quiz_id}")
async def update_quiz(quiz_id: int, quiz_update: QuizUpdate, current_user: User = Depends(require_teacher)):
    quiz = await Quiz.objects.get_or_none(id=quiz_id)
    if not quiz or quiz.teacher.id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")

    data = quiz_update.model_dump(exclude_unset=True)
    if data:
        await quiz.update(**data)
    return {"message": "Quiz updated"}


@router.delete("/quizzes/{quiz_id}")
async def delete_quiz(quiz_id: int, current_user: User = Depends(require_teacher)):
    quiz = await Quiz.objects.get_or_none(id=quiz_id)
    if not quiz or quiz.teacher.id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")

    await quiz.update(is_active=False)
    return {"message": "Quiz deactivated"}


@router.post("/quizzes/{quiz_id}/questions", response_model=QuestionResponse)
async def add_question(quiz_id: int, question_data: QuestionCreate, current_user: User = Depends(require_teacher)):
    quiz = await Quiz.objects.get_or_none(id=quiz_id)
    if not quiz or quiz.teacher.id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")

    question = await Question.objects.create(
        quiz=quiz,
        question_type=question_data.question_type,
        text=question_data.text,
        order=question_data.order,
        points=question_data.points,
        time_limit=question_data.time_limit
    )

    for opt in question_data.options:
        await Option.objects.create(
            question=question,
            text=opt.text,
            is_correct=opt.is_correct,
            order=opt.order
        )

    q = await Question.objects.select_related(["options"]).get(id=question.id)
    q_dict = q.model_dump()
    q_dict["options"] = [o.model_dump() for o in q.options]
    return q_dict


@router.patch("/questions/{question_id}")
async def update_question(question_id: int, question_data: QuestionCreate, current_user: User = Depends(require_teacher)):
    question = await Question.objects.get_or_none(id=question_id)
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    if question.quiz.teacher.id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    await question.update(text=question_data.text, question_type=question_data.question_type, order=question_data.order, points=question_data.points, time_limit=question_data.time_limit)

    # replace options: delete existing and create new
    existing_opts = await Option.objects.filter(question=question).all()
    for o in existing_opts:
        await o.delete()

    for opt in question_data.options:
        await Option.objects.create(question=question, text=opt.text, is_correct=opt.is_correct, order=opt.order)

    return {"message": "Question updated"}


@router.delete("/questions/{question_id}")
async def delete_question(question_id: int, current_user: User = Depends(require_teacher)):
    question = await Question.objects.get_or_none(id=question_id)
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    if question.quiz.teacher.id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    await question.delete()
    return {"message": "Question deleted"}
