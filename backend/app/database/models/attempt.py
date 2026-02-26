from ormar import Model, Integer, Float, ForeignKey, DateTime, Text, Boolean, String
from app.database.database import base_ormar_config, utc_now
from datetime import datetime
from enum import Enum
from app.database.models.user import User
from app.database.models.quiz import Quiz, Question


class AttemptStatus(str, Enum):
    NOT_OPENED = "not_opened"
    OPENED = "opened"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    EXPIRED = "expired"


class QuizAttempt(Model):
    ormar_config = base_ormar_config.copy(tablename="attempts")

    id: int = Integer(primary_key=True)
    quiz: Quiz = ForeignKey(Quiz, related_name="attempts")
    student: User = ForeignKey(User, related_name="quiz_attempts")
    score: float = Float(default=0.0)
    max_score: float = Float()
    started_at: datetime = DateTime(default=utc_now)
    completed_at: datetime = DateTime(nullable=True)
    time_spent: int = Integer(nullable=True)
    is_completed: bool = Boolean(default=False)
    status: str = String(max_length=20, default="opened")
    questions_order: str = Text(nullable=True)
    needs_manual_grading: bool = Boolean(default=False)
    created_at: datetime = DateTime(default=utc_now)


class Answer(Model):
    ormar_config = base_ormar_config.copy(tablename="answers")

    id: int = Integer(primary_key=True)
    attempt: QuizAttempt = ForeignKey(QuizAttempt, related_name="answers")
    question: Question = ForeignKey(Question)
    selected_options: str = Text()
    text_answer: str = Text(nullable=True)
    is_correct: bool = Boolean(default=False)
    points_earned: float = Float(default=0.0)
    manually_graded: bool = Boolean(default=False)
    time_spent: int = Integer(nullable=True)
    answered_at: datetime = DateTime(default=utc_now)


class AntiCheatingEvent(Model):
    ormar_config = base_ormar_config.copy(tablename="anti_cheating_events")

    id: int = Integer(primary_key=True)
    attempt: QuizAttempt = ForeignKey(QuizAttempt, related_name="anti_cheating_events")
    event_type: str = String(max_length=30)
    details: str = Text(nullable=True)
    created_at: datetime = DateTime(default=utc_now)