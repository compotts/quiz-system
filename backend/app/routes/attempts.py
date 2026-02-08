from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List
import random
import unicodedata
from schemas import (
    StartQuizAttempt, SubmitAnswer, CompleteQuizAttempt,
    QuizAttemptResponse, QuizResultResponse,
    SubmitAnswersBatch, SubmitAnswersBatchResponse
)
from app.database.models.quiz import Quiz, Question, Option
from app.database.models.group import GroupMember
from app.database.models.attempt import QuizAttempt, Answer
from app.database.models.user import User
from app.utils.auth import get_current_student, get_current_user
from app.utils.audit import log_audit
from app.database.database import utc_now
from datetime import datetime
import json

router = APIRouter(prefix="/attempts", tags=["Quiz Attempts"])


def normalize_text_answer(text: str) -> str:
    if not text:
        return ""
    text = text.strip().lower()
    text = text.replace("ё", "е")
    text = unicodedata.normalize("NFKC", text)
    return text


def compare_text_answers(user_answer: str, correct_answer: str) -> bool:
    return normalize_text_answer(user_answer) == normalize_text_answer(correct_answer)


@router.post("/start", response_model=QuizAttemptResponse)
async def start_quiz_attempt(
    data: StartQuizAttempt,
    request: Request,
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
    
    now = utc_now()
    if not quiz.manual_close and quiz.available_until and quiz.available_until < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quiz has expired"
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
        questions_order = None
        if existing_attempt.questions_order:
            try:
                questions_order = json.loads(existing_attempt.questions_order)
            except:
                pass
        return {
            **existing_attempt.dict(),
            "quiz_id": quiz.id,
            "student_id": current_user.id,
            "questions_order": questions_order
        }
    
    questions = await Question.objects.filter(quiz=quiz).all()
    max_score = sum(q.points for q in questions)
    
    question_ids = [q.id for q in questions]
    random.shuffle(question_ids)
    questions_order_json = json.dumps(question_ids)
    
    attempt = await QuizAttempt.objects.create(
        quiz=quiz,
        student=current_user,
        score=0.0,
        max_score=max_score,
        started_at=utc_now(),
        is_completed=False,
        status="opened",
        questions_order=questions_order_json
    )
    await log_audit(
        "attempt_started",
        user_id=current_user.id,
        username=current_user.username,
        resource_type="attempt",
        resource_id=str(attempt.id),
        details={"quiz_id": quiz.id, "quiz_title": quiz.title},
        request=request,
    )
    return {
        **attempt.dict(),
        "quiz_id": quiz.id,
        "student_id": current_user.id,
        "questions_order": question_ids
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
    
    is_correct = False
    points_earned = 0.0
    selected_options_json = "[]"
    text_answer = None
    
    input_type = question.input_type or "select"
    if input_type in ("text", "number"):
        text_answer = data.text_answer
        if text_answer is not None and question.correct_text_answer:
            if input_type == "number":
                try:
                    is_correct = float(text_answer.strip()) == float(question.correct_text_answer.strip())
                except:
                    is_correct = False
            else:
                is_correct = compare_text_answers(text_answer, question.correct_text_answer)
        points_earned = question.points if is_correct else 0.0
    else:
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
        selected_options_json = json.dumps(data.selected_options)
    
    now = utc_now()
    previous_answers = await Answer.objects.filter(attempt=attempt).order_by("-answered_at").all()
    if previous_answers:
        last_answer_time = previous_answers[0].answered_at
        time_spent = int((now - last_answer_time).total_seconds())
    else:
        time_spent = int((now - attempt.started_at).total_seconds())
    
    answer = await Answer.objects.create(
        attempt=attempt,
        question=question,
        selected_options=selected_options_json,
        text_answer=text_answer,
        is_correct=is_correct,
        points_earned=points_earned,
        time_spent=time_spent,
        answered_at=now
    )
    
    await attempt.load()
    await attempt.update(score=attempt.score + points_earned, status="in_progress")
    
    return {
        "message": "Answer submitted",
        "is_correct": is_correct,
        "points_earned": points_earned
    }


@router.post("/submit-batch", response_model=SubmitAnswersBatchResponse)
async def submit_answers_batch(
    data: SubmitAnswersBatch,
    request: Request,
    current_user: User = Depends(get_current_student)
):
    attempt = await QuizAttempt.objects.select_related("quiz").get_or_none(
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
    
    questions = await Question.objects.filter(quiz=attempt.quiz).all()
    question_map = {q.id: q for q in questions}
    
    existing_answers = await Answer.objects.filter(attempt=attempt).all()
    answered_question_ids = {a.question.id for a in existing_answers}
    
    submitted_count = 0
    skipped_count = 0
    total_points_earned = 0.0
    now = utc_now()
    
    if existing_answers:
        last_answer = sorted(existing_answers, key=lambda x: x.answered_at)[-1]
        base_time = last_answer.answered_at
    else:
        base_time = attempt.started_at
    
    for answer_data in data.answers:
        question_id = answer_data.question_id
        
        if question_id in answered_question_ids:
            skipped_count += 1
            continue
        
        question = question_map.get(question_id)
        if not question:
            skipped_count += 1
            continue
        
        is_correct = False
        points_earned = 0.0
        selected_options_json = "[]"
        text_answer = None
        
        input_type = question.input_type or "select"
        
        if input_type in ("text", "number"):
            text_answer = answer_data.text_answer
            if text_answer is not None and question.correct_text_answer:
                if input_type == "number":
                    try:
                        is_correct = float(text_answer.strip()) == float(question.correct_text_answer.strip())
                    except:
                        is_correct = False
                else:
                    is_correct = text_answer.strip().lower() == question.correct_text_answer.strip().lower()
            points_earned = question.points if is_correct else 0.0
        else:
            all_question_options = await Option.objects.filter(question=question).all()
            all_option_ids = set(opt.id for opt in all_question_options)
            selected_ids = set(answer_data.selected_options)
            
            if not selected_ids.issubset(all_option_ids):
                skipped_count += 1
                continue
            
            correct_options = await Option.objects.filter(
                question=question,
                is_correct=True
            ).all()
            correct_ids = set(opt.id for opt in correct_options)
            
            is_correct = correct_ids == selected_ids
            points_earned = question.points if is_correct else 0.0
            selected_options_json = json.dumps(answer_data.selected_options)
        
        if getattr(answer_data, "time_spent", None) is not None and answer_data.time_spent >= 0:
            time_spent = answer_data.time_spent
        else:
            time_spent = int((now - base_time).total_seconds())
        
        await Answer.objects.create(
            attempt=attempt,
            question=question,
            selected_options=selected_options_json,
            text_answer=text_answer,
            is_correct=is_correct,
            points_earned=points_earned,
            time_spent=time_spent,
            answered_at=now
        )
        
        total_points_earned += points_earned
        submitted_count += 1
        answered_question_ids.add(question_id)
        base_time = now
    
    new_score = attempt.score + total_points_earned
    await attempt.update(score=new_score, status="in_progress")
    
    if data.complete:
        time_spent = int((utc_now() - attempt.started_at).total_seconds())
        await attempt.update(
            completed_at=utc_now(),
            time_spent=time_spent,
            is_completed=True,
            status="completed"
        )
        await log_audit(
            "attempt_completed",
            user_id=current_user.id,
            username=current_user.username,
            resource_type="attempt",
            resource_id=str(attempt.id),
            details={
                "quiz_id": attempt.quiz.id,
                "quiz_title": attempt.quiz.title,
                "score": new_score,
                "max_score": attempt.max_score,
            },
            request=request,
        )
    
    percentage = (new_score / attempt.max_score * 100) if attempt.max_score > 0 else 0
    
    return {
        "submitted_count": submitted_count,
        "skipped_count": skipped_count,
        "score": new_score,
        "max_score": attempt.max_score,
        "percentage": percentage,
        "is_completed": data.complete
    }


@router.post("/complete")
async def complete_quiz_attempt(
    data: CompleteQuizAttempt,
    request: Request,
    current_user: User = Depends(get_current_student)
):
    attempt = await QuizAttempt.objects.select_related("quiz").get_or_none(
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
        completed_at=utc_now(),
        time_spent=time_spent,
        is_completed=True,
        status="completed"
    )
    await log_audit(
        "attempt_completed",
        user_id=current_user.id,
        username=current_user.username,
        resource_type="attempt",
        resource_id=str(attempt.id),
        details={
            "quiz_id": attempt.quiz.id,
            "quiz_title": attempt.quiz.title,
            "score": attempt.score,
            "max_score": attempt.max_score,
        },
        request=request,
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
    
    result = []
    for attempt in attempts:
        data = attempt.dict()
        data["quiz_id"] = attempt.quiz.id
        data["student_id"] = current_user.id
        if data.get("questions_order"):
            try:
                data["questions_order"] = json.loads(data["questions_order"])
            except (json.JSONDecodeError, TypeError):
                data["questions_order"] = None
        result.append(data)
    return result


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
        
        options_map = {opt.id: opt.text for opt in options}
        selected_texts = [options_map.get(oid, str(oid)) for oid in selected_ids]
        correct_option_texts = [opt.text for opt in options if opt.is_correct]
        
        input_type = question.input_type or "select"
        
        answer_details.append({
            "question_id": question.id,
            "question_text": question.text,
            "input_type": input_type,
            "selected_options": selected_ids,
            "selected_texts": selected_texts,
            "text_answer": answer.text_answer,
            "correct_options": [opt.id for opt in options if opt.is_correct],
            "correct_option_texts": correct_option_texts,
            "correct_text_answer": question.correct_text_answer if input_type in ("text", "number") else None,
            "is_correct": answer.is_correct,
            "points_earned": answer.points_earned,
            "max_points": question.points
        })
    
    percentage = (attempt.score / attempt.max_score * 100) if attempt.max_score > 0 else 0
    
    questions_order = None
    if attempt.questions_order:
        try:
            questions_order = json.loads(attempt.questions_order)
        except (json.JSONDecodeError, TypeError):
            questions_order = None
    
    attempt_data = attempt.dict()
    attempt_data["quiz_id"] = attempt.quiz.id
    attempt_data["student_id"] = attempt.student.id
    attempt_data["questions_order"] = questions_order
    
    return {
        "attempt": attempt_data,
        "answers": answer_details,
        "percentage": percentage,
        "allow_show_answers": attempt.quiz.allow_show_answers if hasattr(attempt.quiz, 'allow_show_answers') else True,
        "show_results": attempt.quiz.show_results if hasattr(attempt.quiz, 'show_results') else True
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
    
    questions_order = None
    if attempt.questions_order:
        try:
            questions_order = json.loads(attempt.questions_order)
        except:
            pass
    
    return {
        "has_attempt": True,
        "attempt_id": attempt.id,
        "started_at": attempt.started_at,
        "answered_questions": answered_ids,
        "questions_order": questions_order
    }