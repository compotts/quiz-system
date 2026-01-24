from ormar import Model, Integer, String, Text, Boolean, ForeignKey, DateTime, Float
from app.database.database import base_ormar_config
from datetime import datetime
from enum import Enum
from app.database.models.user import User
from app.database.models.group import Group


class QuizType(str, Enum):
    SINGLE_CHOICE = "single_choice"
    MULTIPLE_CHOICE = "multiple_choice"
    DRAG_DROP_ORDER = "drag_drop_order"


class TimerMode(str, Enum):
    QUIZ_TOTAL = "quiz_total"
    PER_QUESTION = "per_question"


class Quiz(Model):
    ormar_config = base_ormar_config.copy(tablename="quizzes")

    id: int = Integer(primary_key=True)
    title: str = String(max_length=255)
    description: str = Text(nullable=True)
    group: Group = ForeignKey(Group, related_name="quizzes")
    teacher: User = ForeignKey(User, related_name="created_quizzes")
    quiz_type: QuizType = String(max_length=20, default=QuizType.SINGLE_CHOICE)
    timer_mode: TimerMode = String(max_length=20, default=TimerMode.QUIZ_TOTAL)
    time_limit: int = Integer(nullable=True)
    is_active: bool = Boolean(default=True)
    created_at: datetime = DateTime(default=datetime.utcnow)
    updated_at: datetime = DateTime(default=datetime.utcnow, onupdate=datetime.utcnow)


class Question(Model):
    ormar_config = base_ormar_config.copy(tablename="questions")

    id: int = Integer(primary_key=True)
    quiz: Quiz = ForeignKey(Quiz, related_name="questions")
    question_type: QuizType = String(max_length=20)
    text: str = Text()
    order: int = Integer()
    points: float = Float(default=1.0)
    time_limit: int = Integer(nullable=True)
    created_at: datetime = DateTime(default=datetime.utcnow)
    updated_at: datetime = DateTime(default=datetime.utcnow, onupdate=datetime.utcnow)


class Option(Model):
    ormar_config = base_ormar_config.copy(tablename="options")

    id: int = Integer(primary_key=True)
    question: Question = ForeignKey(Question, related_name="options")
    text: str = Text()
    is_correct: bool = Boolean(default=False)
    order: int = Integer()
    created_at: datetime = DateTime(default=datetime.utcnow)
    updated_at: datetime = DateTime(default=datetime.utcnow, onupdate=datetime.utcnow)