from ormar import Model, Integer, String, Text, Boolean, ForeignKey, DateTime, Float
from app.database.database import base_ormar_config, utc_now
from datetime import datetime
from enum import Enum
from app.database.models.user import User
from app.database.models.group import Group


class QuizType(str, Enum):
    SINGLE_CHOICE = "single_choice"
    MULTIPLE_CHOICE = "multiple_choice"
    DRAG_DROP_ORDER = "drag_drop_order"
    TEXT_INPUT = "text_input"
    NUMBER_INPUT = "number_input"


class TimerMode(str, Enum):
    NONE = "none"
    QUIZ_TOTAL = "quiz_total"
    PER_QUESTION = "per_question"


class QuestionInputType(str, Enum):
    SELECT = "select" 
    TEXT = "text" 
    NUMBER = "number"


class QuestionDisplayMode(str, Enum):
    ALL_ON_PAGE = "all_on_page"
    ONE_PER_PAGE = "one_per_page" 


class Quiz(Model):
    ormar_config = base_ormar_config.copy(tablename="quizzes")

    id: int = Integer(primary_key=True)
    title: str = String(max_length=255)
    description: str = Text(nullable=True)
    group: Group = ForeignKey(Group, related_name="quizzes")
    teacher: User = ForeignKey(User, related_name="created_quizzes")
    quiz_type: str = String(max_length=20, default="single_choice", nullable=True) 
    timer_mode: str = String(max_length=20, default="none", nullable=True)
    has_quiz_time_limit: bool = Boolean(default=False)
    time_limit: int = Integer(nullable=True)  
    question_time_limit: int = Integer(nullable=True)
    is_active: bool = Boolean(default=True)
    available_until: datetime = DateTime(nullable=True)
    manual_close: bool = Boolean(default=False) 
    allow_show_answers: bool = Boolean(default=True) 
    show_results: bool = Boolean(default=True) 
    question_display_mode: str = String(max_length=20, default="all_on_page")
    anti_cheating_mode: bool = Boolean(default=False)
    allow_math: bool = Boolean(default=False)
    created_at: datetime = DateTime(default=utc_now)
    updated_at: datetime = DateTime(default=utc_now)


class Question(Model):
    ormar_config = base_ormar_config.copy(tablename="questions")

    id: int = Integer(primary_key=True)
    quiz: Quiz = ForeignKey(Quiz, related_name="questions")
    question_type: str = String(max_length=20, nullable=True) 
    input_type: str = String(max_length=20, default="select")
    text: str = Text()
    order: int = Integer()
    points: float = Float(default=1.0)
    correct_text_answer: str = Text(nullable=True)
    image_url: str = String(max_length=512, nullable=True)  # path for question image, e.g. /uploads/questions/123_abc.jpg
    created_at: datetime = DateTime(default=utc_now)
    updated_at: datetime = DateTime(default=utc_now)


class Option(Model):
    ormar_config = base_ormar_config.copy(tablename="options")

    id: int = Integer(primary_key=True)
    question: Question = ForeignKey(Question, related_name="options")
    text: str = Text()
    is_correct: bool = Boolean(default=False)
    order: int = Integer()
    created_at: datetime = DateTime(default=utc_now)
    updated_at: datetime = DateTime(default=utc_now)
